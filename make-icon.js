// Creates a 1024x1024 purple PNG using only built-in Node modules
const fs = require('fs')
const zlib = require('zlib')

function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeB = Buffer.from(type)
    const crc = crc32(Buffer.concat([typeB, data]))
    const crcB = Buffer.alloc(4)
    crcB.writeUInt32BE(crc)
    return Buffer.concat([len, typeB, data, crcB])
  }

  function crc32(buf) {
    let crc = -1
    const table = makeCRCTable()
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
    return (crc ^ -1) >>> 0
  }

  function makeCRCTable() {
    const t = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0  // filter byte
    for (let x = 0; x < width; x++) {
      const i = y * (width * 3 + 1) + 1 + x * 3
      raw[i] = r; raw[i+1] = g; raw[i+2] = b
    }
  }

  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

const png = createPNG(1024, 1024, 124, 58, 237)  // purple #7c3aed
fs.writeFileSync('icon-source.png', png)
console.log('icon-source.png created')
