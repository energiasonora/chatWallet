import solc from 'solc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractPath = path.resolve(__dirname, 'Subscription.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'Subscription.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const findImports = (importPath) => {
    try {
        const fullPath = require.resolve(importPath);
        return { contents: fs.readFileSync(fullPath, 'utf8') };
    } catch (error) {
        return { error: 'File not found' };
    }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

const contract = output.contracts['Subscription.sol'].Subscription;

const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

fs.writeFileSync(path.resolve(__dirname, 'Subscription.abi.json'), JSON.stringify(abi, null, 2));
fs.writeFileSync(path.resolve(__dirname, 'Subscription.bytecode.json'), JSON.stringify(bytecode, null, 2));

console.log('Contract compiled successfully. ABI and bytecode saved.');
