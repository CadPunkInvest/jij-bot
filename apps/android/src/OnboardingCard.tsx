import React, { useEffect, useState } from 'react'

const ONBOARDING_KEY = 'jij-onboarding-seen'

export function OnboardingCard() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY)
    if (!seen) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-purple-700 mb-4">
        <div className="text-2xl mb-3">⚡</div>
        <h2 className="text-lg font-bold text-white mb-2">Welcome to JIJ Bot</h2>
        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
          This is a <span className="text-purple-300 font-semibold">private beta build</span> distributed
          directly as an APK — not via Google Play. This is intentional.
        </p>

        <div className="bg-gray-700/50 rounded-xl p-4 mb-4 space-y-2 text-sm text-gray-300">
          <div className="font-semibold text-white text-xs uppercase tracking-wider mb-2">First-time Android setup</div>
          <div className="flex gap-2">
            <span className="text-purple-400 shrink-0">1.</span>
            <span>Go to <strong className="text-white">Settings → Security</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 shrink-0">2.</span>
            <span>Enable <strong className="text-white">Install unknown apps</strong> for your browser or file manager</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 shrink-0">3.</span>
            <span>Open the APK file you received and tap <strong className="text-white">Install</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400 shrink-0">4.</span>
            <span>Install <strong className="text-white">Phantom Wallet</strong> from the Play Store if you haven't already</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          You can revoke "unknown sources" permission after install for extra security.
        </p>

        <button
          onClick={dismiss}
          className="w-full py-3 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-semibold transition-colors"
        >
          Got it — Let's go
        </button>
      </div>
    </div>
  )
}
