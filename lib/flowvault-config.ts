// Single source of truth for FlowVault contract wiring.
// Accepts either:
//   NEXT_PUBLIC_FLOWVAULT_CONTRACT=SP<addr>.flowvault-v2      ← primary (compact form)
//   NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS / _CONTRACT_NAME   ← legacy fallback
// Same for the USDCx token. Falls back to hardcoded testnet defaults so dev
// works even with no env at all.

const DEFAULT_FLOWVAULT = 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2'
const DEFAULT_USDCX = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx'

function parseCompact(compact: string | undefined, fallback: string): { address: string; name: string } {
  const raw = (compact && compact.includes('.') ? compact : fallback).trim()
  const dot = raw.indexOf('.')
  return {
    address: raw.slice(0, dot),
    name: raw.slice(dot + 1),
  }
}

function resolveContract(
  compactEnv: string | undefined,
  addrEnv: string | undefined,
  nameEnv: string | undefined,
  defaultCompact: string,
  defaultName: string
) {
  if (compactEnv && compactEnv.includes('.')) {
    return parseCompact(compactEnv, defaultCompact)
  }
  if (addrEnv) {
    return { address: addrEnv, name: nameEnv || defaultName }
  }
  return parseCompact(undefined, defaultCompact)
}

const vault = resolveContract(
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT,
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS,
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME,
  DEFAULT_FLOWVAULT,
  'flowvault-v2'
)

const token = resolveContract(
  process.env.NEXT_PUBLIC_USDCX_CONTRACT,
  process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
  process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME,
  DEFAULT_USDCX,
  'usdcx'
)

export const FLOWVAULT_NETWORK =
  (process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK ||
    process.env.NEXT_PUBLIC_STACKS_NETWORK ||
    'testnet') as 'testnet' | 'mainnet'

export const FLOWVAULT_CONTRACT_ADDRESS = vault.address
export const FLOWVAULT_CONTRACT_NAME = vault.name
export const USDCX_CONTRACT_ADDRESS = token.address
export const USDCX_CONTRACT_NAME = token.name
