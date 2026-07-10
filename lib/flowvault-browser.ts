import {
  FLOWVAULT_NETWORK,
  FLOWVAULT_CONTRACT_ADDRESS,
  FLOWVAULT_CONTRACT_NAME,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
} from './flowvault-config'
import { FlowVault } from 'flowvault-sdk'
// The FlowVault SDK bundles its own @stacks/transactions v7 and builds v7-style
// Clarity Values (`{ type: 'uint', value: 1n }`). Our top-level v6 has a
// different CV shape (`{ type: ClarityType.UInt, ... }`), so v6's `cvToHex`
// silently produces garbage that Leather rejects with
// "Unable to serialize. Invalid Clarity Value". Import the SDK's bundled v7
// serialiser directly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { serializeCV } = require('flowvault-sdk/node_modules/@stacks/transactions') as {
  serializeCV: (cv: any) => string
}

const AGENT_WALLET =
  process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS ||
  'ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70'

// Pick the Leather / Hiro provider. Leather is the current name (formerly
// Hiro Wallet); the extension exposes `window.LeatherProvider` and, for
// legacy compat, `window.StacksProvider`. Newer Leather versions ignore the
// legacy `transactionRequest` JWT flow that @stacks/connect v7 uses under the
// hood, so we call Leather's SIP-030 `request` API directly.
function getLeatherProvider(): any {
  if (typeof window === 'undefined') return undefined
  const w = window as any
  return w.LeatherProvider ?? w.HiroWalletProvider ?? w.StacksProvider
}

export function createBrowserVault(senderAddress: string) {
  return new FlowVault({
    network: FLOWVAULT_NETWORK as any,
    contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_CONTRACT_NAME,
    tokenContractAddress: USDCX_CONTRACT_ADDRESS,
    tokenContractName: USDCX_CONTRACT_NAME,
    senderAddress,
    contractCallExecutor: async (call: any) => {
      const provider = getLeatherProvider()
      if (!provider || typeof provider.request !== 'function') {
        throw new Error(
          'Leather/Hiro Wallet not detected. Install the Leather extension (https://leather.io) and reload the page.'
        )
      }

      console.log('[stake] LeatherProvider.request → stx_callContract', call.functionName)

      // SIP-030 payload for Leather. functionArgs must be hex-encoded
      // Clarity values (with 0x prefix), not the CV objects the SDK builds.
      const params = {
        contract: `${call.contractAddress}.${call.contractName}`,
        functionName: call.functionName,
        functionArgs: (call.functionArgs || []).map((cv: any) => {
          const hex = serializeCV(cv)
          return hex.startsWith('0x') ? hex : `0x${hex}`
        }),
        network:
          typeof call.network === 'string'
            ? call.network
            : FLOWVAULT_NETWORK,
        postConditions: call.postConditions ?? [],
        postConditionMode: 'allow',
      }

      console.log('[stake] params:', JSON.stringify(params, null, 2))

      // Leather's SIP-030 session goes stale after ~15 min of inactivity or a
      // fresh page load. If we get "Wallet no longer available" (code 16),
      // silently call getAddresses to re-establish the session and retry ONCE.
      const attempt = async () =>
        provider.request('stx_callContract', params)

      const parseErr = (payload: any) => ({
        code: payload?.error?.code ?? payload?.code,
        message: payload?.error?.message ?? payload?.message,
        data: payload?.error?.data ?? payload?.data,
      })

      try {
        let response = await attempt()
        console.log('[stake] stx_callContract raw response:', JSON.stringify(response, null, 2))

        // Auto-recover from stale session (Leather error code 16)
        if (response?.error?.code === 16) {
          console.warn('[stake] Leather session stale — re-authorizing via getAddresses')
          try {
            await provider.request('getAddresses')
          } catch { /* user may cancel; the retry will throw the real error */ }
          response = await attempt()
          console.log('[stake] retry response:', JSON.stringify(response, null, 2))
        }

        if (response?.error) {
          const e = parseErr(response)
          console.error('[stake] Leather returned JSON-RPC error:', e)
          if (e.code === 4001) throw new Error('User cancelled')
          throw new Error(
            `Leather ${e.code}: ${e.message}${e.data ? ` — ${JSON.stringify(e.data)}` : ''}`
          )
        }

        const txId =
          response?.result?.txid ??
          response?.result?.txId ??
          response?.txid ??
          response?.txId

        if (!txId) {
          throw new Error(`Leather returned no txid: ${JSON.stringify(response)}`)
        }
        return { txId, status: 'success' } as any
      } catch (err: any) {
        const parsed = parseErr(err)
        console.error('[stake] stx_callContract threw:', { ...parsed, full: err })
        if (parsed.code === 4001) throw new Error('User cancelled')
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
  })
}

/**
 * Full stake flow executed from the user's browser wallet.
 *
 * 1. Set routing rule: split full stake amount to the agent wallet
 * 2. Deposit into user's vault — routing fires, stake lands in agent's wallet
 * 3. Clear routing rules (cleanup so next deposit isn't auto-routed)
 *
 * Returns the deposit txHash to submit to POST /api/markets/stake.
 */
export async function stakeOnMarket(
  userAddress: string,
  stakeMicro: string
): Promise<{ depositTxId: string }> {
  console.log('[stake] stakeOnMarket start', { userAddress, stakeMicro, AGENT_WALLET })
  const vault = createBrowserVault(userAddress)

  // 1. Set routing rule — split to agent wallet
  console.log('[stake] step 1: setRoutingRules')
  const rulesResult = await vault.setRoutingRules({
    splitAddress: AGENT_WALLET,
    splitAmount: stakeMicro,
    lockAmount: '0',
    lockUntilBlock: 0,
  })
  if (rulesResult.status !== 'success') {
    throw new Error(`setRoutingRules failed: ${JSON.stringify(rulesResult)}`)
  }

  // 2. Deposit — routing fires, agent receives the stake
  console.log('[stake] step 2: deposit')
  const depositResult = await vault.deposit(stakeMicro)
  if (depositResult.status !== 'success') {
    throw new Error(`deposit failed: ${JSON.stringify(depositResult)}`)
  }

  // 3. Clear routing rules
  console.log('[stake] step 3: clearRoutingRules')
  await vault.clearRoutingRules().catch(() => {})

  return { depositTxId: depositResult.txId }
}
