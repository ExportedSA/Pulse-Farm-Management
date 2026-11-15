// Stock reconciliation for the accounts: opening + movements = closing for every class, two
// seasons in a row with the move-up between them, classes set by hand moving up, mobs against
// the tally, killsheets, and NAIT's list of animals against the farm's. Checked against numbers
// worked out by hand.
import { describe, it, expect } from 'vitest';
import {
  classFor, compareNait, isAgeClass, killsheetUncounted, mobCheck, parseNaitCsv, reportRows, rolloverPlan,
  seasonTotals, signedQuantity, type SeasonLine,
} from '@shared/stock';

const closingOf = (lines: SeasonLine[], opening: Record<string, number>) =>
  Object.fromEntries(seasonTotals(opening, lines).map(c => [c.stockClass, c.closing]));

describe('opening + movements = closing, for every class', () => {
  const opening = { 'Mixed-age cows': 300, 'Rising two-year heifers': 70, 'Rising one-year heifers': 72, 'Breeding bulls': 3 };
  const lines: SeasonLine[] = [
    { stockClass: 'Rising one-year heifers', type: 'birth', quantity: 80, date: '2025-08-01' },
    { stockClass: 'Rising one-year steers and bulls', type: 'birth', quantity: 95, date: '2025-08-03' },
    { stockClass: 'Rising one-year steers and bulls', type: 'sale', quantity: 90, date: '2025-08-20' },
    { stockClass: 'Mixed-age cows', type: 'killed', quantity: 40, date: '2026-03-15' },
    { stockClass: 'Mixed-age cows', type: 'death', quantity: 6, date: '2025-09-10' },
    { stockClass: 'Mixed-age cows', type: 'sale', quantity: 10, date: '2026-04-02' },
    { stockClass: 'Rising one-year heifers', type: 'transfer_out', quantity: 5, date: '2025-12-01' },
    { stockClass: 'Rising one-year heifers', type: 'transfer_in', quantity: 5, date: '2026-05-01' },
    { stockClass: 'Rising two-year heifers', type: 'purchase', quantity: 4, date: '2025-10-01' },
    { stockClass: 'Breeding bulls', type: 'rations', quantity: 1, date: '2026-01-10' },
    { stockClass: 'Rising two-year heifers', type: 'adjustment', quantity: -2, date: '2026-05-20' },
  ];

  it('every class balances, and the totals add up', () => {
    const rows = reportRows(null, seasonTotals(opening, lines));
    for (const r of rows) {
      const moved = Object.entries(r.byType).reduce((sum, [type, q]) => sum + signedQuantity(type, q ?? 0), 0);
      expect(r.opening + moved).toBe(r.closing);
      expect(r.balances).toBe(true);
      expect(r.lastClosing).toBeNull();
      expect(r.rollover).toBeNull();
    }
    const by = Object.fromEntries(rows.map(r => [r.stockClass, r]));
    expect(by['Mixed-age cows'].closing).toBe(244);                  // 300 - 40 killed - 6 died - 10 sold
    expect(by['Mixed-age cows'].byType).toEqual({ killed: 40, death: 6, sale: 10 });
    expect(by['Rising one-year heifers'].closing).toBe(152);         // 72 + 80 - 5 + 5
    expect(by['Rising one-year steers and bulls'].closing).toBe(5);  // 95 - 90
    expect(by['Rising two-year heifers'].closing).toBe(72);          // 70 + 4 - 2
    expect(by['Breeding bulls'].closing).toBe(2);
    expect(rows.reduce((s, r) => s + r.closing, 0)).toBe(475);       // 445 + 175 born + 9 in - 152 out - 2
  });

  it('a killed animal is a departure', () => {
    expect(signedQuantity('killed', 3)).toBe(-3);
  });

  it('carries into the next season through the move-up, and still balances', () => {
    const closing1 = closingOf(lines, opening);
    const plan = rolloverPlan(closing1);
    expect(plan.moves).toEqual(expect.arrayContaining([
      { from: 'Rising one-year heifers', to: 'Rising two-year heifers', head: 152 },
      { from: 'Rising two-year heifers', to: 'Mixed-age cows', head: 72 },
      { from: 'Rising one-year steers and bulls', to: 'Rising two-year steers and bulls', head: 5 },
    ]));
    expect(plan.stay).toEqual(expect.arrayContaining([
      { stockClass: 'Mixed-age cows', head: 244 },
      { stockClass: 'Breeding bulls', head: 2 },
    ]));
    expect(plan.opening).toEqual({
      'Mixed-age cows': 316, 'Rising two-year heifers': 152, 'Rising two-year steers and bulls': 5, 'Breeding bulls': 2,
    });

    // Season two: no movements in some classes, new calves in R1
    const lines2: SeasonLine[] = [
      { stockClass: 'Rising one-year heifers', type: 'birth', quantity: 85, date: '2026-07-30' },
      { stockClass: 'Mixed-age cows', type: 'killed', quantity: 50, date: '2027-02-01' },
      { stockClass: 'Rising two-year steers and bulls', type: 'sale', quantity: 5, date: '2026-10-01' },
    ];
    const rows = reportRows(closing1, seasonTotals(plan.opening, lines2));
    const by = Object.fromEntries(rows.map(r => [r.stockClass, r]));
    for (const r of rows) expect(r.balances).toBe(true);
    // R1 heifers: 152 last closing, all moved up (-152), 0 opening, 85 born, 85 closing
    expect(by['Rising one-year heifers']).toMatchObject({ lastClosing: 152, rollover: -152, opening: 0, closing: 85 });
    expect(by['Rising two-year heifers']).toMatchObject({ lastClosing: 72, rollover: 80, opening: 152, closing: 152 });
    expect(by['Mixed-age cows']).toMatchObject({ lastClosing: 244, rollover: 72, opening: 316, closing: 266 });
    expect(by['Rising one-year steers and bulls']).toMatchObject({ lastClosing: 5, rollover: -5, opening: 0, closing: 0 });
    expect(by['Rising two-year steers and bulls']).toMatchObject({ lastClosing: 0, rollover: 5, opening: 5, closing: 0 });
    // The move-up only moves head between classes
    expect(rows.reduce((s, r) => s + (r.rollover ?? 0), 0)).toBe(0);
  });

  it('flags a class that doesn’t balance', () => {
    const [row] = reportRows({ 'Mixed-age cows': 10 }, [{ stockClass: 'Mixed-age cows', opening: 10, byType: { sale: 2 }, in: 0, out: 2, closing: 9 }]);
    expect(row.balances).toBe(false);
  });
});

