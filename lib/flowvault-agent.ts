import { FlowVault } from 'flowvault-sdk'
import {
  FLOWVAULT_CONTRACT_ADDRESS,
  FLOWVAULT_CONTRACT_NAME,
  FLOWVAULT_NETWORK,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
} from './flowvault-config'

export const agentVault = new FlowVault({
  network: FLOWVAULT_NETWORK as any,
  contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
  contractName: FLOWVAULT_CONTRACT_NAME,
  tokenContractAddress: USDCX_CONTRACT_ADDRESS,
  tokenContractName: USDCX_CONTRACT_NAME,
  senderKey:
    process.env.STACKS_PRIVATE_KEY ||
    '0x0000000000000000000000000000000000000000000000000000000000000000',
})

// Micro token conversion (USDCx = 6 decimals)
export const toMicro = (amount: number): string =>
  BigInt(Math.floor(amount * 1_000_000)).toString()

export const fromMicro = (micro: string | number): number =>
  Number(BigInt(String(micro))) / 1_000_000

export async function executeAtomicSettlement(params: {
  totalPool: number
  winnerPool: number
  loserPool: number
  winnerAddress: string
}): Promise<string> {
  const { totalPool, loserPool } = params

  const protocolFee = loserPool * 0.05
  const winnerPayout = loserPool * 0.95

  const currentBlock = await agentVault.getCurrentBlockHeight(
    process.env.STACKS_WALLET_ADDRESS || ''
  )

  // ATOMIC CYCLE — 4 steps
  await agentVault.clearRoutingRules()

  await agentVault.setRoutingRules({
    splitAddress: process.env.TREASURY_WALLET || '',
    splitAmount: toMicro(winnerPayout),
    lockAmount: toMicro(protocolFee),
    lockUntilBlock: currentBlock + 1000,
  })

  const settleTx = await agentVault.deposit(toMicro(totalPool))

  await agentVault.clearRoutingRules()

  return settleTx.txId
}

/**
 * Route a single winner payout from the agent vault to the winner's vault.
 * Uses a one-shot routing rule (split to winner, no lock), deposits the
 * payout amount, then clears the rule. Returns the on-chain tx id.
 *
 * The caller is responsible for calling clearRoutingRules() after the loop
 * finishes if it batches multiple payouts back-to-back.
 */
export async function payoutWinner(
  winnerAddress: string,
  payoutUsdcx: number
): Promise<string> {
  if (payoutUsdcx <= 0) throw new Error('payout must be positive')

  await agentVault.setRoutingRules({
    splitAddress: winnerAddress,
    splitAmount: toMicro(payoutUsdcx),
    lockAmount: '0',
    lockUntilBlock: 0,
  })

  const tx = await agentVault.deposit(toMicro(payoutUsdcx))
  return tx.txId
}
