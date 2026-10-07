// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// ERC-20 común: devuelve bool.
contract TokenNormal {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address a, uint256 v) external { balanceOf[a] += v; }

    function transfer(address a, uint256 v) external returns (bool) {
        balanceOf[msg.sender] -= v;
        balanceOf[a] += v;
        return true;
    }

    function approve(address a, uint256 v) external returns (bool) {
        allowance[msg.sender][a] = v;
        return true;
    }

    function transferFrom(address de, address a, uint256 v) external returns (bool) {
        allowance[de][msg.sender] -= v;
        balanceOf[de] -= v;
        balanceOf[a] += v;
        return true;
    }
}

/// Como USDT: transfer/approve NO devuelven nada, y approve exige pasar por cero.
contract TokenTipoUSDT {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address a, uint256 v) external { balanceOf[a] += v; }

    function transfer(address a, uint256 v) external {
        require(balanceOf[msg.sender] >= v);
        balanceOf[msg.sender] -= v;
        balanceOf[a] += v;
    }

    function approve(address a, uint256 v) external {
        require(v == 0 || allowance[msg.sender][a] == 0, "USDT: primero a cero");
        allowance[msg.sender][a] = v;
    }

    function transferFrom(address de, address a, uint256 v) external {
        require(allowance[de][msg.sender] >= v && balanceOf[de] >= v);
        allowance[de][msg.sender] -= v;
        balanceOf[de] -= v;
        balanceOf[a] += v;
    }
}

/// Devuelve false en vez de revertir.
contract TokenFalso {
    mapping(address => uint256) public balanceOf;

    function mint(address a, uint256 v) external { balanceOf[a] += v; }
    function transfer(address, uint256) external pure returns (bool) { return false; }
}

/// Un "pool" que toma el depósito con transferFrom (o recibe nativo) y anota a quién acreditó.
contract DepositoFalso {
    mapping(bytes32 => uint256) public notas;

    function depositar(address token, uint256 monto, bytes32 nota) external payable {
        if (token == address(0)) {
            require(msg.value == monto, "valor");
        } else {
            // Llamada de bajo nivel: tiene que servir también con tokens que no devuelven nada (USDT).
            (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(0x23b872dd, msg.sender, address(this), monto));
            require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "transferFrom");
        }
        notas[nota] += monto;
    }

    function revertir() external pure { revert("no"); }
}
