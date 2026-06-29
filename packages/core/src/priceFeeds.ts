import { Platform, SOL_MINT } from './types'

const PROXY_BASE = 'https://canadianpunkinvesting.com'
const DEXSCREENER_TOKEN_URL = `${PROXY_BASE}/dexscreener/tokens`
const COINGECKO_SOL_URL = `${PROXY_BASE}/coingecko/simple/price?ids=solana&vs_currencies=usd`

export interface PriceFeed {
  jijSolPrice: number
  solUsdPrice: number
  timestamp: number
}

let cachedFeed: PriceFeed | null = null
let lastFetchTime = 0
let lastGoodSolUsdPrice = 0
let lastGoodJijSolPrice = 0
const CACHE_MS = 5000

export function seedPriceCache(jijSolPrice: number, solUsdPrice: number): void {
  if (jijSolPrice > 0) lastGoodJijSolPrice = jijSolPrice
  if (solUsdPrice > 0) lastGoodSolUsdPrice = solUsdPrice
}

export async function fetchPrices(jijMint: string, platform: Platform): Promise<PriceFeed> {
  const now = Date.now()
  if (cachedFeed && now - lastFetchTime < CACHE_MS) return cachedFeed

  let jijSolPrice: number
  try {
    const result = await fetchFromDexscreener(jijMint, platform)
    jijSolPrice = result.jijSolPrice
    lastGoodJijSolPrice = jijSolPrice
  } catch (err) {
    if (lastGoodJijSolPrice > 0) {
      jijSolPrice = lastGoodJijSolPrice
    } else {
      throw err
    }
  }

  let solUsdPrice: number
  try {
    solUsdPrice = await fetchSolUsdFromCoinGecko(platform)
    lastGoodSolUsdPrice = solUsdPrice
  } catch {
    solUsdPrice = lastGoodSolUsdPrice
  }

  cachedFeed = { jijSolPrice, solUsdPrice, timestamp: now }
  lastFetchTime = now
  return cachedFeed
}

async function fetchFromDexscreener(jijMint: string, platform: Platform): Promise<{ jijSolPrice: number; jijUsdPrice: number }> {
  const res = await platform.http.get(`${DEXSCREENER_TOKEN_URL}/${jijMint}`)
  if (res.status !== 200) throw new Error(`Dexscreener fetch failed: ${res.status}`)
  const json = res.data as Record<string, unknown>

  interface DexPair {
    priceNative: string
    priceUsd: string
    quoteToken: { address: string }
  }

  const pairs: DexPair[] = (json.pairs as DexPair[] | undefined) ?? []
  if (pairs.length === 0) throw new Error('No pairs returned from Dexscreener')

  const solPair = pairs.find(p => p.quoteToken.address === SOL_MINT) ?? pairs[0]
  const jijSolPrice = parseFloat(solPair.priceNative)
  const jijUsdPrice = parseFloat(solPair.priceUsd)
  if (!jijSolPrice || !jijUsdPrice) throw new Error('Dexscreener returned invalid prices')
  return { jijSolPrice, jijUsdPrice }
}

async function fetchSolUsdFromCoinGecko(platform: Platform): Promise<number> {
  const res = await platform.http.get(COINGECKO_SOL_URL)
  if (res.status !== 200) throw new Error(`CoinGecko fetch failed: ${res.status}`)
  const json = res.data as { solana: { usd: number } }
  const price = json?.solana?.usd
  if (!price) throw new Error('CoinGecko returned invalid SOL price')
  return price
}
