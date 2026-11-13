// Stock seasons: which season a day falls in, an animal's class, a season's numbers and moving
// classes up at the start of the next season. Checked against a season worked out by hand.
import { describe, it, expect } from 'vitest';
import { classFor, isValidBalanceDate, nextSeason, rollForward, seasonFor, seasonTotals } from '@shared/stock';

describe('seasons', () => {
  it('runs to the balance date', () => {
    expect(seasonFor('2026-03-10')).toEqual({ startsOn: '2025-06-01', endsOn: '2026-05-31' });
    expect(seasonFor('2026-05-31')).toEqual({ startsOn: '2025-06-01', endsOn: '2026-05-31' });
    expect(seasonFor('2026-06-01')).toEqual({ startsOn: '2026-06-01', endsOn: '2027-05-31' });
    expect(seasonFor('2026-07-01', '06-30')).toEqual({ startsOn: '2026-07-01', endsOn: '2027-06-30' });
    expect(nextSeason('2026-05-31')).toEqual({ startsOn: '2026-06-01', endsOn: '2027-05-31' });
  });

  it('only accepts a balance date every year has', () => {
    expect(isValidBalanceDate('05-31')).toBe(true);
    expect(isValidBalanceDate('06-30')).toBe(true);
    expect(isValidBalanceDate('02-29')).toBe(false);
    expect(isValidBalanceDate('06-31')).toBe(false);
    expect(isValidBalanceDate('5-31')).toBe(false);
  });
});

describe('classes', () => {
  const heifer = { sex: 'female', dateOfBirth: '2025-08-15' };
  const bull = { sex: 'male', dateOfBirth: '2025-08-15' };

  it('a calf born this season is rising one-year, and moves up each season', () => {
    expect(classFor(heifer, '2025-09-01')).toBe('Rising one-year heifers');
    expect(classFor(heifer, '2026-05-31')).toBe('Rising one-year heifers');
    expect(classFor(heifer, '2026-06-01')).toBe('Rising two-year heifers');
    expect(classFor(heifer, '2027-06-01')).toBe('Mixed-age cows');
    expect(classFor(heifer, '2035-01-01')).toBe('Mixed-age cows');
    expect(classFor(bull, '2026-06-01')).toBe('Rising two-year steers and bulls');
    expect(classFor(bull, '2028-06-01')).toBe('Rising three-year and older steers and bulls');
  });

  it('uses a class set by hand, and gives none when it can’t be worked out', () => {
    expect(classFor({ ...bull, stockClass: 'Breeding bulls' }, '2026-01-01')).toBe('Breeding bulls');
    expect(classFor({ sex: 'female' }, '2026-01-01')).toBeNull();
    expect(classFor({ dateOfBirth: '2025-08-15' }, '2026-01-01')).toBeNull();
    expect(classFor(heifer, '2025-01-01')).toBeNull();
  });
});

describe('a season worked out by hand', () => {
  // Opening 1 June 2025: 200 mixed-age cows, 50 R2 heifers, 55 R1 heifers, 2 breeding bulls (307)
  const opening = {
    'Mixed-age cows': 200, 'Rising two-year heifers': 50, 'Rising one-year heifers': 55, 'Breeding bulls': 2,
  };
  // During the season: 60 heifer calves and 70 bull calves born; 65 bull calves sold as bobbies;
  // 15 cows culled; 3 cows died; 1 steer killed for rations; 2 R1 heifers bought; 5 bull calves
  // reared on; a stocktake found 1 R2 heifer more than recorded.
  const lines = [
    { stockClass: 'Rising one-year heifers', type: 'birth', quantity: 60, date: '2025-08-20' },
    { stockClass: 'Rising one-year steers and bulls', type: 'birth', quantity: 70, date: '2025-08-25' },
    { stockClass: 'Rising one-year steers and bulls', type: 'sale', quantity: 65, date: '2025-09-05' },
    { stockClass: 'Mixed-age cows', type: 'sale', quantity: 15, date: '2026-02-10' },
    { stockClass: 'Mixed-age cows', type: 'death', quantity: 3, date: '2025-10-01' },
    { stockClass: 'Rising one-year steers and bulls', type: 'rations', quantity: 1, date: '2026-04-01' },
    { stockClass: 'Rising one-year heifers', type: 'purchase', quantity: 2, date: '2025-11-01' },
    { stockClass: 'Rising two-year heifers', type: 'adjustment', quantity: 1, date: '2026-03-01' },
  ];

  it('closes on the right numbers', () => {
    const totals = Object.fromEntries(seasonTotals(opening, lines).map(c => [c.stockClass, c]));
    expect(totals['Mixed-age cows'].closing).toBe(182);              // 200 - 15 - 3
    expect(totals['Rising two-year heifers'].closing).toBe(51);      // 50 + 1
    expect(totals['Rising one-year heifers'].closing).toBe(117);     // 55 + 60 + 2
    expect(totals['Rising one-year steers and bulls'].closing).toBe(4); // 70 - 65 - 1
    expect(totals['Breeding bulls'].closing).toBe(2);
    expect(totals['Mixed-age cows'].byType).toEqual({ sale: 15, death: 3 });
    expect(totals['Rising one-year heifers'].in).toBe(62);
    const all = Object.values(totals).reduce((sum, c) => sum + c.closing, 0);
    expect(all).toBe(356); // 307 + 130 born + 2 bought + 1 adjusted - 65 - 15 - 3 - 1
  });

  it('counts only movements up to a day when asked', () => {
    const totals = Object.fromEntries(seasonTotals(opening, lines, '2025-09-01').map(c => [c.stockClass, c.closing]));
    expect(totals['Rising one-year steers and bulls']).toBe(70);
    expect(totals['Mixed-age cows']).toBe(200);
  });

  it('opens the next season with each class moved up', () => {
    const closing = Object.fromEntries(seasonTotals(opening, lines).map(c => [c.stockClass, c.closing]));
    expect(rollForward(closing)).toEqual({
      'Mixed-age cows': 233,                              // 182 cows + 51 R2 heifers that calve
      'Rising two-year heifers': 117,
      'Rising two-year steers and bulls': 4,
      'Breeding bulls': 2,
    });
  });
});
