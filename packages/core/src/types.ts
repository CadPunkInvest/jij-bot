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
}

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
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const JIJ_MINT = '14hACq5xFZQSeuXj8ggsTu8SmrBeUKZT13kPHeeTboop'
export const JIJ_DECIMALS = 9
