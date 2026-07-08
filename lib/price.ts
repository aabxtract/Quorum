export async function getPrice(symbol: string = 'STXUSDT'): Promise<number> {
  const res = await fetch(
    `${process.env.BINANCE_API || 'https://api.binance.com/api/v3'}/ticker/price?symbol=${symbol}`,
    { next: { revalidate: 0 } }
  )
  const data = await res.json()
  return parseFloat(data.price)
}
