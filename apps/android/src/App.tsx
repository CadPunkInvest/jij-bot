import React, { useEffect, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { BotProvider, useBotContext, SetupScreen, LiveDashboard } from '@jij-bot/ui'
import { androidPlatform } from './platform'
import { AuthGate } from './AuthGate'
import { startBackgroundWorker, stopBackgroundWorker } from './platform/backgroundWorker'
import setupBg from './assets/mobile_setup_bg.png'
import dashBg from './assets/mobile_dashboard_bg.png'
import logo from './assets/logo_jic1.png'

function AppInner() {
  const { state, setPlatform, triggerResume } = useBotContext()
  const workerRunning = useRef(false)

  useEffect(() => {
    setPlatform(androidPlatform)
    LocalNotifications.requestPermissions()
    CapApp.addListener('resume', () => { triggerResume() })
    return () => { CapApp.removeAllListeners() }
  }, [])

  useEffect(() => {
    if (state.botRunning && !workerRunning.current) {
      startBackgroundWorker().catch(console.error)
      workerRunning.current = true
    } else if (!state.botRunning && workerRunning.current) {
      stopBackgroundWorker().catch(console.error)
      workerRunning.current = false
    }
  }, [state.botRunning])

  return state.botRunning
    ? <LiveDashboard bgImage={dashBg} logoSrc={logo} appVersion={__APP_VERSION__} />
    : <SetupScreen bgImage={setupBg} logoSrc={logo} appVersion={__APP_VERSION__} />
}

export function App() {
  return (
    <AuthGate bgImage={setupBg} logoSrc={logo}>
      <BotProvider>
        <AppInner />
      </BotProvider>
    </AuthGate>
  )
}
