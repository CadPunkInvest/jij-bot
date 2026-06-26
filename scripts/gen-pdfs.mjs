import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const out = path.join(root, 'scripts')

// ── Colour palette ────────────────────────────────────────────────
const C = {
  black:    '#0D0A1F',
  purple:   '#7C3AED',
  purpleLight: '#A78BFA',
  white:    '#FFFFFF',
  offwhite: '#F5F3FF',
  muted:    '#6B7280',
  green:    '#22C55E',
  red:      '#EF4444',
  border:   '#E5E7EB',
  codeBg:   '#1E1B4B',
  warn:     '#FEF3C7',
  warnBorder:'#F59E0B',
}

// ── Helpers ───────────────────────────────────────────────────────
function addPage(doc) { doc.addPage() }

function header(doc, text, y) {
  doc.rect(0, y ?? doc.y, doc.page.width, 44).fill(C.purple)
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(18)
     .text(text, 40, (y ?? doc.y) + 13, { lineBreak: false })
  doc.fillColor(C.black)
  doc.moveDown(2.5)
}

function sectionTitle(doc, text) {
  doc.moveDown(0.5)
  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(13).text(text)
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  doc.moveDown(0.3)
}

function body(doc, text) {
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
     .text(text, { lineGap: 3 })
  doc.moveDown(0.4)
}

function bullet(doc, items) {
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  items.forEach(item => {
    doc.text(`•  ${item}`, { indent: 16, lineGap: 3 })
  })
  doc.moveDown(0.4)
}

function numbered(doc, items) {
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  items.forEach((item, i) => {
    doc.font('Helvetica-Bold').text(`${i + 1}.  `, { continued: true, indent: 12 })
    doc.font('Helvetica').text(item, { lineGap: 3 })
  })
  doc.moveDown(0.4)
}

function codeBlock(doc, lines) {
  const blockH = lines.length * 14 + 16
  const y = doc.y
  doc.rect(40, y, doc.page.width - 80, blockH).fill(C.codeBg)
  doc.fillColor(C.purpleLight).font('Courier').fontSize(9)
  lines.forEach((line, i) => {
    doc.text(line, 52, y + 8 + i * 14, { lineBreak: false })
  })
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  doc.y = y + blockH + 8
  doc.moveDown(0.4)
}

function warnBox(doc, text) {
  const y = doc.y
  doc.rect(40, y, doc.page.width - 80, 36).fill(C.warn).stroke(C.warnBorder)
  doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(9)
     .text(`⚠  ${text}`, 52, y + 11, { width: doc.page.width - 104, lineBreak: false })
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  doc.y = y + 44
  doc.moveDown(0.3)
}

function divider(doc) {
  doc.moveDown(0.4)
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke(C.border)
  doc.moveDown(0.6)
}

function titlePage(doc, title, subtitle, role) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.black)
  doc.rect(0, 0, doc.page.width, 6).fill(C.purple)
  doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(C.purple)

  doc.fillColor(C.purpleLight).font('Helvetica-Bold').fontSize(9)
     .text('JUMP IN JACK', 40, 60, { characterSpacing: 3 })

  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(36)
     .text('JiJ Bot', 40, 90)

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(14)
     .text(title, 40, 144)

  doc.fillColor(C.muted).font('Helvetica').fontSize(11)
     .text(subtitle, 40, 170, { width: 440 })

  // Decorative grid lines
  doc.strokeColor(C.purple).opacity(0.12)
  for (let x = 0; x < doc.page.width; x += 32) {
    doc.moveTo(x, 240).lineTo(x, doc.page.height - 60).stroke()
  }
  for (let y = 240; y < doc.page.height - 60; y += 32) {
    doc.moveTo(0, y).lineTo(doc.page.width, y).stroke()
  }
  doc.opacity(1)

  // Role badge
  doc.rect(40, doc.page.height - 80, 150, 28).fill(C.purple)
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(10)
     .text(role, 55, doc.page.height - 72, { lineBreak: false })

  doc.fillColor(C.muted).font('Helvetica').fontSize(9)
     .text(`v1.0  ·  June 2026`, doc.page.width - 140, doc.page.height - 72, { lineBreak: false })
}

