// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title StealthSweeper — gastar desde una dirección stealth sin gas propio (StealthPay, EIP-7702)
/// @notice Una dirección stealth ERC-5564 es una EOA que recibe tokens y no tiene nativo para mover
///         nada. Su llave delega su código en este contrato (EIP-7702) y firma una orden de barrido
///         (EIP-712). Después CUALQUIER cuenta con gas puede ejecutar la orden: el código corre como la
///         propia dirección stealth y sólo obedece a una firma de esa misma llave.
/// @dev    Diseño: investigacion/stealthpay/diseno-barrido-7702.md.
///         - Sin owner, sin upgrade, sin admin. El único estado son los nonces usados, en un slot
///           ERC-7201 para que una delegación posterior a otro código no los pise ni los herede.
///         - `address(this)` es la dirección stealth, no este contrato: por eso el dominio EIP-712 se
///           calcula en cada llamada y no se guarda como immutable.
///         - Nada de este contrato hace falta para recuperar fondos: las llaves salen de la semilla.
contract StealthSweeper {
    /// @dev = 0xe4c5d096237ae220ce31dbde54357f7374222fefd1d8ddf54227cad33ac660fb: keccak256("Barrido(address token,address destino,uint256 monto,address relayer,uint256 comision,uint256 nonce,uint256 vence,address llamada,bytes32 datosHash)")
    bytes32 public constant BARRIDO_TYPEHASH = keccak256(
        "Barrido(address token,address destino,uint256 monto,address relayer,uint256 comision,"
        "uint256 nonce,uint256 vence,address llamada,bytes32 datosHash)"
    );
    bytes32 private constant DOMINIO_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NOMBRE_HASH = keccak256("StealthPay Barrido");
    bytes32 private constant VERSION_HASH = keccak256("1");

    /// @dev ERC-7201: keccak256(abi.encode(uint256(keccak256("stealthpay.barrido.v1")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant SLOT_NONCES = 0xb7a73c6b89623ac011ede5e935742e118636aef4f9571559fb3a2a597d7cfa00;

    /// @dev Mitad del orden de secp256k1: una firma con `s` mayor es la gemela maleable de otra.
    uint256 private constant SECP256K1_N_MEDIOS =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    struct Barrido {
        address token;    // address(0) = nativo
        address destino;  // a quién va `monto` (si `llamada` es 0)
        uint256 monto;
        address relayer;  // address(0) = transmite y cobra cualquiera
        uint256 comision; // en `token`, para quien transmite
        uint256 nonce;
        uint256 vence;    // timestamp; después de esto la orden no vale
        address llamada;  // address(0) = transferencia simple; si no, se aprueba `monto` y se ejecuta `datos`
        bytes datos;
    }

    error Vencido();
    error NonceUsado();
    error RelayerAjeno();
    error FirmaInvalida();
    error FalloPago();
    error FalloLlamada();

    event Barrido_(
        uint256 indexed nonce, address indexed token, address indexed destino, uint256 monto, address cobrador, uint256 comision
    );

    /// @notice Delegada, la dirección stealth tiene que poder seguir recibiendo nativo.
    receive() external payable {}

    /// @notice Ejecuta una orden firmada por la llave de esta dirección (la stealth).
    function barrer(Barrido calldata b, bytes calldata firma) external {
        if (block.timestamp > b.vence) revert Vencido();
        if (b.relayer != address(0) && msg.sender != b.relayer) revert RelayerAjeno();
        if (usado(b.nonce)) revert NonceUsado();
        if (_recuperar(digest(b), firma) != address(this)) revert FirmaInvalida();
        _marcar(b.nonce); // antes de mover nada: una reentrada con la misma orden choca acá

        address cobrador = b.relayer == address(0) ? msg.sender : b.relayer;
        if (b.comision != 0) _pagar(b.token, cobrador, b.comision);

        if (b.llamada == address(0)) {
            _pagar(b.token, b.destino, b.monto);
        } else {
            // Depósito o shield en otro contrato. Se aprueba el monto exacto y se vuelve a cero, así no
            // queda ningún permiso colgado. `datos` está cubierto por la firma vía datosHash.
            bool nativo = b.token == address(0);
            if (!nativo) _aprobar(b.token, b.llamada, b.monto);
            (bool ok,) = b.llamada.call{value: nativo ? b.monto : 0}(b.datos);
            if (!ok) revert FalloLlamada();
            if (!nativo) _aprobar(b.token, b.llamada, 0);
        }
        emit Barrido_(b.nonce, b.token, b.destino, b.monto, cobrador, b.comision);
    }

    /// @notice ¿Ya se usó este nonce en esta dirección?
    function usado(uint256 nonce) public view returns (bool r) {
        bytes32 s = _slotNonce(nonce);
        assembly { r := sload(s) }
    }

    /// @notice El separador de dominio EIP-712 de ESTA dirección stealth en esta red.
    function dominio() public view returns (bytes32) {
        return keccak256(abi.encode(DOMINIO_TYPEHASH, NOMBRE_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /// @notice El hash EIP-712 que la llave stealth tiene que firmar.
    function digest(Barrido calldata b) public view returns (bytes32) {
        bytes32 h = keccak256(
            abi.encode(
                BARRIDO_TYPEHASH,
                b.token,
                b.destino,
                b.monto,
                b.relayer,
                b.comision,
                b.nonce,
                b.vence,
                b.llamada,
                keccak256(b.datos)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", dominio(), h));
    }

    // ── internos ─────────────────────────────────────────────────────────────

    function _slotNonce(uint256 nonce) private pure returns (bytes32) {
        return keccak256(abi.encode(nonce, SLOT_NONCES));
    }

    function _marcar(uint256 nonce) private {
        bytes32 s = _slotNonce(nonce);
        assembly { sstore(s, 1) }
    }

    /// @dev Sólo firmas de 65 bytes, `s` bajo y `v` en {27, 28}: cada orden tiene UNA firma válida.
    function _recuperar(bytes32 h, bytes calldata firma) private pure returns (address) {
        if (firma.length != 65) revert FirmaInvalida();
        bytes32 r = bytes32(firma[0:32]);
        bytes32 s = bytes32(firma[32:64]);
        uint8 v = uint8(firma[64]);
        if (uint256(s) > SECP256K1_N_MEDIOS || (v != 27 && v != 28)) revert FirmaInvalida();
        address quien = ecrecover(h, v, r, s);
        if (quien == address(0)) revert FirmaInvalida();
        return quien;
    }

    function _pagar(address token, address a, uint256 monto) private {
        if (monto == 0) return;
        if (token == address(0)) {
            (bool ok,) = a.call{value: monto}("");
            if (!ok) revert FalloPago();
        } else {
            _llamarToken(token, abi.encodeWithSelector(0xa9059cbb, a, monto)); // transfer(address,uint256)
        }
    }

    /// @dev USDT exige pasar por cero antes de cambiar un permiso distinto de cero; se hace siempre.
    function _aprobar(address token, address a, uint256 monto) private {
        if (monto != 0) _llamarToken(token, abi.encodeWithSelector(0x095ea7b3, a, 0)); // approve(address,uint256)
        _llamarToken(token, abi.encodeWithSelector(0x095ea7b3, a, monto));
    }

    /// @dev Acepta tokens que devuelven `true` y tokens que no devuelven nada (USDT); rechaza `false`,
    ///      la reversión y una dirección sin código (que en un `call` "funciona" sin hacer nada).
    function _llamarToken(address token, bytes memory datos) private {
        if (token.code.length == 0) revert FalloPago();
        (bool ok, bytes memory ret) = token.call(datos);
        if (!ok || (ret.length != 0 && (ret.length != 32 || abi.decode(ret, (uint256)) != 1))) revert FalloPago();
    }
}
