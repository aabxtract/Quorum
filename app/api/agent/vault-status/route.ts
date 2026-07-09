import { NextResponse } from 'next/server'
import { agentVault, fromMicro } from '@/lib/flowvault-agent'

// Health-check for the operator wallet + vault. Hit this before demos to make
// sure the agent side of settlement is actually funded and reachable.
export async function GET() {
  const address = process.env.STACKS_WALLET_ADDRESS
  const hasPrivateKey = Boolean(process.env.STACKS_PRIVATE_KEY)
  const treasury = process.env.TREASURY_WALLET

  const env = {
    STACKS_WALLET_ADDRESS: address || null,
    STACKS_PRIVATE_KEY_set: hasPrivateKey,
    TREASURY_WALLET: treasury || null,
    NEXT_PUBLIC_FLOWVAULT_NETWORK: process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK || 'testnet',
  }

  if (!address) {
    return NextResponse.json(
      { ok: false, env, error: 'STACKS_WALLET_ADDRESS not set' },
      { status: 200 }
    )
  }

  try {
    const [state, block, rules] = await Promise.all([
      agentVault.getVaultState(address),
      agentVault.getCurrentBlockHeight(address),
      agentVault.getRoutingRules(address).catch(() => null),
    ])

    const s = state as any
    return NextResponse.json({
      ok: true,
      env,
      vault: {
        unlocked_micro: s?.unlocked ?? '0',
        unlocked_usdcx: fromMicro(s?.unlocked ?? '0'),
        locked_micro: s?.locked ?? '0',
        locked_usdcx: fromMicro(s?.locked ?? '0'),
      },
      currentBlock: Number(block),
      routingRules: rules,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, env, error: err?.message || String(err) },
      { status: 200 }
    )
  }
}