// ═══════════════════════════════════════════════════════════════════
//  PDF 1 — COMMUNITY GUIDE
// ═══════════════════════════════════════════════════════════════════
function buildCommunityPDF() {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 40, right: 40 } })
  const filePath = path.join(out, 'JiJBot-User-Guide.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  // Title page
  titlePage(doc,
    'User Setup Guide',
    'Everything you need to install, fund, and run the automated\ngrid + DCA trading bot for JiJ token on Solana.',
    'FOR THE COMMUNITY')

  // ── Page 2: What is JiJ Bot ───────────────────────────────────────
  addPage(doc)
  header(doc, 'What is JiJ Bot?', 40)

  body(doc, 'JiJ Bot is an automated trading bot built specifically for the Jump In Jack (JiJ) token on the Solana blockchain. It runs 24/7 on your Android phone and executes buy and sell orders automatically — no manual trading required.')

  sectionTitle(doc, 'Grid Bot')
  body(doc, 'A grid bot places a ladder of buy orders below the current price and sell orders above it. When price moves down it buys JiJ; when price moves back up it sells for a profit. This cycle repeats continuously, harvesting profit from price oscillation regardless of which direction the market moves overall.')
  bullet(doc, [
    '20 grid levels total — 10 buy orders below entry price, 10 sell orders above',
    'Range spans ±40% from your entry price',
    'Each level is funded equally from your committed SOL',
    'Profits are auto-compounded back into the grid',
  ])

  sectionTitle(doc, 'DCA (Dollar Cost Averaging)')
  body(doc, 'In addition to grid trading, the bot runs a daily DCA buy using profits from the grid. You set a maximum daily USD limit. The bot picks a random time each day and buys JiJ — averaging your cost basis down over time without touching your committed SOL.')
  bullet(doc, [
    'DCA uses grid profits only — your principal SOL is never at risk from DCA',
    'You control the daily limit (e.g. $10, $25, $50)',
    'Can be switched ON, OFF, or Deactivated at any time from the dashboard',
  ])

  sectionTitle(doc, 'Seed Buy (70/30 Protocol)')
  body(doc, 'When the bot starts, it automatically splits your committed SOL: 30% is used for an immediate buy of JiJ (so you have tokens to sell at higher prices right away), and 70% is reserved to fund the 10 buy orders in the grid below current price.')

  divider(doc)

  sectionTitle(doc, 'What the bot does NOT do')
  bullet(doc, [
    'It does not send your funds anywhere — all trades stay within your bot wallet',
    'It does not share any data with third parties',
    'It does not require an internet-connected server — your phone IS the bot',
    'It does not trade any token other than JiJ/SOL',
  ])

  // ── Page 3: Security ──────────────────────────────────────────────
  addPage(doc)
  header(doc, 'Security', 40)

  body(doc, 'JiJ Bot generates a unique Solana wallet directly on your device. This wallet signs all trades automatically — you never have to approve individual transactions. Here is how your funds are protected:')

  sectionTitle(doc, '1.  Local Hot Wallet — Your Keys, Your Phone')
  body(doc, 'A Solana keypair (private key + public address) is generated the first time you open the app. It never leaves your device. All transaction signing happens locally — no keys are sent to any server, API, or third party. The bot submits signed transactions directly to the Solana blockchain.')

  sectionTitle(doc, '2.  PIN Encryption')
  body(doc, 'Your private key is encrypted using AES-256-GCM before being stored on the device. The encryption key is derived from your PIN using PBKDF2 with 200,000 iterations of SHA-256 — the same standard used by password managers and banking apps. Without your PIN, the stored data is useless to anyone who accesses your phone.')
  bullet(doc, [
    'PIN is 6 digits, entered on app open',
    'Wrong PIN = no access, no decryption',
    'The PIN itself is never stored — only used to derive the encryption key',
  ])

  sectionTitle(doc, '3.  Biometric Unlock')
  body(doc, 'After setting your PIN you will be offered fingerprint / face unlock. Your PIN is stored in the Android Keystore system (hardware-backed on modern devices) and is only retrievable after a successful biometric match. This means each subsequent app open can be unlocked with your fingerprint instead of typing the PIN.')

  sectionTitle(doc, '4.  ADB Backup Disabled')
  body(doc, 'Android\'s backup system (which could allow extraction of app data via a USB cable) is explicitly disabled. Even with physical access to your phone and a computer, the encrypted wallet data cannot be copied out via standard Android tools.')

  sectionTitle(doc, '5.  Session Timeout')
  body(doc, 'If the app is backgrounded for more than 5 minutes, the decryption key is cleared from memory. When you return, you must re-authenticate with PIN or biometric. The bot continues trading in the background — only the UI is locked.')

  warnBox(doc, 'Back up your bot wallet address and make note of your PIN. If you uninstall the app or factory reset your phone, funds in the bot wallet are only recoverable if you have the private key — which in this version is device-only.')

  // ── Page 4: Installation ──────────────────────────────────────────
  addPage(doc)
  header(doc, 'Installation', 40)

  sectionTitle(doc, 'Requirements')
  bullet(doc, [
    'Android phone running Android 7.0 (API 24) or higher',
    'Fingerprint or face unlock set up on your phone (recommended)',
    'A Phantom wallet or any Solana wallet to fund the bot wallet',
    'Some SOL to commit (minimum 0.1 SOL recommended, 0.25–0.5 SOL ideal)',
  ])

  sectionTitle(doc, 'Step 1 — Allow installation from unknown sources')
  body(doc, 'JiJ Bot is distributed as an APK file, not through the Google Play Store. You need to allow your phone to install apps from outside the Play Store.')
  numbered(doc, [
    'Open Settings on your phone',
    'Go to Apps (or Application Manager) → Special app access → Install unknown apps',
    'Find your browser or file manager and toggle "Allow from this source" ON',
    'This setting only applies to that one app — it does not permanently lower your security',
  ])

  sectionTitle(doc, 'Step 2 — Download the APK')
  body(doc, 'Open the link below on your phone\'s browser and tap Download:')
  codeBlock(doc, ['[ DOWNLOAD LINK ]'])
  body(doc, 'The file is named  app-release.apk  and is approximately 11 MB.')

  sectionTitle(doc, 'Step 3 — Install')
  numbered(doc, [
    'Open your Downloads folder and tap app-release.apk',
    'Tap Install on the confirmation screen',
    'Tap Done (do not tap Open yet)',
  ])

  sectionTitle(doc, 'Step 4 — First launch & PIN setup')
  numbered(doc, [
    'Open JiJ Bot from your app drawer — look for the robot lumberjack icon',
    'You will be prompted to create a 6-digit PIN — choose something you will remember',
    'Enter it again to confirm',
    'You will be offered biometric unlock — tap Enable Biometric (recommended)',
    'The app will generate your bot wallet and take you to the setup screen',
  ])

  sectionTitle(doc, 'Step 5 — Fund your bot wallet')
  numbered(doc, [
    'On the setup screen, copy your Bot Wallet Address',
    'Open Phantom (or any Solana wallet) and send SOL to that address',
    'Tap Refresh Balance in the app until your balance shows',
    'Enter how much SOL you want to commit to the grid bot',
    'Set your daily DCA limit in USD',
    'Tap Start Bot',
  ])

  body(doc, 'The bot will immediately execute a seed buy (30% of your committed SOL buys JiJ), then place all grid orders. You will see live price, grid levels, and P&L on the dashboard.')

  // ── Page 5: Dashboard & FAQ ───────────────────────────────────────
  addPage(doc)
  header(doc, 'Dashboard & FAQ', 40)

  sectionTitle(doc, 'Reading the dashboard')
  bullet(doc, [
    'JiJ Price — live price in SOL and USD, updated every 30 seconds',
    'SOL Balance — current SOL in your bot wallet',
    'Grid Reserve — SOL remaining to fund buy orders',
    'Trail Buffer — a 15% safety reserve held back from grid orders',
    'Realised P&L — profit captured from completed grid cycles',
    'DCA toggle — switch DCA ON / OFF / Deactivated',
    'Stop Bot — gracefully stops the bot (keeps funds in wallet)',
    'Emergency Stop — immediately cancels all orders and stops',
    '+ Top Up — add more SOL to the running bot (applies the same 70/30 split)',
  ])

  sectionTitle(doc, 'Frequently asked questions')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10)
     .text('Can I run the bot on both my phone and a desktop browser at the same time?')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'Yes. Each instance generates its own unique wallet, so they operate completely independently. Space the starts a few days apart so they begin at different price points, giving you different grid entry levels.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10)
     .text('What happens if I close the app?')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'The bot saves its full state. When you reopen the app and authenticate, it resumes immediately — checking for any missed orders and restarting the polling loop.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10)
     .text('What happens if the price goes outside the ±40% range?')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'The grid pauses at its outermost level. If price returns within range, trading resumes automatically. No funds are lost — orders simply aren\'t filled while price is outside the grid.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10)
     .text('How do I withdraw my SOL?')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'Stop the bot first, then on the setup screen use Withdraw SOL back to Phantom — enter your Phantom address and the bot wallet sends everything minus a small gas fee.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10)
     .text('Is this app open source?')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'The bot is built for the JiJ community. Source code availability will be announced in the community channels.')

  divider(doc)

  sectionTitle(doc, 'Download')
  body(doc, 'The latest version of JiJ Bot for Android is always available at:')
  codeBlock(doc, ['[ DOWNLOAD LINK ]'])
  body(doc, 'Always download from this official link only. Do not install APKs shared by other community members.')

  doc.end()
  console.log('✓ JiJBot-User-Guide.pdf')
  return filePath
}

