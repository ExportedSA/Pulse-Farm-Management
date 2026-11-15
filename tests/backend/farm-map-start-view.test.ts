// Where the farm map opens: on the farm, not the default spot, as soon as anything is drawn on it
import { describe, it, expect } from 'vitest';
import { farmBounds, isView, startView } from '../../client/src/components/farm-map/startView';

const empty = { paddocks: [], features: [], hazards: [], exclusions: [], views: [] } as any;
const fence = { geometry: { type: 'LineString', coordinates: [[172.10, -43.50], [172.12, -43.52]] } };
const paddock = { geometry: { type: 'Polygon', coordinates: [[[172.0, -43.6], [172.05, -43.6], [172.05, -43.55], [172.0, -43.6]]] } };
const lastView = { lat: -43.4, lng: 172.3, zoom: 15 };

describe('farm map start view', () => {
  it('frames a farm that has a fence line but no paddocks yet', () => {
    expect(startView({ ...empty, features: [fence] }, null)).toEqual({ bounds: [172.10, -43.52, 172.12, -43.50] });
  });

  it('frames paddocks, features, hazards and exclusions together', () => {
    const hazard = { geometry: { type: 'Point', coordinates: [172.2, -43.45] } };
    expect(farmBounds({ ...empty, paddocks: [paddock, { geometry: null }], features: [fence], hazards: [hazard, { geometry: null }] }))
      .toEqual([172.0, -43.6, 172.2, -43.45]);
  });

  it('with nothing drawn, opens where this person last looked, then on a saved view', () => {
    const saved = { lat: -43.0, lng: 171.0, zoom: 13, name: 'TEST' };
    expect(startView({ ...empty, views: [saved] }, lastView)).toEqual(lastView);
    expect(startView({ ...empty, views: [saved] }, null)).toEqual({ lat: -43.0, lng: 171.0, zoom: 13 });
    expect(startView(empty, null)).toBeNull();
  });

  it('ignores a damaged remembered view', () => {
    expect(isView({ lat: 'x', lng: 1, zoom: 2 })).toBe(false);
    expect(isView({ lat: 95, lng: 1, zoom: 2 })).toBe(false);
    expect(startView(empty, { lat: NaN, lng: 1, zoom: 2 } as any)).toBeNull();
  });
});
