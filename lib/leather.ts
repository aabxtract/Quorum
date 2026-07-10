// Shared Leather / Hiro wallet helpers. Used by:
//   - auth/page.tsx           (Sign in with wallet, Sign up + add wallet)
//   - account/page.tsx        (Link wallet to email account)
//   - lib/wallet-context.tsx  (Global wallet connection for staking)
//
// All three flows must use the SAME SIP-030 API so a wallet the user
// authorised at login is still authorised when they click Stake.

export function getLeatherProvider(): any {
  if (typeof window === 'undefined') return undefined
  const w = window as any
  return w.LeatherProvider ?? w.HiroWalletProvider ?? w.StacksProvider
}

/**
 * Ask Leather for the user's STX address via SIP-030 `getAddresses`.
 * Returns the address on success, `null` if the user cancelled, or throws
 * if Leather isn't installed.
 */
export async function requestLeatherStxAddress(): Promise<string | null> {
  const provider = getLeatherProvider()
  if (!provider || typeof provider.request !== 'function') {
    throw new Error(
      'Leather/Hiro Wallet not detected. Install the Leather extension (https://leather.io) and reload the page.'
    )
  }

  const response = await provider.request('getAddresses')

  if (response?.error) {
    const e = response.error
    if (e.code === 4001) return null
    throw new Error(`Leather ${e.code}: ${e.message}`)
  }

  const addresses: any[] = response?.result?.addresses ?? []
  const stx = addresses.find(
    (a) => a.symbol === 'STX' || (typeof a.address === 'string' && a.address.startsWith('S'))
  )
  return stx?.address ?? null
}
