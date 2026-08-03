// Compila WriterAllowlist.sol con solc, lo despliega en anvil y autoriza SOLO a wallet A.
// Escribe deployed.json con { rpcUrl, contractAddress } para que lo lea el test.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Wallet, JsonRpcProvider, ContractFactory, Contract, NonceManager } from 'ethers'
import { RPC_URL, DEPLOYER_PK, WALLET_A_PK, WALLET_B_PK } from './test-wallets.js'

// solc vive en el proyecto padre
const require = createRequire('/Users/xunorus/xunserver/chatWallet/')
const solc = require('solc')

const source = readFileSync(new URL('./contracts/WriterAllowlist.sol', import.meta.url), 'utf8')
const input = {
  language: 'Solidity',
  sources: { 'WriterAllowlist.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
}
const out = JSON.parse(solc.compile(JSON.stringify(input)))
if (out.errors) {
  const fatal = out.errors.filter((e) => e.severity === 'error')
  if (fatal.length) { console.error(fatal.map((e) => e.formattedMessage).join('\n')); process.exit(1) }
}
const artifact = out.contracts['WriterAllowlist.sol'].WriterAllowlist
const abi = artifact.abi
const bytecode = artifact.evm.bytecode.object
console.log('✓ Contrato compilado')

const provider = new JsonRpcProvider(RPC_URL)
const deployer = new Wallet(DEPLOYER_PK, provider)
const walletA = new Wallet(WALLET_A_PK)
const walletB = new Wallet(WALLET_B_PK)

const factory = new ContractFactory(abi, bytecode, deployer)
const contract = await factory.deploy()
await contract.waitForDeployment()
const contractAddress = await contract.getAddress()
console.log('✓ Desplegado en', contractAddress, '(owner =', deployer.address + ')')

// Autorizar SOLO a wallet A (nonce explícito tras minar el deploy)
const c = new Contract(contractAddress, abi, deployer)
const nonce = await provider.getTransactionCount(deployer.address, 'latest')
await (await c.setWriter(walletA.address, true, { nonce })).wait()
console.log('✓ Autorizada wallet A:', walletA.address)
console.log('  (wallet B NO autorizada:', walletB.address + ')')
console.log('  isWriter(A) =', await c.isWriter(walletA.address))
console.log('  isWriter(B) =', await c.isWriter(walletB.address))

writeFileSync(
  new URL('./deployed.json', import.meta.url),
  JSON.stringify({ rpcUrl: RPC_URL, contractAddress }, null, 2)
)
console.log('✓ deployed.json escrito')
