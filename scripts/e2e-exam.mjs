// Prueba de humo del modo examen: node scripts/e2e-exam.mjs [baseUrl]
import { chromium } from '@playwright/test';
const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE);
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Empezar/ }).click();

// TOEFL Reading: router (rellenando A en todas) → módulo 2 → informe
await page.goto(BASE + '#/exam/run/toefl/1/reading');
await page.getByRole('button', { name: /Empezar sección/ }).click();
let guard = 0;
while (guard++ < 30) {
  if (await page.getByRole('button', { name: /^Continuar/ }).isVisible().catch(() => false)) {
    console.log('transition to module 2');
    await page.getByRole('button', { name: /^Continuar/ }).click();
  }
  const groups = page.locator('[role=radiogroup]');
  const n = await groups.count();
  for (let i = 0; i < n; i++) await groups.nth(i).locator('label').first().click({ timeout: 2000 }).catch(() => {});
  const blanks = page.locator('input[aria-label^="Hueco"]');
  for (let i = 0; i < (await blanks.count()); i++) await blanks.nth(i).fill('e');
  const next = page.getByRole('button', { name: /^Next/ });
  if (!(await next.isVisible().catch(() => false))) break;
  await next.click();
  await page.waitForTimeout(150);
  if (page.url().includes('/exam/report/')) break;
}
await page.waitForURL(/exam\/report/, { timeout: 15000 });
await page.waitForTimeout(800);
console.log('TOEFL report:', (await page.locator('main').innerText()).slice(0, 400).replace(/\n+/g, ' | '));
await page.screenshot({ path: `${OUT}/e2e-toefl-report.png`, fullPage: false });

// IELTS Writing: escribir y entregar
await page.goto(BASE + '#/');
await page.getByRole('radio', { name: /IELTS/ }).first().click();
await page.goto(BASE + '#/exam/run/ielts/1/writing');
await page.getByRole('button', { name: /Empezar sección/ }).click();
const essay = 'The chart shows how the figures changed over the period. Overall, there was a clear upward trend, although some categories fell. '.repeat(6);
await page.getByLabel(/Tu respuesta/).fill(essay);
await page.getByRole('button', { name: /Task 2/ }).click();
await page.getByLabel(/Tu respuesta/).fill('Some people believe that governments should fund research. In my opinion, this is true because research benefits everyone. However, companies also have a role. '.repeat(9));
await page.getByRole('button', { name: /^Entregar$/ }).click();
await page.getByRole('button', { name: /^Entregar$/ }).last().click();
await page.waitForURL(/exam\/report/, { timeout: 15000 });
await page.waitForTimeout(800);
console.log('IELTS report:', (await page.locator('main').innerText()).slice(0, 300).replace(/\n+/g, ' | '));
await page.screenshot({ path: `${OUT}/e2e-ielts-report.png` });
await page.goto(BASE + '#/');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/e2e-dashboard-after.png` });
await browser.close();
console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'no page errors');
