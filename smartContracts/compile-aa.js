import solc from 'solc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para importar de node_modules (@openzeppelin)
const findImports = (importPath) => {
    try {
        if (importPath.startsWith('@openzeppelin')) {
            const fullPath = path.resolve(__dirname, '..', 'node_modules', importPath);
            return { contents: fs.readFileSync(fullPath, 'utf8') };
        }
        const fullPath = path.resolve(__dirname, importPath);
        return { contents: fs.readFileSync(fullPath, 'utf8') };
    } catch (error) {
        return { error: 'File not found: ' + importPath };
    }
};

const compile = (filename) => {
    const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
    const input = {
        language: 'Solidity',
        sources: { [filename]: { content: source } },
        settings: { outputSelection: { '*': { '*': ['*'] } } }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    if (output.errors) {
        output.errors.forEach(err => console.error(err.formattedMessage));
    }
    return output.contracts[filename];
};

console.log('Compilando contratos AA...');
const accountContract = compile('ChatSmartAccount.sol').ChatSmartAccount;
const factoryContract = compile('ChatSmartAccountFactory.sol').ChatSmartAccountFactory;

fs.writeFileSync(path.resolve(__dirname, 'ChatSmartAccount.abi.json'), JSON.stringify(accountContract.abi, null, 2));
fs.writeFileSync(path.resolve(__dirname, 'ChatSmartAccountFactory.abi.json'), JSON.stringify(factoryContract.abi, null, 2));
fs.writeFileSync(path.resolve(__dirname, 'ChatSmartAccountFactory.bytecode.json'), JSON.stringify(factoryContract.evm.bytecode.object, null, 2));

console.log('Compilación AA completa. Archivos .abi.json generados.');