// ═══════════════════════════════════════════════════════════════════
//  PDF 2 — DEVELOPER DEPLOYMENT GUIDE
// ═══════════════════════════════════════════════════════════════════
function buildDevPDF() {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 40, right: 40 } })
  const filePath = path.join(out, 'JiJBot-Dev-Deployment-Guide.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  titlePage(doc,
    'Developer Deployment Guide',
    'Step-by-step process for building, signing, and distributing\nupdates to JiJ Bot for Android.',
    'INTERNAL — KEEP PRIVATE')

  // ── Page 2: Prerequisites & Structure ────────────────────────────
  addPage(doc)
  header(doc, 'Prerequisites & Project Structure', 40)

  sectionTitle(doc, 'Required tools')
  bullet(doc, [
    'Node.js 18+ (node --version to check)',
    'Android Studio (includes Java JDK and Gradle)',
    'ADB (Android Debug Bridge) — installed with Android Studio',
    'Git (for version control)',
  ])

  sectionTitle(doc, 'Key paths')
  codeBlock(doc, [
    'Project root:       C:\\Users\\natha\\JumpInJackBot\\',
    'Android app:        apps\\android\\',
    'Android project:    apps\\android\\android\\',
    'Release APK output: apps\\android\\android\\app\\build\\outputs\\apk\\release\\',
    'Signing keystore:   apps\\android\\android\\jijbot-release.jks',
    'Icon generator:     scripts\\gen-icon.mjs',
    'PDF generator:      scripts\\gen-pdfs.mjs',
  ])

  warnBox(doc, 'Never commit jijbot-release.jks to git or share it publicly. Back it up offline.')

  sectionTitle(doc, 'Signing credentials — STORE THESE SAFELY')
  codeBlock(doc, [
    'Keystore file:  jijbot-release.jks',
    'Key alias:      jijbot',
    'Password:       zsphWqrEsznn!Vnc',
    '',
    '(Both storePassword and keyPassword use the same value above)',
  ])

  sectionTitle(doc, 'ADB location')
  codeBlock(doc, [
    'C:\\Users\\natha\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
  ])

  // ── Page 3: Build Process ─────────────────────────────────────────
  addPage(doc)
  header(doc, 'Build Process — Step by Step', 40)

  sectionTitle(doc, 'Step 1 — Make your code changes')
  body(doc, 'All source files live under packages/ and apps/. The main areas:')
  bullet(doc, [
    'packages/core/src/   — bot logic, price feeds, swap execution',
    'packages/ui/src/     — shared React UI components',
    'apps/android/src/    — Android-specific platform code and AuthGate',
    'apps/desktop/src/    — Browser-specific platform code',
  ])

  sectionTitle(doc, 'Step 2 — Bump the version number')
  body(doc, 'Open  apps/android/android/app/build.gradle  and increment both values:')
  codeBlock(doc, [
    'defaultConfig {',
    '    versionCode 2          // increment by 1 each release',
    '    versionName "1.1"      // human-readable version',
    '}',
  ])
  body(doc, 'versionCode must always increase. versionName is what users see.')

  sectionTitle(doc, 'Step 3 — Build the JS bundle and sync to Android')
  body(doc, 'Run from the project root in PowerShell:')
  codeBlock(doc, [
    'cd C:\\Users\\natha\\JumpInJackBot',
    'npm run build:android',
  ])
  body(doc, 'This runs Vite (builds the React app) then  npx cap sync android  (copies the built files into the Android project and updates native plugins). Watch for any errors — if Vite fails, fix the TypeScript errors before proceeding.')

  sectionTitle(doc, 'Step 4 — Build the signed release APK')
  codeBlock(doc, [
    '$env:JAVA_HOME = "C:\\Program Files\\Android\\Android Studio\\jbr"',
    '$env:KS_PASS   = "zsphWqrEsznn!Vnc"',
    'cd C:\\Users\\natha\\JumpInJackBot\\apps\\android\\android',
    '.\\gradlew assembleRelease',
  ])
  body(doc, 'Build takes 30–60 seconds. On success you will see  BUILD SUCCESSFUL. The signed APK is at:')
  codeBlock(doc, [
    'app\\build\\outputs\\apk\\release\\app-release.apk',
  ])

  sectionTitle(doc, 'Step 5 — Test on your own phone first')
  body(doc, 'Connect your phone via USB with USB Debugging enabled, then:')
  codeBlock(doc, [
    '$adb = "C:\\Users\\natha\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"',
    '& $adb devices                           # confirm phone is listed',
    '& $adb install -r app-release.apk        # -r = replace existing install',
  ])
  body(doc, 'The  -r  flag upgrades without uninstalling (preserves wallet data). Only omit it if you need a clean install. Run through the full flow on your phone before distributing.')

  // ── Page 4: Distribution & Updating Icons ─────────────────────────
  addPage(doc)
  header(doc, 'Distribution & Maintenance', 40)

  sectionTitle(doc, 'Hosting — GitHub Releases (recommended)')
  body(doc, 'GitHub Releases is the best place to host the APK for community distribution. It is free, versioned, and gives a permanent direct download URL.')
  numbered(doc, [
    'Create a GitHub account at github.com if you do not have one',
    'Create a new repository: e.g.  jumpinjack-bot',
    'Run these commands to push the project (without secrets):',
  ])
  codeBlock(doc, [
    'cd C:\\Users\\natha\\JumpInJackBot',
    'git init',
    'echo "*.jks" >> .gitignore',
    'echo "node_modules/" >> .gitignore',
    'git add .',
    'git commit -m "Initial release v1.0"',
    'git remote add origin https://github.com/YOUR_USERNAME/jumpinjack-bot.git',
    'git push -u origin main',
  ])
  numbered(doc, [
    'On GitHub, go to your repo → Releases → Draft a new release',
    'Tag: v1.0  |  Title: JiJ Bot v1.0',
    'Write release notes (what changed)',
    'Drag and drop  app-release.apk  into the Assets section',
    'Click Publish release',
    'Copy the direct APK download URL — this goes into the community guide and the PDF',
  ])
  body(doc, 'For each future update, repeat the release process with a new tag (v1.1, v1.2 etc.).')

  divider(doc)

  sectionTitle(doc, 'Updating the app icon')
  body(doc, 'The icon is generated from the setup-bg.png source image. To regenerate all mipmap sizes after changing the crop or source image:')
  codeBlock(doc, [
    'cd C:\\Users\\natha\\JumpInJackBot',
    'node scripts\\gen-icon.mjs',
  ])
  body(doc, 'Check the preview at  scripts/icon-preview.png, adjust the CROP values in the script, then rebuild.')

  sectionTitle(doc, 'Regenerating these PDFs')
  codeBlock(doc, [
    'cd C:\\Users\\natha\\JumpInJackBot',
    'node scripts\\gen-pdfs.mjs',
  ])
  body(doc, 'PDFs are saved to  scripts/JiJBot-User-Guide.pdf  and  scripts/JiJBot-Dev-Deployment-Guide.pdf.')

  divider(doc)

  sectionTitle(doc, 'Troubleshooting common build failures')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10).text('INSTALL_FAILED_UPDATE_INCOMPATIBLE')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'The phone has a build with a different signature (e.g. a debug build). Uninstall the old version first:')
  codeBlock(doc, ['& $adb uninstall com.jijbot.android'])

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10).text('Keystore not found')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'Ensure  jijbot-release.jks  is at  apps/android/android/jijbot-release.jks  and KS_PASS is set in the PowerShell session.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10).text('Vite build fails with TypeScript errors')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'Fix the errors shown in the output. Do not proceed to Gradle until the JS build succeeds.')

  doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(10).text('JAVA_HOME not set / Gradle fails immediately')
  doc.fillColor(C.black).font('Helvetica').fontSize(10)
  body(doc, 'You must set JAVA_HOME in the same PowerShell session before running Gradle:')
  codeBlock(doc, ['$env:JAVA_HOME = "C:\\Program Files\\Android\\Android Studio\\jbr"'])

  doc.end()
  console.log('✓ JiJBot-Dev-Deployment-Guide.pdf')
  return filePath
}

buildCommunityPDF()
buildDevPDF()
