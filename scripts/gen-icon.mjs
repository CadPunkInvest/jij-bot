import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'apps/android/src/assets/setup-bg.png')

// Face crop from 1254x1254 source:
// Robot head: hat tip ~y=80, shoulders ~y=470, face center x~620
// Add some padding so it feels like an icon with breathing room
const CROP = { left: 330, top: 95, width: 520, height: 520 }

// Android mipmap sizes — size = ic_launcher.png, foreground = adaptive icon foreground (108dp equiv)
const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48,  foreground: 108 },
  { dir: 'mipmap-hdpi',    size: 72,  foreground: 162 },
  { dir: 'mipmap-xhdpi',   size: 96,  foreground: 216 },
  { dir: 'mipmap-xxhdpi',  size: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', size: 192, foreground: 432 },
]

const resDir = path.join(root, 'apps/android/android/app/src/main/res')

async function run() {
  // 1. Crop the face from source
  const cropped = await sharp(src)
    .extract(CROP)
    .toBuffer()

  // 2. Generate a preview at 512px so we can eyeball it
  const previewPath = path.join(root, 'scripts/icon-preview.png')
  await sharp(cropped)
    .resize(512, 512)
    .png()
    .toFile(previewPath)
  console.log('Preview saved to scripts/icon-preview.png')

  // 3. Generate all mipmap sizes (square + round — Android masks them)
  for (const { dir, size, foreground } of SIZES) {
    const outDir = path.join(resDir, dir)
    fs.mkdirSync(outDir, { recursive: true })

    // ic_launcher.png (square)
    await sharp(cropped)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'))

    // ic_launcher_round.png (circle crop)
    const circleSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
    )
    const mask = await sharp(circleSvg).png().toBuffer()

    await sharp(cropped)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'))

    // ic_launcher_foreground.png — adaptive icon foreground (108dp equivalent)
    // Add 12% padding so the safe zone (centre 72dp of 108dp) isn't clipped
    const pad = Math.round(foreground * 0.12)
    await sharp(cropped)
      .resize(foreground - pad * 2, foreground - pad * 2, { fit: 'cover' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 13, g: 10, b: 31, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'))

    console.log(`✓ ${dir} — ${size}x${size} launcher, ${foreground}x${foreground} foreground`)
  }

  console.log('\nAll icon sizes generated.')
}

run().catch(err => { console.error(err); process.exit(1) })
