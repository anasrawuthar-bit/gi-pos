const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const outputDir = path.join(__dirname, '..', 'public')
const pngPath = path.join(outputDir, 'app_icon.png')
const icoPath = path.join(outputDir, 'app_icon.ico')
const iconSizes = [16, 24, 32, 48, 64, 128, 256]

function generateIconPixels(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const radius = size * 0.18
  const border = Math.max(1, Math.round(size * 0.045))

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      if (!insideRoundedRect(x + 0.5, y + 0.5, size, size, radius)) {
        pixels[index + 3] = 0
        continue
      }

      const gradient = Math.round((y / size) * 16)
      pixels[index] = 7 + gradient
      pixels[index + 1] = 11 + gradient
      pixels[index + 2] = 18 + gradient
      pixels[index + 3] = 255

      if (!insideRoundedRect(x + 0.5, y + 0.5, size - border * 2, size - border * 2, radius - border, border)) {
        pixels[index] = 207
        pixels[index + 1] = 16
        pixels[index + 2] = 48
      }
    }
  }

  drawGiMark(pixels, size)
  return pixels
}

function drawGiMark(pixels, size) {
  const scale = size / 256
  const white = [238, 242, 247, 255]
  const muted = [153, 161, 173, 255]
  const shadow = [0, 0, 0, 85]

  drawG(pixels, size, 43 * scale, 60 * scale, 90 * scale, 116 * scale, 19 * scale, shadow, 4 * scale, 4 * scale)
  drawI(pixels, size, 146 * scale, 60 * scale, 62 * scale, 116 * scale, 19 * scale, shadow, 4 * scale, 4 * scale)

  drawG(pixels, size, 43 * scale, 60 * scale, 90 * scale, 116 * scale, 19 * scale, white, 0, 0)
  drawRect(pixels, size, 146 * scale, 60 * scale, 62 * scale, 19 * scale, muted)
  drawRect(pixels, size, 168 * scale, 60 * scale, 18 * scale, 116 * scale, white)
  drawRect(pixels, size, 146 * scale, 157 * scale, 62 * scale, 19 * scale, muted)
}

function drawG(pixels, size, x, y, width, height, thickness, color, dx, dy) {
  drawRect(pixels, size, x + dx, y + dy, width, thickness, color)
  drawRect(pixels, size, x + dx, y + dy, thickness, height, color)
  drawRect(pixels, size, x + dx, y + height - thickness + dy, width, thickness, color)
  drawRect(pixels, size, x + width * 0.48 + dx, y + height * 0.48 + dy, width * 0.46, thickness, color)
  drawRect(pixels, size, x + width - thickness + dx, y + height * 0.48 + dy, thickness, height * 0.34, color)
}

function drawI(pixels, size, x, y, width, height, thickness, color, dx, dy) {
  drawRect(pixels, size, x + dx, y + dy, width, thickness, color)
  drawRect(pixels, size, x + width * 0.36 + dx, y + dy, thickness, height, color)
  drawRect(pixels, size, x + dx, y + height - thickness + dy, width, thickness, color)
}

function drawRect(pixels, size, x, y, width, height, color) {
  const left = Math.max(0, Math.round(x))
  const top = Math.max(0, Math.round(y))
  const right = Math.min(size, Math.round(x + width))
  const bottom = Math.min(size, Math.round(y + height))

  for (let yy = top; yy < bottom; yy += 1) {
    for (let xx = left; xx < right; xx += 1) {
      const index = (yy * size + xx) * 4
      blendPixel(pixels, index, color)
    }
  }
}

function blendPixel(pixels, index, color) {
  const alpha = color[3] / 255
  const inverseAlpha = 1 - alpha
  pixels[index] = Math.round(color[0] * alpha + pixels[index] * inverseAlpha)
  pixels[index + 1] = Math.round(color[1] * alpha + pixels[index + 1] * inverseAlpha)
  pixels[index + 2] = Math.round(color[2] * alpha + pixels[index + 2] * inverseAlpha)
  pixels[index + 3] = Math.max(pixels[index + 3], color[3])
}

function insideRoundedRect(x, y, width, height, radius, inset = 0) {
  const left = inset
  const top = inset
  const right = inset + width
  const bottom = inset + height

  if (x < left || y < top || x >= right || y >= bottom) {
    return false
  }

  const cornerX = x < left + radius ? left + radius : x > right - radius ? right - radius : x
  const cornerY = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y
  const distanceX = x - cornerX
  const distanceY = y - cornerY

  return distanceX * distanceX + distanceY * distanceY <= radius * radius
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)

  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1)
    raw[rawOffset] = 0
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    createPngChunk('IEND', Buffer.alloc(0)),
  ])
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = []
  let offset = 6 + images.length * 16

  for (const image of images) {
    const entry = Buffer.alloc(16)
    entry[0] = image.size === 256 ? 0 : image.size
    entry[1] = image.size === 256 ? 0 : image.size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += image.png.length
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

const crcTable = Array.from({ length: 256 }, (_unused, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

fs.mkdirSync(outputDir, { recursive: true })

if (fs.existsSync(icoPath) && process.env.GI_REGENERATE_ICON !== '1') {
  console.log(`Using existing ${path.relative(process.cwd(), icoPath)}. Set GI_REGENERATE_ICON=1 to regenerate it.`)
  process.exit(0)
}

const images = iconSizes.map((size) => ({
  size,
  png: encodePng(size, size, generateIconPixels(size)),
}))

fs.writeFileSync(pngPath, images.at(-1).png)
fs.writeFileSync(icoPath, encodeIco(images))

console.log(`Generated ${path.relative(process.cwd(), icoPath)} with ${iconSizes.at(-1)}x${iconSizes.at(-1)} support`)
