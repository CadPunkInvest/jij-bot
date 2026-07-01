import { Transaction, VersionedTransaction } from '@solana/web3.js'

export type DCAStatus = 'on' | 'off' | 'deactivated'

export interface Platform {
  storage: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
    readFile?(path: string): Promise<string>
    writeFile?(path: string, content: string): Promise<void>
  }
  wallet: {
    connect(): Promise<string>
    signAndSend(tx: Transaction | VersionedTransaction): Promise<string>
    getBalance(mint?: string): Promise<number>
    getTokenAccount(mint: string): Promise<string | null>
    disconnect(): Promise<void>
    withdrawToken(mint: string, toAddress: string, rawAmount: bigint): Promise<string>
  }
  notify: {
    send(title: string, body: string): Promise<void>
    scheduleAt(time: number, title: string, body: string): Promise<void>
    cancelAll(): Promise<void>
  }
  scheduler: {
    setMidnightCallback(fn: () => void): void
    setTimeoutAt(time: number, fn: () => void): void
  }
  http: {
    get(url: string): Promise<{ status: number; data: unknown }>
    post(url: string, body: unknown): Promise<{ status: number; data: unknown }>
  }
  exportPrivateKey?(): Promise<string>
}

export interface GridOrder {
  id: string
  level: number
  price: number
  side: 'buy' | 'sell'
  quantity: number
  filled: boolean
  txSignature?: string
  timestamp: number
}

export interface DCABuyEvent {
  id: string
  timestamp: number
  solSpent: number
  jijReceived: number
  solUsdPrice: number
  usdValue: number
  poolRemainingSOL: number
  txSignature: string
}

export interface TaxEvent {
  id: string
  timestamp: number
  eventType: 'GRID_PROFIT' | 'DCA_BUY' | 'MANUAL'
  profitSOL: number
  profitUSD: number
  solUsdPriceAtTime: number
  taxReservedSOL: number
  usdcReceived: number
  swapTxSignature: string
  reservePct: number
}

export type LogEventType =
  | 'DCA_BUY'
  | 'DCA_SKIP'
  | 'DCA_STATE_CHANGE'
  | 'TAX_RESERVE'
  | 'GRID_FILL'
  | 'TRAIL_SHIFT'
  | 'PROFIT_ROUTE'
  | 'ERROR'
  | 'INFO'
  | 'SAFETY'

export interface LogEntry {
  id: string
  timestamp: number
  type: LogEventType
  message: string
  data?: Record<string, unknown>
}

export interface BotConfig {
  // User-facing inputs (the only two the user sets)
  gridSOL: number              // SOL committed to the grid bot
  dailyDCALimitUSD: number     // max USD to spend per day on DCA buys

  // Auto-calculated at start (hidden from user)
  gridLower: number
  gridUpper: number
  entryPrice: number

  // Fixed system constants (hidden from user)
  gridLevels: number
  taxReservePct: number
  trailSensitivity: number
  minBufferToShift: number
  slippageBps: number
  taxSwapSlippageBps: number
  minSOLReserve: number
  pollingIntervalSec: number
  rpcEndpoint: string

  // Charity Bot (MAPLE) only
  veritreeSendIntervalDays: number   // e.g. 30 for monthly — caretaker-configurable cadence
}

export interface BotState {
  gridReserve: number
  seedSOL: number
  dcaPool: number
  trailBuffer: number
  pendingTaxReserveSOL: number

  dcaStatus: DCAStatus
  randomBuyTime: number
  lastDCABuy: number
  totalDCABuys: number
  totalJIJviaDCA: number
  todayBuyExecuted: boolean
  dcaBuyHistory: DCABuyEvent[]

  taxReserveUSDC: number
  taxEvents: TaxEvent[]

  gridLower: number
  gridUpper: number
  gridLevels: number
  gridStep: number
  quantityPerGrid: number
  openOrders: GridOrder[]
  highWaterMark: number

  realizedPnLSOL: number
  realizedPnLUSD: number
  totalGridFills: number
  sessionStartValue: number
  activityLog: LogEntry[]

  config: BotConfig
  walletPublicKey: string | null
  botRunning: boolean
  lastPriceSOL: number
  lastSolUsdPrice: number
  lastPollTime: number
  gridFormatVersion: number

  // 3x-daily random grid format switch — one slot per 8-hour window (9am/5pm/1am anchors)
  gridFormatCycleAnchor: number
  gridFormatSwitchTimes: [number, number, number]
  gridFormatSwitchExecuted: [boolean, boolean, boolean]
  gridFormatWindowOffsets: [number, number, number]

  // "The Cause" — optional profit-skim pool, 0 = deactivated
  causePct: number
  causePool: number
  totalCauseDonatedSOL: number

  // Charity Bot (MAPLE) only — personal bots never populate these.
  trailSegments: TrailSegment[]        // [] = legacy single-buffer trail mode (personal bots)
  veritreePool: number                 // USDC — accumulates toward veritreeThresholdUSDC
  pendingVeritreeSOL: number           // queued SOL→USDC swap retry, mirrors pendingTaxReserveSOL
  cloneBuffer: number                  // USDC — reserved to arm a future Clone Bot
  pendingCloneSOL: number              // queued SOL→USDC swap retry
  veritreePoolStatus: DCAStatus        // 'off' = accumulate only
  veritreeThresholdUSDC: number | null
  veritreeDepositAddress: string
  veritreeNextSendCheck: number        // epoch ms — next time the interval schedule checks/sends