describe('the move-up for animals in the register', () => {
  it('moves a class by age set by hand up from the day it was set', () => {
    const bought = { stockClass: 'Rising one-year heifers', stockClassAsAt: '2025-11-01' };
    expect(classFor(bought, '2026-05-31')).toBe('Rising one-year heifers');
    expect(classFor(bought, '2026-06-01')).toBe('Rising two-year heifers');
    expect(classFor(bought, '2027-06-01')).toBe('Mixed-age cows');
    expect(classFor(bought, '2030-01-01')).toBe('Mixed-age cows');
    // Earlier than it was set it can't have been younger than rising one-year
    expect(classFor(bought, '2024-12-01')).toBe('Rising one-year heifers');
    const steer = { stockClass: 'Rising two-year steers and bulls', stockClassAsAt: '2026-02-01' };
    expect(classFor(steer, '2025-05-01')).toBe('Rising one-year steers and bulls');
    expect(classFor(steer, '2026-07-01')).toBe('Rising three-year and older steers and bulls');
  });

  it('keeps a top class, and classes that aren’t by age, as they are', () => {
    expect(classFor({ stockClass: 'Mixed-age cows', stockClassAsAt: '2026-01-01' }, '2024-01-01')).toBe('Mixed-age cows');
    expect(classFor({ stockClass: 'Breeding bulls', stockClassAsAt: '2024-01-01' }, '2027-01-01')).toBe('Breeding bulls');
    expect(classFor({ stockClass: 'Grazing heifers (owner)', stockClassAsAt: '2024-01-01' }, '2027-01-01')).toBe('Grazing heifers (owner)');
    // No day it was set: as before, it stays
    expect(classFor({ stockClass: 'Rising one-year heifers' }, '2028-01-01')).toBe('Rising one-year heifers');
    expect(isAgeClass('Rising two-year heifers')).toBe(true);
    expect(isAgeClass('Breeding bulls')).toBe(false);
  });

  it('works with a 30 June balance date', () => {
    const calf = { sex: 'female', dateOfBirth: '2025-06-15' };
    expect(classFor(calf, '2025-06-30', '06-30')).toBe('Rising one-year heifers');
    // Born before the 30 June balance date, so a year older from 1 July
    expect(classFor(calf, '2025-07-01', '06-30')).toBe('Rising two-year heifers');
    expect(classFor({ sex: 'female', dateOfBirth: '2025-07-15' }, '2026-06-30', '06-30')).toBe('Rising one-year heifers');
    expect(classFor({ sex: 'female', dateOfBirth: '2025-07-15' }, '2026-07-01', '06-30')).toBe('Rising two-year heifers');
  });
});

