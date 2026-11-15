// What records and farm-map jobs must have before they're saved (client/src/lib/record-checks.ts),
// and that the server accepts the feed type on baleage and silage jobs.
import { describe, it, expect } from 'vitest';
import { recordProblems, sprayDoneProblem, sprayJobProblem, workDoneProblem, workJobProblem, FEED_TYPES } from '../../client/src/lib/record-checks';
import { RECORD_TYPES } from '../../client/src/lib/records';

describe('quick records', () => {
  it('every record type has a date and time, and notes for anything without a field', () => {
    // occurredAt (date and time) and notes are on every record, whatever its type (RecordDialog)
    for (const t of RECORD_TYPES) expect(t.fields.every(f => f.key !== 'notes' && f.key !== 'occurredAt')).toBe(true);
  });

  it('baleage needs the crop and its bale count, except a silage pit', () => {
    const baleage = RECORD_TYPES.find(t => t.type === 'baleage')!;
    expect(baleage.fields.find(f => f.key === 'feedType')).toMatchObject({ required: true, options: FEED_TYPES });
    expect(recordProblems('baleage', { kind: 'Baleage', feedType: 'Pasture' })).toEqual(['Bales']);
    expect(recordProblems('baleage', { kind: 'Baleage', feedType: 'Pasture', bales: 40 })).toEqual([]);
    expect(recordProblems('baleage', { kind: 'Silage pit', feedType: 'Maize', tonnes: 300 })).toEqual([]);
  });

  it('effluent needs a depth or a volume', () => {
    expect(recordProblems('effluent', { soilCondition: 'Moist' })).toEqual(['Depth or volume applied']);
    expect(recordProblems('effluent', { volumeM3: 120 })).toEqual([]);
    expect(recordProblems('effluent', { depthMm: 5 })).toEqual([]);
  });

  it('spray and fertiliser keep their rules', () => {
    expect(recordProblems('spray', { products: [{ product: 'TEST Tordon', rate: '' }] })).toEqual(['at least one product with its rate']);
    expect(recordProblems('fertiliser', { product: 'Urea' })).toEqual(['Rate or total applied']);
    expect(recordProblems('fertiliser', { product: 'Urea', rate: 80 })).toEqual([]);
  });
});

describe('farm-map jobs', () => {
  it('baleage and silage need the crop, even when planned', () => {
    expect(workJobProblem('baleage', 'planned', {})).toMatch(/what was cut/);
    expect(workJobProblem('baleage', 'planned', { feedType: 'Lucerne' })).toBeNull();
  });

  it('done baleage needs its bales; done silage its tonnes or loads', () => {
    expect(workJobProblem('baleage', 'completed', { feedType: 'Pasture' })).toMatch(/bales/);
    expect(workJobProblem('baleage', 'completed', { feedType: 'Pasture', baleCount: '60' })).toBeNull();
    expect(workJobProblem('silage', 'completed', { feedType: 'Maize' })).toMatch(/weighbridge/);
    expect(workJobProblem('silage', 'completed', { feedType: 'Maize', loads: '12' })).toBeNull();
  });

  it('done effluent or slurry needs a volume, loads × size, or a documented calibration', () => {
    expect(workJobProblem('effluent', 'planned', {})).toBeNull();
    expect(workJobProblem('effluent', 'completed', { machineSetting: 'Fast' })).toMatch(/volume/);
    expect(workJobProblem('effluent', 'completed', { volume: '150' })).toBeNull();
    expect(workJobProblem('slurry', 'completed', { loads: '6', loadSize: '12' })).toBeNull();
    expect(workJobProblem('effluent', 'completed', { calDepth: '4' })).toMatch(/volume/);
    expect(workJobProblem('effluent', 'completed', { calDepth: '4', calRef: 'TEST bucket test' })).toBeNull();
  });

  it('topping and mowing need nothing extra', () => {
    expect(workJobProblem('topping', 'completed', {})).toBeNull();
  });

  it('marking a planned job done asks for the same things, judged on its saved details', () => {
    // Saved details use the server's names (baleCount, weighbridgeTonnes, volumeM3, calibration…)
    expect(workDoneProblem('baleage', { feedType: 'Pasture', cutOn: '2026-11-01' })).toMatch(/bales/);
    expect(workDoneProblem('baleage', { feedType: 'Pasture', baleCount: 55, allowedPastureIds: [] })).toBeNull();
    expect(workDoneProblem('baleage', { baleCount: 55 })).toMatch(/what was cut/); // planned before the crop was asked for
    expect(workDoneProblem('silage', { feedType: 'Maize', weighbridgeTonnes: 310 })).toBeNull();
    expect(workDoneProblem('effluent', { method: 'Travelling irrigator' })).toMatch(/volume/);
    expect(workDoneProblem('effluent', { volumeM3: 90, volumeSource: 'estimate' })).toBeNull();
    expect(workDoneProblem('effluent', { calibration: { depthMm: 4, reference: 'TEST bucket test' } })).toBeNull();
    expect(workDoneProblem('slurry', { loads: 5, loadSizeM3: 12 })).toBeNull();
    expect(workDoneProblem('topping', {})).toBeNull();
  });

  it('marking a planned spray done needs what it was for and who applied it', () => {
    expect(sprayDoneProblem({ target: null, operator: 'TEST Sam', contractor: null })).toMatch(/sprayed for/);
    expect(sprayDoneProblem({ target: 'TEST thistles', operator: '', contractor: null })).toMatch(/who applied/);
    expect(sprayDoneProblem({ target: 'TEST thistles', operator: null, contractor: 'TEST Spraying Ltd' })).toBeNull();
  });

  it('spray jobs need a rate for every product, and when done, what it was for', () => {
    expect(sprayJobProblem('planned', [{ rate: '2' }, { rate: '' }], '')).toMatch(/rate for every product/);
    expect(sprayJobProblem('planned', [{ rate: '2' }], '')).toBeNull();
    expect(sprayJobProblem('completed', [{ rate: '2' }], '')).toMatch(/sprayed for/);
    expect(sprayJobProblem('completed', [{ rate: '2' }], 'TEST thistles')).toBeNull();
  });
});
