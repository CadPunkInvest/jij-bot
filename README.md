# JIJ Bot

Automated Solana trading bot for **Jump In Jack (JIJ)** — Grid Bot + DCA Bot with Canadian tax reserve tracking.

Runs as a **Windows desktop app** (Tauri) and an **Android APK** (Capacitor, private sideload distribution).

---

## Quick Start

```bash
npm install
```

### Desktop (Windows EXE)

```bash
# Dev server
npm run dev:desktop

# Production build → .exe installer in apps/desktop/src-tauri/target/release/bundle/nsis/
npm run build:desktop

# Pre-release build with Design Mode enabled
VITE_DESIGN_MODE=true npm run build:desktop
```

Requires: [Rust](https://rustup.rs/), [Tauri CLI v2](https://tauri.app/start/prerequisites/), Node 18+

### Android APK

```bash
# Build React → sync to Capacitor → open Android Studio
npm run build:android
cd apps/android && npx cap open android

# Or build APK directly (requires Android SDK)
cd apps/android && npx cap build android

# Pre-release with Design Mode
VITE_DESIGN_MODE=true npm run build:android
```

Requires: [Android Studio](https://developer.android.com/studio), JDK 17+, Node 18+

---

## Android Sideload Installation

This app is distributed as a direct APK — **no Google Play Store**. This is intentional for private beta.

### Recipient Setup (one time)

1. **Enable unknown sources** on your Android device:
   - Android 8+: `Settings → Apps → Special app access → Install unknown apps`
   - Select your browser or file manager → enable "Allow from this source"
2. **Download the APK** from the shared link (Google Drive, messaging app, etc.)
3. **Open the APK file** — Android will ask to install
4. Tap **Install** → app appears on your home screen
5. **Install Phantom Wallet** from the Play Store if not already installed

You can revoke "unknown sources" after install if desired.

---

## Architecture

```
jij-bot/
├── packages/
│   ├── core/        # Shared bot logic — zero platform dependencies
│   └── ui/          # Shared React + Tailwind components
├── apps/
│   ├── desktop/     # Tauri — Windows EXE
│   └── android/     # Capacitor — Android APK
└── assets/
    ├── design.config.json   # Visual layout config (ships with both builds)
    └── sprites/             # Place spritesheet PNGs here
```

### Platform Abstraction

All platform-specific code (wallet, storage, notifications) is behind a `Platform` interface. The shared `core` and `ui` packages never import Tauri or Capacitor APIs directly. Each app provides its own concrete `Platform` implementation injected at startup.

### Wallet

- **Desktop**: `window.solana` (Phantom browser extension in Tauri Webview)
- **Android**: Phantom deep link scheme (`phantom://v1/connect`) with Diffie-Hellman encryption. Callback URL scheme: `jijbot://`

---

## Bots

### Grid Bot
Places buy/sell orders at evenly-spaced price levels. When a level fills, routes profit through the Profit Router and places a counter-order. Grid trails the market upward using the Trail Buffer.

### DCA Bot (3 states)
| State | Pool grows? | Buys? |
|---|---|---|
| ON | Yes | Yes — $50/day at crypto-random time |
| OFF | Yes | No |
| DEACTIVATED | No | No (pool preserved) |

DCA buy time is chosen cryptographically at midnight each night. On Android, a local notification wakes the app at buy time. Missed buys are caught on next app open.

### Trail Engine
When price exceeds grid upper bound by `trailSensitivity` %, the grid shifts up one step using Trail Buffer funds. Never shifts downward.

### Profit Router
Tax reserve fires first (default 50% of profit → USDC via Jupiter). Remainder split:
- DCA ON/OFF: 40% Grid / 40% DCA / 20% Trail
- DCA DEACTIVATED: 60% Grid / 0% DCA / 40% Trail

---

## Design Mode

A built-in visual editor for customizing layout, backgrounds, and animated sprites. **Compiled into pre-release builds only** (`VITE_DESIGN_MODE=true`).

**Activation:**
- Desktop: `Ctrl + Shift + D`
- Android: Triple-tap the app logo

### Capabilities
- **Background System**: Upload an image or enter a URL. Supports GIFs. Opacity, blur, offset, and mode (cover/contain/tile) controls.
- **Sprite Placer**: Place animated spritesheets anywhere on screen. Horizontal strip format (all frames left-to-right in one row). Supports loop, ping-pong, and once modes.
- **Layout Editor**: Drag and resize panels with snap-to-grid. Panel visibility toggle.

### Spritesheet format
Sprites must be a **horizontal strip** — all frames in a single row, left to right.

```
[frame0][frame1][frame2]...[frameN]
```

Example for an 8-frame 64×64 sprite: image is 512×64 pixels.

### Design Config
Changes save to `assets/design.config.json`. This file **ships with both production builds** — end users see your designed layout without any Design Mode access.

---

## Configuration

All settings in the **Settings** tab / sidebar:

| Setting | Default | Notes |
|---|---|---|
| Grid levels | 20 | 2–200 levels |
| Tax reserve % | 50% | CRA guideline; min 30%, max 70% |
| Trail sensitivity | 2% | % above upper bound to trigger shift |
| Poll interval | 10s | Price poll frequency |
| Paper trading | true | Simulates all swaps (no real transactions) |
| Min SOL reserve | 0.05 | Always kept for gas fees |

DCA Bot has no config — only ON / OFF / DEACTIVATE controls.

---

## Tax Export

**Settings → Tax Reserve → Export CRA CSV**

Generates a CRA-friendly CSV with:
- Summary header (year totals, avg SOL/USD, reserve rate)
- Row per profit event (date, SOL, USD, USDC reserved, tx signature)
- TOTALS footer row

> **Disclaimer:** Tax information in this app is for informational purposes only and does not constitute financial or tax advice. Canadian crypto tax rules are complex and your obligations depend on your individual circumstances. Consult a qualified Canadian tax professional or refer to CRA guidelines before filing. The 50% default reserve rate is a general guideline and may not be appropriate for your situation.

---

## Safety Controls

- **Emergency Stop**: Pauses Grid Bot + Trail Engine. DCA pool always preserved.
- **Session loss guard**: Auto-pauses if portfolio drops X% from session start.
- **Stop loss**: Optional price floor — pauses all bots below threshold.
- **Min SOL reserve**: Always keeps gas money. Skips trades if wallet would go below.
- **Slippage guard**: Skips trade if Jupiter quote slippage exceeds limit.
- **Transaction retry**: 3 attempts with exponential backoff.
- **Tax swap failure**: Queued to `pendingTaxReserveSOL`, retried on next profit event. Dashboard warning shown.
- **DCA buy failure**: Pool NOT deducted. Logged and retried tomorrow.

---

## JIJ Token

**Mint address** — update `packages/core/src/types.ts` → `JIJ_MINT` with the actual token mint address before deploying.

USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet)
