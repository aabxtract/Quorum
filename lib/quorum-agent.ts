// Server-side calls to the Quorum market registry contract.
// Handles market creation, stake recording, and resolution on-chain.
// Actual token movement (deposits + payouts) is handled by FlowVault.

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringAsciiCV,
  uintCV,
  standardPrincipalCV,
} from '@stacks/transactions'
import { StacksTestnet, StacksMainnet } from '@stacks/network'
import {
  QUORUM_CONTRACT_ADDRESS,
  QUORUM_CONTRACT_NAME,
  STACKS_NETWORK,
} from './quorum-config'

export const toMicro  = (amount: number): bigint => BigInt(Math.floor(amount * 1_000_000))
export const fromMicro = (micro: string | number): number => Number(BigInt(String(micro))) / 1_000_000

// Contract side encoding: u1 = YES, u0 = NO
const SIDE_YES = 1n
const SIDE_NO  = 0n

function getNetwork() {
  return STACKS_NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet()
}

function requirePrivateKey(): string {
  const raw = process.env.STACKS_PRIVATE_KEY || ''
  if (!raw || raw.includes(' ')) {
    throw new Error(
      'STACKS_PRIVATE_KEY must be a 64-char hex key. ' +
      'Generate with: npx @stacks/cli make_keychain -t  then copy privateKey'
    )
  }
  return raw
}

async function callContract(functionName: string, functionArgs: any[]): Promise<string> {
  const tx = await makeContractCall({
    contractAddress: QUORUM_CONTRACT_ADDRESS,
    contractName: QUORUM_CONTRACT_NAME,
    functionName,
    functionArgs,
    senderKey: requirePrivateKey(),
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  })

  const result = await broadcastTransaction(tx, getNetwork())
  if ('error' in result) {
    throw new Error(`Broadcast failed [${functionName}]: ${(result as any).error} — ${(result as any).reason}`)
  }
  return (result as any).txid as string
}

// ── Create market on-chain registry ───────────────────────────
export async function createMarketOnChain(marketId: string): Promise<string> {
  return callContract('create-market', [stringAsciiCV(marketId)])
}

// ── Record a confirmed FlowVault stake on-chain ───────────────
// Called after the user's deposit tx is confirmed on Stacks.
export async function recordStakeOnChain(
  marketId: string,
  stakerAddress: string,
  side: 'yes' | 'no',
  amountUsdcx: number
): Promise<string> {
  return callContract('record-stake', [
    stringAsciiCV(marketId),
    standardPrincipalCV(stakerAddress),
    uintCV(side === 'yes' ? SIDE_YES : SIDE_NO),
    uintCV(toMicro(amountUsdcx)),
  ])
}

// ── Resolve market on-chain registry ──────────────────────────
// Marks the market resolved on-chain. FlowVault routing handles actual payouts.
export async function resolveMarketOnChain(
  marketId: string,
  winningSide: 'yes' | 'no',
  resolutionPrice: number
): Promise<string> {
  return callContract('resolve-market', [
    stringAsciiCV(marketId),
    uintCV(winningSide === 'yes' ? SIDE_YES : SIDE_NO),
    uintCV(BigInt(Math.round(resolutionPrice * 1e8))),
  ])
}

// ── Mark winner paid out on-chain ─────────────────────────────
// Called after FlowVault payout tx confirms.
export async function markPaidOutOnChain(
  marketId: string,
  stakerAddress: string
): Promise<string> {
  return callContract('mark-paid-out', [
    stringAsciiCV(marketId),
    standardPrincipalCV(stakerAddress),
  ])
}
