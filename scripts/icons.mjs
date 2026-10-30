// Genera los PNG de la PWA a partir del logo SVG (se ejecuta una vez: node scripts/icons.mjs)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['pwa-192.png', 192, 0], ['pwa-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#3446d4"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `).replace('rx="9"', 'rx="0"')}</div></body></html>`);
  await page.screenshot({ path: `public/${name}` });
}
await browser.close();
console.log('icons ok');