describe('mobs against the tally', () => {
  const tally = [
    { stockClass: 'Mixed-age cows', closing: 300 },
    { stockClass: 'Rising two-year heifers', closing: 70 },
    { stockClass: 'Rising one-year heifers', closing: 80 },
  ];
  const mob = (id: string, stockClass: string | null, head: number, headCount: number | null = head, tagged = 0) =>
    ({ id, name: `Mob ${id}`, stockClass, head, headCount, tagged });

  it('shows the difference per class', () => {
    const check = mobCheck(tally, [
      mob('1', 'Mixed-age cows', 180), mob('2', 'Mixed-age cows', 118), // 298: 2 short
      mob('3', 'Rising two-year heifers', 70),                           // matches
      mob('4', 'Rising one-year steers and bulls', 6),                  // no tally at all
    ]);
    const by = Object.fromEntries(check.classes.map(c => [c.stockClass, c]));
    expect(by['Mixed-age cows']).toEqual({ stockClass: 'Mixed-age cows', tally: 300, mobs: 298, difference: -2 });
    expect(by['Rising two-year heifers'].difference).toBe(0);
    expect(by['Rising one-year heifers']).toMatchObject({ tally: 80, mobs: 0, difference: -80 }); // no mob
    expect(by['Rising one-year steers and bulls']).toMatchObject({ tally: 0, mobs: 6, difference: 6 });
    expect(check.classes.map(c => c.stockClass)[0]).toBe('Rising one-year heifers'); // in class order
  });

  it('lists mobs with no class and head counts that differ from the tagged animals', () => {
    const check = mobCheck(tally, [
      mob('1', null, 12),
      mob('2', 'Mixed-age cows', 150, 150, 148),
      mob('3', 'Mixed-age cows', 150, null, 150),   // no head count: uses the tagged animals
      mob('4', 'Mixed-age cows', 0, 0, 0),
    ]);
    expect(check.unclassed.map(m => m.id)).toEqual(['1']);
    expect(check.countMismatch.map(m => [m.id, m.difference])).toEqual([['2', 2]]);
    expect(check.classes.find(c => c.stockClass === 'Mixed-age cows')!.difference).toBe(0);
  });
});

describe('killsheets', () => {
  it('counts the head not in the register and not yet counted', () => {
    expect(killsheetUncounted({ animalCount: 12 }, 8, 0)).toBe(4);
    expect(killsheetUncounted({ animalCount: 12 }, 8, 4)).toBe(0);
    expect(killsheetUncounted({ animalCount: 12 }, 10, 4)).toBe(-2);
  });
});

describe('NAIT', () => {
  const csv = [
    'Animals at location 123456,,,,',
    '"RFID","Visual Tag","Birth Date","Sex","Species"',
    '982 000123456781,ABC123 21 0001,15/08/2021,F,Cattle',
    '982000123456782,ABC123 22 0002,01/09/2022,F,Cattle',
    '982 000123456789,,03/08/2025,M,Cattle',
    ',,,,',
  ].join('\r\n');

  it('reads NAIT’s list of animals at the location', () => {
    const { animals, columns } = parseNaitCsv(csv);
    expect(columns).toEqual({ id: 'RFID', visualId: 'Visual Tag' });
    expect(animals).toHaveLength(3);
    expect(animals[0]).toEqual({ id: '982 000123456781', visualId: 'ABC123 21 0001', birthDate: '2021-08-15', sex: 'F' });
    expect(parseNaitCsv('Animal Number;Sex\n982000111;F').animals).toEqual([{ id: '982000111', visualId: null, birthDate: null, sex: 'F' }]);
    expect(() => parseNaitCsv('Name,Colour\nDaisy,Black')).toThrow(/NAIT numbers/);
  });

  it('lists animals only in NAIT and only on the farm in Pulse', () => {
    const { animals } = parseNaitCsv(csv);
    const result = compareNait(animals, [
      { animalId: 'a', label: '1', ids: ['982000123456781'], visualId: '1' },
      { animalId: 'b', label: '2', ids: [null], visualId: 'ABC123-22-0002' }, // matched by its full visual tag
      { animalId: 'c', label: '3', ids: ['982000999999999'], visualId: '3' },
    ]);
    expect(result.matched).toBe(2);
    expect(result.onlyInNait.map(n => n.id)).toEqual(['982 000123456789']);
    expect(result.onlyInPulse.map(a => a.animalId)).toEqual(['c']);
  });

  it('doesn’t match on short herd numbers', () => {
    const result = compareNait([{ id: '982000000000001', visualId: '12' }], [{ animalId: 'a', label: '12', ids: [], visualId: '12' }]);
    expect(result.matched).toBe(0);
  });
});
