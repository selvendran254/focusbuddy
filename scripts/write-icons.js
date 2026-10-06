const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function canvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  function set(x, y, r, g, b, a) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = (py * width + px) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  function fillRect(x, y, w, h, color) {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) set(x + xx, y + yy, color[0], color[1], color[2], color[3]);
    }
  }
  return { data, set, fillRect };
}

function drawBuddy(width, template) {
  const view = canvas(width, heightOf(width));
  const scale = width / 22;
  const ink = template ? [20, 24, 32, 255] : [255, 255, 255, 255];
  const accent = [47, 191, 168, 255];
  const eye = template ? [255, 255, 255, 255] : [28, 34, 48, 255];
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - width / 2 + 0.5;
      const dy = y - width / 2 + 0.5;
      if (dx * dx + dy * dy < (width * 0.48) * (width * 0.48)) view.set(x, y, 28, 34, 48, 255);
    }
  }
  const px = (x, y, w, h, color) => view.fillRect(x * scale, y * scale, Math.max(1, w * scale), Math.max(1, h * scale), color);
  px(7, 3, 8, 7, ink);
  px(8, 5, 2, 2, eye);
  px(12, 5, 2, 2, eye);
  px(6, 11, 10, 7, accent);
  px(8, 18, 2, 3, ink);
  px(12, 18, 2, 3, ink);
  return view.data;
}

function heightOf(width) {
  return width;
}

function main() {
  const dir = path.join(__dirname, '..', 'assets', 'icons');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tray.png'), encodePng(22, 22, drawBuddy(22, true)));
  fs.writeFileSync(path.join(dir, 'icon.png'), encodePng(512, 512, drawBuddy(512, false)));
  console.log('Wrote assets/icons/tray.png and icon.png');
}

main();
