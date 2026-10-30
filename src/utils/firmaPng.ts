// src/utils/firmaPng.ts
// Turns a finger-drawn signature (strokes of points) into a small PNG to embed
// in the acta's Word. Pure JS so it behaves the same on iOS, Android and web:
// the strokes are rasterized into a 2-bit palette image (transparent + three
// ink levels for smooth edges) and written as a PNG with uncompressed deflate
// blocks — ~30 KB per signature, well under the Apps Script upload limit.
import { crc32, utf8 } from './actaDocx';

export type Punto = { x: number; y: number };
export type Trazo = Punto[];

// Coordinate space of the strokes (same 3:1 ratio as the Word slot).
export const FIRMA_ANCHO = 900;
export const FIRMA_ALTO = 300;
// Line width in that space (same as the web pad).
export const FIRMA_GROSOR = 5.2;

const ANCHO = 600;
const ALTO = 200;
const ESCALA = ANCHO / FIRMA_ANCHO;
const TINTA = [0x14, 0x21, 0x3d];

function rasterizar(trazos: Trazo[]) {
  const nivel = new Uint8Array(ANCHO * ALTO);
  const r = (FIRMA_GROSOR * ESCALA) / 2;
  const marcar = (x: number, y: number, d: number) => {
    const cobertura = Math.max(0, Math.min(1, r + 0.5 - d));
    const n = Math.round(cobertura * 3);
    const i = y * ANCHO + x;
    if (n > nivel[i]) nivel[i] = n;
  };
  const segmento = (a: Punto, b: Punto) => {
    const ax = a.x * ESCALA, ay = a.y * ESCALA, bx = b.x * ESCALA, by = b.y * ESCALA;
    const dx = bx - ax, dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(ANCHO - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(ALTO - 1, Math.ceil(Math.max(ay, by) + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = largo2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2)) : 0;
        marcar(x, y, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
      }
    }
  };
  trazos.forEach((trazo) => {
    if (trazo.length === 1) segmento(trazo[0], trazo[0]);
    for (let i = 1; i < trazo.length; i++) segmento(trazo[i - 1], trazo[i]);
  });
  return nivel;
}

function u32be(n: number) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function chunk(tipo: string, datos: Uint8Array) {
  const cuerpo = new Uint8Array(4 + datos.length);
  cuerpo.set(utf8(tipo), 0);
  cuerpo.set(datos, 4);
  return [...u32be(datos.length), ...cuerpo, ...u32be(crc32(cuerpo))];
}
// zlib stream with "stored" deflate blocks (no compression).
function zlibSinCompresion(datos: Uint8Array) {
  const out: number[] = [0x78, 0x01];
  for (let i = 0; i < datos.length || i === 0; i += 0xffff) {
    const bloque = datos.subarray(i, i + 0xffff);
    const ultimo = i + 0xffff >= datos.length;
    out.push(ultimo ? 1 : 0, bloque.length & 0xff, bloque.length >>> 8, ~bloque.length & 0xff, (~bloque.length >>> 8) & 0xff);
    for (let k = 0; k < bloque.length; k++) out.push(bloque[k]);
    if (ultimo) break;
  }
  let a = 1, b = 0;
  for (let i = 0; i < datos.length; i++) {
    a = (a + datos[i]) % 65521;
    b = (b + a) % 65521;
  }
  out.push(...u32be(((b << 16) | a) >>> 0));
  return Uint8Array.from(out);
}

export function firmaPng(trazos: Trazo[]) {
  const nivel = rasterizar(trazos);
  // 2 bits per pixel, 4 pixels per byte, plus the filter byte (0) per row.
  const fila = Math.ceil(ANCHO / 4);
  const crudo = new Uint8Array((fila + 1) * ALTO);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const n = nivel[y * ANCHO + x];
      if (n) crudo[y * (fila + 1) + 1 + (x >> 2)] |= n << (6 - 2 * (x & 3));
    }
  }
  const ihdr = Uint8Array.from([...u32be(ANCHO), ...u32be(ALTO), 2, 3, 0, 0, 0]);
  const plte = Uint8Array.from([...TINTA, ...TINTA, ...TINTA, ...TINTA]);
  const trns = Uint8Array.from([0, 85, 170, 255]);
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
    ...chunk('PLTE', plte),
    ...chunk('tRNS', trns),
    ...chunk('IDAT', zlibSinCompresion(crudo)),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}
