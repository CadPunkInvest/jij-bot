import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  BotState,
  Platform,
  DEFAULT_STATE,
  DEFAULT_CONFIG,
  DCAStatus,
} from '@jij-bot/core'
import {
  loadState,
  saveState,
  startBots,
  stopBots,
  emergencyStop,
  topUpSOL,
  withdrawSOL,
  withdrawJiJ,
  withdrawUSDC,
  resumeBots,
  onAppResume,
  fetchPrices,
  JIJ_MINT,
  reanchorGrid,
  allocateCapital,
  initGrid,
  buildInitialOrders,
  GRID_RANGE_PCT,
} from '@jij-bot/core'
import { setDCAStatus, initDCAScheduler, setCausePct } from '@jij-bot/core'

interface BotContextValue {
  state: BotState
  platform: Platform | null
  setPlatform: (p: Platform) => void
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  startBots: () => Promise<void>
  stopBots: () => void
  emergencyStop: () => Promise<void>
  topUpSOL: (amount: number) => Promise<void>
  withdrawSOL: (toAddress: string, amountSOL?: number) => Promise<string>
  withdrawJiJ: (toAddress: string, amountJiJ?: number) => Promise<string>
  withdrawUSDC: (toAddress: string, amountUSDC?: number) => Promise<string>
  exportPrivateKey?: () => Promise<string>
  refreshBalance: () => Promise<number>
  setDCAStatus: (s: DCAStatus) => void
  setCausePct: (pct: number) => void
  updateConfig: (partial: Partial<BotState['config']>) => void
  triggerResume: () => void
  previewDashboard: () => void
  reanchorGrid: () => Promise<void>
  recoverState: (gridSOL: number, dailyDCALimitUSD: number) => Promise<void>
}

