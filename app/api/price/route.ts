import { NextRequest, NextResponse } from 'next/server'
import { getPrice } from '@/lib/price'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get('symbol') || 'STXUSDT'
    const price = await getPrice(symbol)
    
    return NextResponse.json({ 
      symbol, 
      price, 
      timestamp: new Date().toISOString() 
    })
  } catch (error) {
    console.error('Error fetching price:', error)
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}
