// Capturas de revisión visual: node scripts/screenshots.mjs [baseUrl] [outDir]
// Requiere `npm run preview` (o dev) corriendo.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['dashboard', '#/'],
  ['study-guides', '#/study/guides'],
  ['lesson', '#/study/lesson/toefl-writing-discussion'],
  ['vocab', '#/study/vocab'],
  ['deck', '#/study/deck/awl-1'],
  ['grammar', '#/study/grammar-topic/inversion'],
  ['videos', '#/study/videos'],
  ['practice', '#/practice'],
  ['toefl-passage', '#/practice/toefl.passage/toefl-ap-07'],
  ['toefl-ctw', '#/practice/toefl.ctw/toefl-ctw-08'],
  ['toefl-build', '#/practice/toefl.build/toefl-build-10'],
  ['toefl-conversation', '#/practice/toefl.conversation/toefl-conv-03'],
  ['toefl-email', '#/practice/toefl.email/toefl-email-03'],
  ['exam-home', '#/exam'],
  ['settings', '#/settings'],
];
const IELTS_ROUTES = [
  ['ielts-dashboard', '#/'],
  ['ielts-reading', '#/practice/ielts.reading/ielts-r-pa-03'],
  ['ielts-listening', '#/practice/ielts.listening/ielts-l-p2-01'],
  ['ielts-task1', '#/practice/ielts.writing/ielts-t1-line-1'],
  ['ielts-task1-map', '#/practice/ielts.task1/ielts-t1-map-1'],
  ['ielts-task1-process', '#/practice/ielts.task1/ielts-t1-process-2'],
  ['ielts-speaking', '#/practice/ielts.p2/ielts-p2-04'],
];

const browser = await chromium.launch();
const errors = [];
for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: device === 'mobile' ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${device}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/fonts|favicon|ytimg|languagetool/i.test(m.text()) && errors.push(`${device} console: ${m.text()}`));
  await page.goto(BASE);
  await page.waitForTimeout(800);
  if (device === 'desktop') await page.screenshot({ path: `${OUT}/${device}-onboarding.png` });
  // Onboarding
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByLabel(/Cómo te llamas/).fill('Hugo');
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Empezar/ }).click();
  await page.waitForTimeout(600);
  const shoot = async (name, hash, full = true) => {
    await page.goto(BASE + hash);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${device}-${name}.png`, fullPage: full && device === 'desktop' ? false : false });
  };
  for (const [n, h] of ROUTES) await shoot(n, h);
  // Corregir un pasaje para ver feedback
  await page.goto(BASE + '#/practice/toefl.passage/toefl-ap-07');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Comprobar respuestas/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${device}-toefl-passage-feedback.png` });
  // Cambiar a IELTS
  await page.goto(BASE + '#/');
  await page.getByRole('radio', { name: /IELTS/ }).first().click();
  await page.waitForTimeout(400);
  for (const [n, h] of IELTS_ROUTES) await shoot(n, h.replace('ielts.writing', 'ielts.task1'));
  // Examen: intro + primera pantalla
  await page.goto(BASE + '#/exam/run/ielts/1/reading');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Empezar sección/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${device}-exam-ielts-reading.png` });
  await page.goto(BASE + '#/');
  await page.getByRole('radio', { name: /TOEFL/ }).first().click();
  await page.goto(BASE + '#/exam/run/toefl/1/reading');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${device}-exam-toefl-intro.png` });
  await page.getByRole('button', { name: /Empezar sección/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${device}-exam-toefl-ctw.png` });
  // Modo oscuro
  if (device === 'desktop') {
    await page.goto(BASE + '#/');
    await page.getByRole('button', { name: /Modo oscuro/ }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${device}-dashboard-dark.png` });
    await page.goto(BASE + '#/practice/toefl.passage/toefl-ap-07');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${device}-passage-dark.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no page errors');
