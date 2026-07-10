import { FlowVault } from 'flowvault-sdk'
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  TransactionVersion,
  getAddressFromPrivateKey,
  uintCV,
  standardPrincipalCV,
  noneCV,
} from '@stacks/transactions'
import { StacksTestnet, StacksMainnet } from '@stacks/network'
import {
  FLOWVAULT_CONTRACT_ADDRESS,
  FLOWVAULT_CONTRACT_NAME,
  FLOWVAULT_NETWORK,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
} from './flowvault-config'

// Lazy singleton — Next.js "collect page data" build step evaluates modules
// without runtime env vars, and the SDK's URL parsing chokes if we init at
// module scope. Only construct on first use.
let _agentVault: FlowVault | null = null

function requireHexPrivateKey(): string {
  const raw = process.env.STACKS_PRIVATE_KEY || ''
  // A valid Stacks private key is a 64-char hex string (optionally suffixed
  // with '01' for compressed = 66 chars). A mnemonic has spaces; reject it
  // clearly so the error surfaces in logs rather than as a cryptic broadcast
  // failure from @stacks/transactions.
  if (!raw || raw.includes(' ')) {
    throw new Error(
      'STACKS_PRIVATE_KEY must be a 64-char hex private key, not a mnemonic. ' +
      'Derive it from your seed phrase with: ' +
      'npx @stacks/cli make_keychain -t (testnet) then copy "privateKey".'
    )
  }
  return raw
}

function requireAgentAddress(): string {
  if (process.env.STACKS_WALLET_ADDRESS) return process.env.STACKS_WALLET_ADDRESS
  const txVersion = FLOWVAULT_NETWORK === 'mainnet' ? TransactionVersion.Mainnet : TransactionVersion.Testnet
  return getAddressFromPrivateKey(requireHexPrivateKey(), txVersion)
}

function getStacksNetwork() {
  return FLOWVAULT_NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet()
}

export function getAgentVault(): FlowVault {
  if (!_agentVault) {
    _agentVault = new FlowVault({
      network: FLOWVAULT_NETWORK as any,
      contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
      contractName: FLOWVAULT_CONTRACT_NAME,
      tokenContractAddress: USDCX_CONTRACT_ADDRESS,
      tokenContractName: USDCX_CONTRACT_NAME,
      senderKey: requireHexPrivateKey(),
    })
  }
  return _agentVault
}

// Proxy so existing `agentVault.deposit(...)` style imports keep working
// without invoking the constructor at import time.
export const agentVault: FlowVault = new Proxy({} as FlowVault, {
  get(_target, prop) {
    const v = getAgentVault() as any
    const val = v[prop]
    return typeof val === 'function' ? val.bind(v) : val
  },
})

// Micro token conversion (USDCx = 6 decimals)
export const toMicro = (amount: number): string =>
  BigInt(Math.floor(amount * 1_000_000)).toString()

export const fromMicro = (micro: string | number): number =>
  Number(BigInt(String(micro))) / 1_000_000

/**
 * Send USDCx from the agent wallet directly to a winner via SIP-010 transfer.
 * The agent wallet already holds the staked USDCx (routed from user deposits via
 * FlowVault split rules). This bypasses the FlowVault vault entirely — no
 * token allowance needed, no deposit()+split dance.
 *
 * Returns the on-chain tx id.
 */
export async function payoutWinner(
  winnerAddress: string,
  payoutUsdcx: number
): Promise<string> {
  if (payoutUsdcx <= 0) throw new Error('payout must be positive')

  const microAmount = BigInt(Math.floor(payoutUsdcx * 1_000_000))
  const senderKey = requireHexPrivateKey()
  const agentAddress = requireAgentAddress()
  const network = getStacksNetwork()

  const tx = await makeContractCall({
    contractAddress: USDCX_CONTRACT_ADDRESS,
    contractName: USDCX_CONTRACT_NAME,
    functionName: 'transfer',
    functionArgs: [
      uintCV(microAmount),
      standardPrincipalCV(agentAddress),
      standardPrincipalCV(winnerAddress),
      noneCV(),
    ],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  })

  const result = await broadcastTransaction(tx, network)
  if ('error' in result && result.error) {
    throw new Error(`USDCx transfer failed: ${result.error} — ${result.reason || ''}`)
  }

  return result.txid as string
}
