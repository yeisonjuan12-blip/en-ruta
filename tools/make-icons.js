/* Genera los iconos PNG de la PWA sin dependencias externas. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const BLACK = [11, 11, 11, 255];
const YELLOW = [255, 196, 0, 255];

function makeIcon(size, maskable) {
  const SS = 3;
  const S = size * SS;
  const buf = Buffer.alloc(S * S * 4);
  const u = S / 512; // escala desde el diseño de 512

  const set = (i, col) => {
    buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = col[3];
  };

  // Fondo
  const radius = 116 * u;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let inside = true;
      if (!maskable) {
        const rx = Math.max(radius - x, 0, x - (S - radius));
        const ry = Math.max(radius - y, 0, y - (S - radius));
        inside = (rx * rx + ry * ry) <= radius * radius;
      }
      if (inside) set((y * S + x) * 4, YELLOW);
    }
  }

  function circle(cx, cy, r, col) {
    cx *= u; cy *= u; r *= u;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(S - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(S - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) set((y * S + x) * 4, col);
      }
    }
  }

  function line(x1, y1, x2, y2, w, col) {
    x1 *= u; y1 *= u; x2 *= u; y2 *= u; w *= u;
    const r = w / 2;
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - r));
    const maxX = Math.min(S - 1, Math.ceil(Math.max(x1, x2) + r));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - r));
    const maxY = Math.min(S - 1, Math.ceil(Math.max(y1, y2) + r));
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - x1) * dx + (y - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = x1 + t * dx, py = y1 + t * dy;
        const ddx = x - px, ddy = y - py;
        if (ddx * ddx + ddy * ddy <= r * r) set((y * S + x) * 4, col);
      }
    }
  }

  // Ruta (misma geometría que logo.svg)
  line(133, 388, 133, 246, 56, BLACK);
  line(133, 246, 337, 246, 56, BLACK);
  line(337, 246, 337, 151, 56, BLACK);
  circle(133, 388, 34, BLACK);
  circle(337, 133, 50, BLACK);
  circle(337, 133, 17, YELLOW);

  // Downsample
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
    }
  }
  return png(size, size, out);
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), makeIcon(size, false));
  fs.writeFileSync(path.join(OUT, `icon-maskable-${size}.png`), makeIcon(size, true));
  console.log('OK icon-' + size);
}
console.log('Iconos generados en', OUT);
