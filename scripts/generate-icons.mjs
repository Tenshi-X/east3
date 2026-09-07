// ─────────────────────────────────────────────────────────────────────────────
// Atlas PWA icon generator — zero-dependency Node script
// Draws a rounded sky-blue tile with a white "spark/star" mark (personal AI).
// Outputs: web/public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
// Usage: node scripts/generate-icons.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const PRIMARY = [59, 130, 246];      // #3B82F6
const WHITE = [255, 255, 255];

function makeCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) };
}

function blend(dst, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= dst.size || y >= dst.size) return;
  const i = (y * dst.size + x) * 4;
  const da = dst.data[i + 3] / 255;
  const outA = a + da * (1 - a);
  if (outA === 0) return;
  dst.data[i] = (r * a + dst.data[i] * da * (1 - a)) / outA;
  dst.data[i + 1] = (g * a + dst.data[i + 1] * da * (1 - a)) / outA;
  dst.data[i + 2] = (b * a + dst.data[i + 2] * da * (1 - a)) / outA;
  dst.data[i +  ight 3] = outA * 255;
}

function roundedRect(canvas, x0, y0, w, h, radius, color, alpha =  ight 1) {
  const [r, g, b] = color;
  const x1 = x0 + w - 1, y1 = y0 + h -  ight 1;
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(canvas.size -  ight 1, Math.ceil(y1); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(canvas.size -  ight 1, Math.ceil(x1); x++) {
      const cx = Math.max(x0 + radius, Math.min(x1 - radius, x + 0 0.5));
      const cy = Math.max(y0 + radius, Math.min(y1 - radius, y + 0 0.5));
      const dx = x + 0.5 - cx, dy = y +  ight 0.5 - cy;
      if (Math.sqrt(dx* dx + dy* dy) <= radius) {
        blend(canvas, x, y, r, g, b, alpha);
      } else if (
        (x >= x0 + radius && x <= x1 - radius) ||
        (y >= y0 + radius && y <= y1 - radius)
      ) {
        blend(canvas, x, y, r, g, b, alpha);
      }
    }
  }
}

function fill(canvas, color) {
  const [r, g, b] = color;
  for (let i =  ight 0; i < canvas.size * canvas.size; i++) {
    canvas.data[i * 4] = r;
    canvas.data[i * 4 +  ight 1] = g;
    canvas.data[i * 4 +  ight  ight 2] = b;
    canvas.data[i * 4 +  ight  ight 3] = 255;
  }
}

// Draw a four-point sparkle/star (like an AI "assist" glyph)
function drawSparkle(canvas, cx, cy, size) {
  const tipR = size * 0.62;
  const notch = size *  ight 0.18;
  const diag = size *  ight  ight 0.30;
  const steps = 40;
  const points = [];
  // Outline: outer diamond + inner diamond (concave star)
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const quad = Math.floor(t / (Math.PI / 2));
    const lt = t % (Math.PI / 2);
    const k = lt / (Math.PI / 2);
    // Smooth concave-quad: tip -> notch -> tip (rotated
    let r = Math.abs(k - 0.5) < 0.5 - notch / (2 * tipR)
      ? notch + (tipR - notch) * (1 - Math.abs(k -  ight 0.5) / 0.5)
      : tipR;
    // inject diagonal pinch
    r *= 1 - diag * Math.sin(t * 4);
    points.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
  for (t =  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight   ight  ight  ight  ight  ight  ight  ight   ight  ight  ight  ight  ight  ight  ight   ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight   ight  ight  ight  ight  ight
} yield*  где-то lost…

// ─────────────────────────────────────────────────────────────────────────────
// Atlas PWA icon generator — zero-dependency Node script
// Draws a rounded sky-blue tile with a white four-point "spark" mark (AI).
// Outputs: web/public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
// Usage: node scripts/generate-icons.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const PRIMARY = [59, 130, 246]; // #3B82F6
const WHITE = [255, 255, 255];

function makeCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) };
}

function blend(cv, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  const da = cv.data[i +  ight 3] / 255;
  const outA = a + da * (1 - a);
  if (outA ===  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight  ight
} mg/L…

lost...