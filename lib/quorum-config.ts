// Contract wiring for the Quorum prediction market contract.
// Set NEXT_PUBLIC_QUORUM_CONTRACT=<deployer-addr>.quorum-market after deploying.
// Set NEXT_PUBLIC_USDCX_CONTRACT=<addr>.usdcx if using a different USDCx.

const DEFAULT_QUORUM = 'ST_DEPLOYER_PLACEHOLDER.quorum-market'
const DEFAULT_USDCX  = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx'

function parse(compact: string) {
  const dot = compact.indexOf('.')
  if (dot < 0) throw new Error(`Invalid contract identifier: ${compact}`)
  return { address: compact.slice(0, dot), name: compact.slice(dot + 1) }
}

const quorum = parse(process.env.NEXT_PUBLIC_QUORUM_CONTRACT || DEFAULT_QUORUM)
const usdcx  = parse(process.env.NEXT_PUBLIC_USDCX_CONTRACT  || DEFAULT_USDCX)

export const QUORUM_CONTRACT_ADDRESS = quorum.address
export const QUORUM_CONTRACT_NAME    = quorum.name
export const USDCX_CONTRACT_ADDRESS  = usdcx.address
export const USDCX_CONTRACT_NAME     = usdcx.name

export const STACKS_NETWORK =
  (process.env.NEXT_PUBLIC_STACKS_NETWORK || 'testnet') as 'testnet' | 'mainnet'
