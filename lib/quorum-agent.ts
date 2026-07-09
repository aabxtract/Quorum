// Server-side agent contract calls for the Quorum market contract.
// Uses @stacks/transactions to sign + broadcast without a wallet UI.

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringAsciiCV,
  uintCV,
  contractPrincipalCV,
  standardPrincipalCV,
} from '@stacks/transactions'
import { StacksTestnet, StacksMainnet } from '@stacks/network'
import {
  QUORUM_CONTRACT_ADDRESS,
  QUORUM_CONTRACT_NAME,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
  STACKS_NETWORK,
} from './quorum-config'

// Micro-USDCx helpers (6 decimals)
export const toMicro = (amount: number): bigint =>
  BigInt(Math.floor(amount * 1_000_000))

export const fromMicro = (micro: string | number): number =>
  Number(BigInt(String(micro))) / 1_000_000

function getNetwork() {
  return STACKS_NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet()
}

function requirePrivateKey(): string {
  const raw = process.env.STACKS_PRIVATE_KEY || ''
  if (!raw || raw.includes(' ')) {
    throw new Error(
      'STACKS_PRIVATE_KEY must be a 64-char hex key. ' +
      'Generate one with: npx @stacks/cli make_keychain -t  (then copy privateKey)'
    )
  }
  return raw
}

async function callContract(
  functionName: string,
  functionArgs: any[]
): Promise<string> {
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

// ── Create market ────────────────────────────────────────────────────────────
// Call once when a market is saved to the DB. The agent wallet must be set as
// the authorised agent on the contract (via set-agent).
export async function createMarketOnChain(marketId: string): Promise<string> {
  return callContract('create-market', [stringAsciiCV(marketId)])
}

// ── Resolve market ───────────────────────────────────────────────────────────
// winningSide: 'yes' | 'no'
// resolutionPrice: actual price * 1e8 (e.g. BTC $62345.78 → 6234578000000)
export async function resolveMarketOnChain(
  marketId: string,
  winningSide: 'yes' | 'no',
  resolutionPrice: number
): Promise<string> {
  return callContract('resolve-market', [
    stringAsciiCV(marketId),
    stringAsciiCV(winningSide),
    uintCV(BigInt(Math.round(resolutionPrice * 1e8))),
  ])
}

// ── Payout winner ────────────────────────────────────────────────────────────
// side: 'yes' | 'no' — determines which contract function to call
// payoutUsdcx: full payout in USDCx (not micro)
export async function payoutWinnerOnChain(
  marketId: string,
  stakerAddress: string,
  payoutUsdcx: number,
  side: 'yes' | 'no'
): Promise<string> {
  const fnName = side === 'yes' ? 'payout-winner' : 'payout-winner-no'
  return callContract(fnName, [
    contractPrincipalCV(USDCX_CONTRACT_ADDRESS, USDCX_CONTRACT_NAME),
    stringAsciiCV(marketId),
    standardPrincipalCV(stakerAddress),
    uintCV(toMicro(payoutUsdcx)),
  ])
}