const BotContext = createContext<BotContextValue | null>(null)

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BotState>({ ...DEFAULT_STATE, config: { ...DEFAULT_CONFIG } })
  const [platform, setPlatformState] = useState<Platform | null>(null)
  const stateRef = useRef(state)
  // NOTE: stateRef.current is NOT synced from React state on every render.
  // The poll engine mutates stateRef.current directly; mutate() updates it
  // in-place so the poll engine always sees the latest version.

  // Push poll-engine mutations to React every 2 s
  useEffect(() => {
    const interval = setInterval(() => {
      setState({ ...stateRef.current })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const setPlatform = (p: Platform) => {
    setPlatformState(p)
    loadState(p).then(async loaded => {
      if (!loaded.walletPublicKey) {
        try {
          loaded.walletPublicKey = await p.wallet.connect()
          await saveState(p, loaded)
        } catch (e) {
          console.error('Wallet connect failed:', e)
        }
      }
      stateRef.current = loaded
      setState({ ...loaded })
      if (loaded.botRunning) resumeBots(loaded, p).catch(console.error)
    }).catch(e => {
      console.error('setPlatform chain failed:', e)
      p.wallet.connect()
        .then(pk => {
          stateRef.current.walletPublicKey = pk
          setState({ ...stateRef.current })
        })
        .catch(err => console.error('Fallback wallet connect failed:', err))
    })
  }

  // Mutate stateRef.current in-place so the poll engine (which holds the same
  // object reference) always sees the latest config/status values. Then save
  // and trigger a React re-render.
  const mutate = (updater: (s: BotState) => void) => {
    updater(stateRef.current)
    if (platform) saveState(platform, stateRef.current).catch(console.error)
    setState({ ...stateRef.current })
  }

  const connectWallet = async () => {
    if (!platform) throw new Error('Platform not initialized')
    const publicKey = await platform.wallet.connect()
    mutate(s => { s.walletPublicKey = publicKey })
  }

  const disconnectWallet = async () => {
    if (!platform) return
    await platform.wallet.disconnect()
    mutate(s => {
      s.walletPublicKey = null
      s.botRunning = false
    })
  }

  const handleStartBots = async () => {
    if (!platform) throw new Error('Platform not initialized')
    await startBots(stateRef.current, platform)
    setState({ ...stateRef.current })
  }

  const handleStopBots = () => {
    stopBots(stateRef.current)
    stateRef.current.botRunning = false
    if (platform) saveState(platform, stateRef.current).catch(console.error)
    setState({ ...stateRef.current })
  }

  const handleTopUp = async (amount: number) => {
    if (!platform) throw new Error('Platform not initialized')
    await topUpSOL(stateRef.current, platform, amount)
    setState({ ...stateRef.current })
  }

  const handleWithdraw = async (toAddress: string, amountSOL?: number): Promise<string> => {
    if (!platform) throw new Error('Platform not initialized')
    return withdrawSOL(stateRef.current, platform, toAddress, amountSOL)
  }

  const handleWithdrawJiJ = async (toAddress: string, amountJiJ?: number): Promise<string> => {
    if (!platform) throw new Error('Platform not initialized')
    return withdrawJiJ(stateRef.current, platform, toAddress, amountJiJ)
  }

  const handleWithdrawUSDC = async (toAddress: string, amountUSDC?: number): Promise<string> => {
    if (!platform) throw new Error('Platform not initialized')
    return withdrawUSDC(stateRef.current, platform, toAddress, amountUSDC)
  }

  const handleRefreshBalance = async (): Promise<number> => {
    if (!platform) return 0
    return platform.wallet.getBalance()
  }

  const handleEmergencyStop = async () => {
    if (!platform) return
    await emergencyStop(stateRef.current, platform)
    stateRef.current.botRunning = false
    await saveState(platform, stateRef.current)
    setState({ ...stateRef.current })
  }

  const handleSetDCAStatus = (s: DCAStatus) => {
    const wasOff = stateRef.current.dcaStatus !== 'on'
    mutate(st => setDCAStatus(st, s))
    if (s === 'on' && wasOff && platform) {
      initDCAScheduler(stateRef.current, platform)
    }
  }

  const handleSetCausePct = (pct: number) => {
    mutate(st => setCausePct(st, pct))
  }

  const updateConfig = (partial: Partial<BotState['config']>) => {
    mutate(s => { s.config = { ...s.config, ...partial } })
  }

  const triggerResume = () => {
    if (!platform) return
    // Reload lastPollTime from storage so the UI reflects the background worker's last sweep
    loadState(platform).then(saved => {
      if (saved.lastPollTime > stateRef.current.lastPollTime) {
        stateRef.current.lastPollTime = saved.lastPollTime
        setState({ ...stateRef.current })
      }
    }).catch(() => {})
    onAppResume(stateRef.current, platform)
  }

  const handleReanchor = async () => {
    if (!platform) throw new Error('Platform not initialized')
    await reanchorGrid(stateRef.current, platform)
    setState({ ...stateRef.current })
  }

  // Rebuild state from current on-chain price for a bot that was already running
  // but whose localStorage was wiped. Populates openOrders so startBots takes
  // the isResume path and skips the seed buy.
  const handleRecoverState = async (gridSOL: number, dailyDCALimitUSD: number) => {
    if (!platform) throw new Error('Platform not initialized')
    const prices = await fetchPrices(JIJ_MINT, platform)
    const currentPrice = prices.jijSolPrice
    mutate(s => {
      s.config.gridSOL = gridSOL
      s.config.dailyDCALimitUSD = dailyDCALimitUSD
      s.config.entryPrice = currentPrice
      s.config.gridLower = currentPrice * (1 - GRID_RANGE_PCT)
      s.config.gridUpper = currentPrice * (1 + GRID_RANGE_PCT)
      s.lastPriceSOL = currentPrice
      s.lastSolUsdPrice = prices.solUsdPrice
      allocateCapital(s, currentPrice)
      s.seedSOL = 0  // seed buy already happened — don't repeat it
      initGrid(s)
      buildInitialOrders(s, currentPrice)
      s.botRunning = false  // user will click Resume to start polling
    })
  }

  const previewDashboard = () => {
    stateRef.current.botRunning = true
    setState({ ...stateRef.current })
    if (platform) {
      fetchPrices(JIJ_MINT, platform).then(prices => {
        stateRef.current.lastPriceSOL = prices.jijSolPrice
        stateRef.current.lastSolUsdPrice = prices.solUsdPrice
        setState({ ...stateRef.current })
      }).catch(console.error)
    }
  }

  return (
    <BotContext.Provider value={{
      state,
      platform,
      setPlatform,
      connectWallet,
      disconnectWallet,
      startBots: handleStartBots,
      stopBots: handleStopBots,
      emergencyStop: handleEmergencyStop,
      topUpSOL: handleTopUp,
      withdrawSOL: handleWithdraw,
      withdrawJiJ: handleWithdrawJiJ,
      withdrawUSDC: handleWithdrawUSDC,
      exportPrivateKey: platform?.exportPrivateKey?.bind(platform),
      refreshBalance: handleRefreshBalance,
      setDCAStatus: handleSetDCAStatus,
      setCausePct: handleSetCausePct,
      updateConfig,
      triggerResume,
      previewDashboard,
      reanchorGrid: handleReanchor,
      recoverState: handleRecoverState,
    }}>
      {children}
    </BotContext.Provider>
  )
}

export function useBotContext() {
  const ctx = useContext(BotContext)
  if (!ctx) throw new Error('useBotContext must be used inside BotProvider')
  return ctx
}
