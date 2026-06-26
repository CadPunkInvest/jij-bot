import React, { useEffect } from 'react'
import { BotProvider, useBotContext, SetupScreen, LiveDashboard, useDesignConfig, AppBackground, SpriteRenderer } from '@jij-bot/ui'
import { desktopPlatform } from './platform'
import { AuthGate } from './AuthGate'
import setupBg from './assets/setup-bg.png'
import dashBg from './assets/dashboard-bg.png'
import logo from './assets/logo_jic1.png'

const DESIGN_MODE = import.meta.env.VITE_DESIGN_MODE === 'true'

function AppInner() {
  const { state, setPlatform } = useBotContext()
  const { config: designConfig } = useDesignConfig()

  useEffect(() => {
    window.__designConfigReadFile = desktopPlatform.storage.readFile
    window.__designConfigWriteFile = desktopPlatform.storage.writeFile
    setPlatform(desktopPlatform)
  }, [])

  const sprites = designConfig.desktop.sprites

  return (
    <div className="relative h-full">
      <div className="relative z-10 h-full">
        {state.botRunning
          ? <LiveDashboard bgImage={dashBg} logoSrc={logo} />
          : <SetupScreen bgImage={setupBg} logoSrc={logo} />
        }
      </div>
      {sprites.map(s => <SpriteRenderer key={s.id} config={s} />)}

      {DESIGN_MODE && (
        <React.Suspense fallback={null}>
          <DesignModePanelLazy platform="desktop" />
        </React.Suspense>
      )}
    </div>
  )
}

const DesignModePanelLazy = DESIGN_MODE
  ? React.lazy(() =>
      import('@jij-bot/ui/src/design/DesignModePanel')
        .then(m => ({ default: m.DesignModePanel }))
        .catch(() => ({ default: () => null }))
    )
  : () => null

export function App() {
  return (
    <AuthGate bgImage={setupBg} logoSrc={logo}>
      <BotProvider>
        <AppInner />
      </BotProvider>
    </AuthGate>
  )
}
