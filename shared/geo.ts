// Map geometry helpers shared by the server and the app.
// Coordinates follow GeoJSON: [longitude, latitude].

export type Position = [number, number];
export type AreaGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

const EARTH_RADIUS_M = 6378137;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Area of one ring in m² on a sphere (the method used by turf's ringArea)
 */
function ringAreaM2(ring: Position[]): number {
  const n = ring.length; // closed ring: last point repeats the first
  if (n <= 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = i === n - 2 ? n - 2 : i === n - 1 ? n - 1 : i;
    const middle = i === n - 2 ? n - 1 : i === n - 1 ? 0 : i + 1;
    const upper = i === n - 2 ? 0 : i === n - 1 ? 1 : i + 2;
    total += (rad(ring[upper][0]) - rad(ring[lower][0])) * Math.sin(rad(ring[middle][1]));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

function polygonAreaM2(rings: Position[][]): number {
  if (rings.length === 0) return 0;
  // Outer ring minus any holes
  return rings.slice(1).reduce((area, hole) => area - ringAreaM2(hole), ringAreaM2(rings[0]));
}

/**
 * Hectares covered by a Polygon or MultiPolygon
 */
export function areaHectares(geometry: AreaGeometry): number {
  const m2 = geometry.type === 'Polygon'
    ? polygonAreaM2(geometry.coordinates)
    : geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);
  return Math.round((m2 / 10_000) * 100) / 100;
}

function validRing(ring: unknown): ring is Position[] {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(p =>
    Array.isArray(p) && p.length >= 2 &&
    typeof p[0] === 'number' && typeof p[1] === 'number' &&
    p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90);
}

/**
 * Whether a value is a usable GeoJSON Polygon/MultiPolygon (closed rings of [lng, lat])
 */
export function isAreaGeometry(value: unknown): value is AreaGeometry {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  const closed = (ring: Position[]) => ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const polygonOk = (rings: unknown) => Array.isArray(rings) && rings.length > 0 && rings.every(r => validRing(r) && closed(r));
  if (g.type === 'Polygon') return polygonOk(g.coordinates);
  if (g.type === 'MultiPolygon') return Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every(polygonOk);
  return false;
}

/**
 * Close a list of tapped points into a GeoJSON polygon
 */
export function pointsToPolygon(points: Position[]): AreaGeometry | null {
  if (points.length < 3) return null;
  return { type: 'Polygon', coordinates: [[...points, points[0]]] };
}