  donationPool: number                 // SOL — inbound donations awaiting the daily 9am tiered buy
  donationBuyTime: number              // next scheduled 9am epoch ms
  donationBuyExecutedToday: boolean

  gridArmed: boolean                   // false until accumulated capital first crosses MIN_GRID_SOL
}

export interface TrailSegment {
  capacitySOL: number
  filledSOL: number
  deployed: boolean
}

export const DEFAULT_CONFIG: BotConfig = {
  gridSOL: 0,
  dailyDCALimitUSD: 50,
  gridLower: 0,
  gridUpper: 0,
  entryPrice: 0,
  gridLevels: 20,
  taxReservePct: 50,
  trailSensitivity: 0.07,
  minBufferToShift: 0.05,
  slippageBps: 500,
  taxSwapSlippageBps: 200,
  minSOLReserve: 0.05,
  pollingIntervalSec: 10,
  rpcEndpoint: 'https://rpc.ankr.com/solana',
  veritreeSendIntervalDays: 30,
}

export const GRID_DENSITIES = [20, 40, 60] as const

export const MIN_GRID_SOL = 0.1
export const RECOMMENDED_GRID_SOL = 0.25
export const GRID_RANGE_PCT = 0.40   // ±40% from entry price
export const TRAIL_BUFFER_PCT = 0.15 // 15% of gridSOL reserved for trail

export const DEFAULT_STATE: BotState = {
  gridReserve: 0,
  seedSOL: 0,
  dcaPool: 0,
  trailBuffer: 0,
  pendingTaxReserveSOL: 0,
  dcaStatus: 'off',
  randomBuyTime: 0,
  lastDCABuy: 0,
  totalDCABuys: 0,
  totalJIJviaDCA: 0,
  todayBuyExecuted: false,
  dcaBuyHistory: [],
  taxReserveUSDC: 0,
  taxEvents: [],
  gridLower: 0,
  gridUpper: 0,
  gridLevels: 20,
  gridStep: 0,
  quantityPerGrid: 0,
  openOrders: [],
  highWaterMark: 0,
  realizedPnLSOL: 0,
  realizedPnLUSD: 0,
  totalGridFills: 0,
  sessionStartValue: 0,
  activityLog: [],
  config: DEFAULT_CONFIG,
  walletPublicKey: null,
  botRunning: false,
  lastPriceSOL: 0,
  lastSolUsdPrice: 0,
  lastPollTime: 0,
  gridFormatVersion: 1,
  gridFormatCycleAnchor: 0,
  gridFormatSwitchTimes: [0, 0, 0],
  gridFormatSwitchExecuted: [false, false, false],
  gridFormatWindowOffsets: [-1, -1, -1],
  causePct: 1,
  causePool: 0,
  totalCauseDonatedSOL: 0,
  trailSegments: [],
  veritreePool: 0,
  pendingVeritreeSOL: 0,
  cloneBuffer: 0,
  pendingCloneSOL: 0,
  veritreePoolStatus: 'off',
  veritreeThresholdUSDC: null,
  veritreeDepositAddress: '',
  veritreeNextSendCheck: 0,
  donationPool: 0,
  donationBuyTime: 0,
  donationBuyExecutedToday: false,
  gridArmed: false,
}

export const MAX_TRAIL_SEGMENTS = 10

export const TRAIL_SEGMENT_TIERS: { maxValueSOL: number; segmentSOL: number }[] = [
  { maxValueSOL: 5, segmentSOL: 1 },
  { maxValueSOL: 15, segmentSOL: 2 },
  { maxValueSOL: 30, segmentSOL: 5 },
  { maxValueSOL: 75, segmentSOL: 10 },
  { maxValueSOL: 150, segmentSOL: 20 },
  { maxValueSOL: 300, segmentSOL: 35 },
  { maxValueSOL: Infinity, segmentSOL: 50 },
]

export const DONATION_TIERS_USD: { maxBalanceUSD: number; dailyBuyUSD: number }[] = [
  { maxBalanceUSD: 500, dailyBuyUSD: 100 },
  { maxBalanceUSD: 2000, dailyBuyUSD: 250 },
  { maxBalanceUSD: 5000, dailyBuyUSD: 500 },
  { maxBalanceUSD: 10000, dailyBuyUSD: 1000 },
  { maxBalanceUSD: 25000, dailyBuyUSD: 2000 },
  { maxBalanceUSD: Infinity, dailyBuyUSD: 5000 },
]

export const MIN_DONATION_BUY_USD = 10

// Relative weights across the five post-tax pools (Grid : Veritree : DCA : Trail : Clone).
// Normalized at use-site so they always fill exactly 100% of whatever remains after tax,
// regardless of the caretaker's configured tax rate.
export const CHARITY_POOL_WEIGHTS = {
  grid: 16,
  veritree: 16,
  dca: 12,
  trail: 12,
  clone: 8,
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const JIJ_MINT = '14hACq5xFZQSeuXj8ggsTu8SmrBeUKZT13kPHeeTboop'
export const JIJ_DECIMALS = 9

// The Cause — M.A.P.L.E. charity bot's SOL donation address
export const MAPLE_DONATION_ADDRESS = 'BkzvviyRTv3RnPpjGQtM5AcfJbGMUVA4SfCcvhL5Tq55'
