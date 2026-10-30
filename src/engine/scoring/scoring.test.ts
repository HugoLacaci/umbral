import { describe, expect, it } from 'vitest';
import {
  toeflOverall, toeflCefr, toeflComparable, toeflRLBand, routeModule, proportionToBand,
  toeflWritingBand, toeflSpeakingBand, IELTS_TO_TOEFL,
} from './toefl';
import {
  ieltsListeningBand, ieltsReadingBand, ieltsRound, ieltsOverall, ieltsWritingBand, ieltsSpeakingBand, rawNeeded,
} from './ielts';

describe('TOEFL overall (oficial)', () => {
  it('reproduce los ejemplos oficiales de ETS', () => {
    // media 5.125 → 5 ; media 5.25 → 5.5
    expect(toeflOverall([5, 5, 5, 5.5])).toBe(5);
    expect(toeflOverall([5, 5, 5.5, 5.5])).toBe(5.5);
  });
  it('redondea .375 hacia arriba y .125 hacia abajo', () => {
    expect(toeflOverall([4, 4.5, 4.5, 4.5])).toBe(4.5); // 4.375
    expect(toeflOverall([4, 4, 4, 4.5])).toBe(4); // 4.125
    expect(toeflOverall([3.5, 4, 4, 4])).toBe(4); // 3.875
  });
  it('caso SJTU: R4 L4.5 S4 W4.5 → 4.5 global', () => {
    expect(toeflOverall([4, 4.5, 4, 4.5])).toBe(4.5);
  });
  it('limita entre 1 y 6', () => {
    expect(toeflOverall([6, 6, 6, 6])).toBe(6);
    expect(toeflOverall([1, 1, 1, 1])).toBe(1);
  });
});

describe('TOEFL MCER y 0–120 (tablas oficiales)', () => {
  it('MCER', () => {
    expect(toeflCefr(6)).toBe('C2');
    expect(toeflCefr(5.5)).toBe('C1');
    expect(toeflCefr(5)).toBe('C1');
    expect(toeflCefr(4.5)).toBe('B2');
    expect(toeflCefr(4)).toBe('B2');
    expect(toeflCefr(3.5)).toBe('B1');
    expect(toeflCefr(2)).toBe('A2');
    expect(toeflCefr(1.5)).toBe('A1');
  });
  it('comparable 0–120', () => {
    expect(toeflComparable(6).label).toBe('114–120');
    expect(toeflComparable(5)).toMatchObject({ min: 95, max: 106 });
    expect(toeflComparable(4.5)).toMatchObject({ min: 86, max: 94 });
    expect(toeflComparable(4)).toMatchObject({ min: 72, max: 85 });
    expect(toeflComparable(1)).toMatchObject({ min: 0, max: 11 });
  });
  it('tabla IELTS → TOEFL', () => {
    expect(IELTS_TO_TOEFL['7']).toBe(5);
    expect(IELTS_TO_TOEFL['6.5']).toBe(4.5);
  });
});

describe('TOEFL estimaciones', () => {
  it('enrutado del router al 60 %', () => {
    expect(routeModule(12, 20)).toBe('upper');
    expect(routeModule(11, 20)).toBe('lower');
    expect(routeModule(0, 0)).toBe('lower');
  });
  it('el módulo fácil limita la banda a 4.5', () => {
    expect(toeflRLBand(1, 'lower')).toBe(4.5);
    expect(toeflRLBand(1, 'upper')).toBe(6);
    expect(toeflRLBand(0, 'upper')).toBe(3);
    expect(toeflRLBand(0, 'lower')).toBe(1);
  });
  it('monotonía de proportionToBand', () => {
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const b = proportionToBand(p);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
    expect(proportionToBand(1)).toBe(6);
    expect(proportionToBand(0)).toBe(1);
  });
  it('writing y speaking', () => {
    expect(toeflWritingBand(10, 10, 5, 5)).toBe(6);
    expect(toeflWritingBand(0, 10, 0, 0)).toBe(1);
    expect(toeflSpeakingBand([5, 5, 5, 5, 5, 5, 5], [5, 5, 5, 5])).toBe(6);
    expect(toeflSpeakingBand([3, 3, 3, 3, 3, 3, 3], [3, 3, 3, 3])).toBe(4); // 60 %
  });
});

describe('IELTS', () => {
  it('redondeo oficial de la nota global', () => {
    expect(ieltsRound(6.125)).toBe(6);
    expect(ieltsRound(6.25)).toBe(6.5);
    expect(ieltsRound(6.375)).toBe(6.5);
    expect(ieltsRound(6.625)).toBe(6.5);
    expect(ieltsRound(6.75)).toBe(7);
    expect(ieltsRound(6.875)).toBe(7);
    expect(ieltsRound(7)).toBe(7);
    expect(ieltsOverall([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25
    expect(ieltsOverall([4, 3.5, 4, 4])).toBe(4); // 3.875
  });
  it('tablas de aciertos coherentes con los anclajes oficiales', () => {
    expect(ieltsListeningBand(16)).toBe(5);
    expect(ieltsListeningBand(23)).toBe(6);
    expect(ieltsListeningBand(30)).toBe(7);
    expect(ieltsListeningBand(35)).toBe(8);
    expect(ieltsReadingBand(15)).toBe(5);
    expect(ieltsReadingBand(23)).toBe(6);
    expect(ieltsReadingBand(30)).toBe(7);
    expect(ieltsReadingBand(35)).toBe(8);
    expect(ieltsReadingBand(40)).toBe(9);
    expect(ieltsListeningBand(0)).toBe(0);
  });
  it('aciertos necesarios', () => {
    expect(rawNeeded('reading', 7)).toBe(30);
    expect(rawNeeded('listening', 6.5)).toBe(26);
  });
  it('Task 2 pesa el doble', () => {
    expect(ieltsWritingBand(6, 7)).toBe(6.5); // 6.67
    expect(ieltsWritingBand(8, 6)).toBe(6.5); // 6.67
    expect(ieltsWritingBand(5, 7)).toBe(6.5); // 6.33
  });
  it('speaking media de criterios', () => {
    expect(ieltsSpeakingBand([7, 7, 6, 6])).toBe(6.5);
    expect(ieltsSpeakingBand([7, 7, 7, 6])).toBe(7); // 6.75
  });
});
