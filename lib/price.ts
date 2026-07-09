// CoinMarketCap quote endpoint. Binance/Coinbase are DNS-blocked in some
// regions, and Hiro doesn't publish spot prices, so CMC is the single source.

const CMC_SYMBOLS: Record<string, string> = {
  STXUSDT: 'STX',
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
}

export async function getPrice(symbol: string = 'STXUSDT'): Promise<number> {
  const cmcSymbol = CMC_SYMBOLS[symbol]
  if (!cmcSymbol) throw new Error(`Unsupported symbol ${symbol}`)

  const apiKey = process.env.COINMARKETCAP_API_KEY
  if (!apiKey) throw new Error('COINMARKETCAP_API_KEY not set')

  const res = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${cmcSymbol}&convert=USD`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(6000),
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CoinMarketCap ${res.status}: ${body}`)
  }

  const data = await res.json()
  const price = data?.data?.[cmcSymbol]?.quote?.USD?.price
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new Error('CoinMarketCap: malformed payload')
  }
  return price
}
