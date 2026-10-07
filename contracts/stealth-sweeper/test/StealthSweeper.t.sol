// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {StealthSweeper} from "../src/StealthSweeper.sol";
import {TokenNormal, TokenTipoUSDT, TokenFalso, DepositoFalso} from "./Mocks.sol";

/// Destino que, al recibir nativo, intenta ejecutar OTRA VEZ la misma orden (reentrada).
contract Reentrante {
    StealthSweeper.Barrido orden;
    bytes firma;
    address stealth;
    bool public intento;
    bool public reentradaOk;

    function preparar(address s, StealthSweeper.Barrido calldata b, bytes calldata f) external {
        stealth = s;
        orden = b;
        firma = f;
    }

    receive() external payable {
        if (intento) return;
        intento = true;
        try StealthSweeper(payable(stealth)).barrer(orden, firma) { reentradaOk = true; } catch {}
    }
}

contract StealthSweeperTest is Test {
    StealthSweeper impl;
    TokenNormal usdc;
    TokenTipoUSDT usdt;
    DepositoFalso pool;

    uint256 constant PK = 0xA11CE5;          // llave de la dirección stealth
    address stealth;
    address relayer = makeAddr("relayer");
    address destino = makeAddr("destino");
    address tercero = makeAddr("tercero");

    function setUp() public {
        impl = new StealthSweeper();
        usdc = new TokenNormal();
        usdt = new TokenTipoUSDT();
        pool = new DepositoFalso();
        stealth = vm.addr(PK);
        usdc.mint(stealth, 100e6);
        usdt.mint(stealth, 100e6);
        vm.deal(stealth, 1 ether);
        vm.deal(relayer, 1 ether);
        // La autorización 7702 firmada por la llave stealth: su código pasa a ser el del sweeper.
        vm.signAndAttachDelegation(address(impl), PK);
    }

    // ── helpers ──

    function _orden(address token, uint256 monto, uint256 comision) internal view returns (StealthSweeper.Barrido memory b) {
        b = StealthSweeper.Barrido({
            token: token, destino: destino, monto: monto, relayer: relayer, comision: comision,
            nonce: 1, vence: block.timestamp + 1 hours, llamada: address(0), datos: ""
        });
    }

    function _firmar(uint256 pk, StealthSweeper.Barrido memory b) internal view returns (bytes memory) {
        bytes32 h = StealthSweeper(payable(vm.addr(pk))).digest(b);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, h);
        return abi.encodePacked(r, s, v);
    }

    function _barrer(address quien, StealthSweeper.Barrido memory b, bytes memory f) internal {
        vm.prank(quien);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    // ── la delegación ──

    function test_delegacion_instala_el_codigo_7702() public view {
        assertEq(stealth.code, abi.encodePacked(hex"ef0100", address(impl)));
    }

    function test_slot_erc7201() public pure {
        bytes32 esperado = keccak256(abi.encode(uint256(keccak256("stealthpay.barrido.v1")) - 1)) & ~bytes32(uint256(0xff));
        assertEq(esperado, 0xb7a73c6b89623ac011ede5e935742e118636aef4f9571559fb3a2a597d7cfa00);
    }

    function test_typehash() public view {
        assertEq(
            impl.BARRIDO_TYPEHASH(),
            keccak256("Barrido(address token,address destino,uint256 monto,address relayer,uint256 comision,uint256 nonce,uint256 vence,address llamada,bytes32 datosHash)")
        );
    }

    // ── caminos felices ──

    function test_barre_token_y_paga_comision() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 40e6, 1e5);
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(usdc.balanceOf(destino), 40e6);
        assertEq(usdc.balanceOf(relayer), 1e5);
        assertEq(usdc.balanceOf(stealth), 100e6 - 40e6 - 1e5);
        assertTrue(StealthSweeper(payable(stealth)).usado(1));
        // el nonce vive en el slot ERC-7201 DE LA STEALTH
        bytes32 slot = keccak256(abi.encode(uint256(1), bytes32(0xb7a73c6b89623ac011ede5e935742e118636aef4f9571559fb3a2a597d7cfa00)));
        assertEq(vm.load(stealth, slot), bytes32(uint256(1)));
    }

    function test_token_tipo_usdt_sin_retorno() public {
        StealthSweeper.Barrido memory b = _orden(address(usdt), 50e6, 2e5);
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(usdt.balanceOf(destino), 50e6);
        assertEq(usdt.balanceOf(relayer), 2e5);
    }

    function test_nativo_sin_polvo() public {
        StealthSweeper.Barrido memory b = _orden(address(0), 0.99 ether, 0.01 ether);
        uint256 antes = relayer.balance;
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(destino.balance, 0.99 ether);
        assertEq(relayer.balance, antes + 0.01 ether);
        assertEq(stealth.balance, 0); // la stealth queda en cero exacto: no pagó gas
    }

    function test_relayer_cero_cobra_quien_transmite() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 3e5);
        b.relayer = address(0);
        _barrer(tercero, b, _firmar(PK, b));
        assertEq(usdc.balanceOf(tercero), 3e5);
        assertEq(usdc.balanceOf(destino), 10e6);
    }

    function test_el_receptor_transmite_y_paga_el_gas() public {
        // Sin relayer: la orden nombra al propio receptor, sin comisión. El receptor (que igual sabe que
        // le pagan) la manda desde su cuenta; no interviene ningún tercero.
        StealthSweeper.Barrido memory b = _orden(address(usdc), 25e6, 0);
        b.relayer = destino;
        bytes memory f = _firmar(PK, b);
        vm.prank(tercero);
        vm.expectRevert(StealthSweeper.RelayerAjeno.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
        _barrer(destino, b, f);
        assertEq(usdc.balanceOf(destino), 25e6);
        assertEq(usdc.balanceOf(stealth), 75e6);
    }

    function test_sigue_recibiendo_nativo_delegada() public {
        vm.deal(tercero, 1 ether);
        vm.prank(tercero);
        (bool ok,) = stealth.call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(stealth.balance, 1.5 ether);
    }

    function test_dos_ordenes_con_distinto_nonce() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        _barrer(relayer, b, _firmar(PK, b));
        b.nonce = 2;
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(usdc.balanceOf(destino), 20e6);
    }

    // ── llamada: depósito/shield en otro contrato ──

    function test_llamada_token_aprueba_exacto_y_vuelve_a_cero() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 30e6, 1e5);
        b.llamada = address(pool);
        b.datos = abi.encodeCall(DepositoFalso.depositar, (address(usdc), 30e6, bytes32("nota")));
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(pool.notas(bytes32("nota")), 30e6);
        assertEq(usdc.balanceOf(address(pool)), 30e6);
        assertEq(usdc.allowance(stealth, address(pool)), 0);
    }

    function test_llamada_usdt_con_permiso_previo() public {
        // Un permiso viejo distinto de cero: USDT revertiría al aprobar sin pasar por cero.
        vm.prank(stealth);
        usdt.approve(address(pool), 1);
        StealthSweeper.Barrido memory b = _orden(address(usdt), 30e6, 0);
        b.llamada = address(pool);
        b.datos = abi.encodeCall(DepositoFalso.depositar, (address(usdt), 30e6, bytes32("n")));
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(usdt.balanceOf(address(pool)), 30e6);
        assertEq(usdt.allowance(stealth, address(pool)), 0);
    }

    function test_llamada_nativo() public {
        StealthSweeper.Barrido memory b = _orden(address(0), 0.5 ether, 0);
        b.llamada = address(pool);
        b.datos = abi.encodeCall(DepositoFalso.depositar, (address(0), 0.5 ether, bytes32("e")));
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(pool.notas(bytes32("e")), 0.5 ether);
    }

    function test_llamada_que_revierte_no_consume_nonce() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 30e6, 1e5);
        b.llamada = address(pool);
        b.datos = abi.encodeCall(DepositoFalso.revertir, ());
        bytes memory f = _firmar(PK, b);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FalloLlamada.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
        assertFalse(StealthSweeper(payable(stealth)).usado(1));
        assertEq(usdc.balanceOf(relayer), 0); // ni la comisión salió
    }

    function test_cambiar_datos_invalida_la_firma() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 30e6, 0);
        b.llamada = address(pool);
        b.datos = abi.encodeCall(DepositoFalso.depositar, (address(usdc), 30e6, bytes32("mia")));
        bytes memory f = _firmar(PK, b);
        b.datos = abi.encodeCall(DepositoFalso.depositar, (address(usdc), 30e6, bytes32("del atacante")));
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    // ── lo que tiene que rechazar ──

    function test_rechaza_replay() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes memory f = _firmar(PK, b);
        _barrer(relayer, b, f);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.NonceUsado.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    function test_rechaza_vencida() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes memory f = _firmar(PK, b);
        vm.warp(b.vence + 1);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.Vencido.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    function test_rechaza_relayer_ajeno() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 1e5);
        bytes memory f = _firmar(PK, b);
        vm.prank(tercero); // vio la orden en el mempool e intenta cobrar la comisión
        vm.expectRevert(StealthSweeper.RelayerAjeno.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    function test_rechaza_otra_llave() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes32 h = StealthSweeper(payable(stealth)).digest(b);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, h);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
        StealthSweeper(payable(stealth)).barrer(b, abi.encodePacked(r, s, v));
    }

    function test_rechaza_firma_de_otra_stealth() public {
        // Misma orden, firmada por OTRA stealth (también delegada): el dominio incluye address(this).
        uint256 pk2 = 0xB0B;
        address s2 = vm.addr(pk2);
        vm.signAndAttachDelegation(address(impl), pk2);
        usdc.mint(s2, 100e6);
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes memory f2 = _firmar(pk2, b);
        vm.prank(relayer);
        StealthSweeper(payable(s2)).barrer(b, f2); // en s2 vale
        assertEq(usdc.balanceOf(s2), 90e6);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector); // en la stealth original no
        StealthSweeper(payable(stealth)).barrer(b, f2);
    }

    function test_rechaza_otra_red() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes memory f = _firmar(PK, b);
        vm.chainId(1);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    function test_rechaza_firma_maleable() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, StealthSweeper(payable(stealth)).digest(b));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory gemela = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
        StealthSweeper(payable(stealth)).barrer(b, gemela);
    }

    function test_rechaza_largo_y_v_raros() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, StealthSweeper(payable(stealth)).digest(b));
        bytes[3] memory malas = [abi.encodePacked(r, s), abi.encodePacked(r, s, v - 27), abi.encodePacked(r, s, v, uint8(0))];
        for (uint256 i; i < 3; i++) {
            vm.prank(relayer);
            vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
            StealthSweeper(payable(stealth)).barrer(b, malas[i]);
        }
    }

    function test_rechaza_token_que_devuelve_false() public {
        TokenFalso f = new TokenFalso();
        StealthSweeper.Barrido memory b = _orden(address(f), 10e6, 0);
        bytes memory fi = _firmar(PK, b);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FalloPago.selector);
        StealthSweeper(payable(stealth)).barrer(b, fi);
    }

    function test_rechaza_token_sin_codigo() public {
        StealthSweeper.Barrido memory b = _orden(makeAddr("no-es-token"), 10e6, 0);
        bytes memory f = _firmar(PK, b);
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FalloPago.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }

    function test_saldo_insuficiente_revierte_entero() public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 100e6, 1); // 100 + comisión > saldo
        bytes memory f = _firmar(PK, b);
        vm.prank(relayer);
        vm.expectRevert();
        StealthSweeper(payable(stealth)).barrer(b, f);
        assertEq(usdc.balanceOf(stealth), 100e6);
        assertFalse(StealthSweeper(payable(stealth)).usado(1));
    }

    function test_reentrada_no_cobra_dos_veces() public {
        Reentrante malo = new Reentrante();
        StealthSweeper.Barrido memory b = _orden(address(0), 0.4 ether, 0);
        b.destino = address(malo);
        b.relayer = address(0);
        bytes memory f = _firmar(PK, b);
        malo.preparar(stealth, b, f);
        _barrer(tercero, b, f);
        assertTrue(malo.intento());
        assertFalse(malo.reentradaOk());
        assertEq(address(malo).balance, 0.4 ether);
    }

    function test_sin_delegar_la_llamada_no_hace_nada() public {
        // Una stealth que nunca firmó la autorización es una EOA común. Una llamada de bajo nivel a ella
        // "funciona" (ok = true) sin mover nada: el relayer TIENE que verificar la delegación (código
        // 0xef0100‖sweeper) o mandar la autorización en la misma transacción, y mirar el evento Barrido_.
        uint256 pk = 0xC0FFEE;
        address virgen = vm.addr(pk);
        usdc.mint(virgen, 10e6);
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes32 h = StealthSweeper(payable(stealth)).digest(b); // cualquier firma: no se va a verificar
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, h);
        vm.prank(relayer);
        (bool ok,) = virgen.call(abi.encodeCall(StealthSweeper.barrer, (b, abi.encodePacked(r, s, v))));
        assertTrue(ok);
        assertEq(virgen.code.length, 0);
        assertEq(usdc.balanceOf(virgen), 10e6);
        assertEq(usdc.balanceOf(destino), 0);
    }

    // ── fuzz ──

    function testFuzz_conserva_el_saldo(uint96 monto, uint96 comision, uint256 nonce) public {
        uint256 total = uint256(monto) + comision;
        vm.assume(total <= 100e6);
        StealthSweeper.Barrido memory b = _orden(address(usdc), monto, comision);
        b.nonce = nonce;
        _barrer(relayer, b, _firmar(PK, b));
        assertEq(usdc.balanceOf(destino) + usdc.balanceOf(relayer) + usdc.balanceOf(stealth), 100e6);
        assertEq(usdc.balanceOf(stealth), 100e6 - total);
    }

    function testFuzz_cualquier_cambio_invalida(uint256 nuevoMonto) public {
        StealthSweeper.Barrido memory b = _orden(address(usdc), 10e6, 0);
        bytes memory f = _firmar(PK, b);
        vm.assume(nuevoMonto != b.monto);
        b.monto = nuevoMonto;
        vm.prank(relayer);
        vm.expectRevert(StealthSweeper.FirmaInvalida.selector);
        StealthSweeper(payable(stealth)).barrer(b, f);
    }
}
