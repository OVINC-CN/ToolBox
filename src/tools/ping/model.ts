import type { Region } from './regions';

const EARTH_RADIUS_KM = 6371;
const TO_RADIANS = Math.PI / 180;

export interface LatencyEstimate {
  distanceKm: number;
  rttMs: number;
  minRttMs: number;
  maxRttMs: number;
}

export interface Route {
  id: string;
  source: Region;
  target: Region;
  estimate: LatencyEstimate;
  bidirectional: boolean;
}

export type Coordinates = [latitude: number, longitude: number];

export function routeId(source: Region, target: Region): string {
  return [source.code, target.code].sort().join('-');
}

export function estimateLatency(source: Region, target: Region): LatencyEstimate {
  const latitudeDelta = (target.latitude - source.latitude) * TO_RADIANS;
  const longitudeDelta = (target.longitude - source.longitude) * TO_RADIANS;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(source.latitude * TO_RADIANS)
    * Math.cos(target.latitude * TO_RADIANS)
    * Math.sin(longitudeDelta / 2) ** 2;
  const distanceKm = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
  const propagationRtt = distanceKm / 100;

  return {
    distanceKm,
    rttMs: Math.round(2.1 * propagationRtt + 5),
    minRttMs: Math.round(1.3 * propagationRtt + 2),
    maxRttMs: Math.round(3 * propagationRtt + 15),
  };
}

export function buildRoutes(sources: readonly Region[], targets: readonly Region[]): Route[] {
  const routes = new Map<string, Route>();
  for (const source of sources) {
    for (const target of targets) {
      if (source.code === target.code) {
        continue;
      }
      const id = routeId(source, target);
      const existing = routes.get(id);
      if (existing) {
        existing.bidirectional = true;
      }
      else {
        routes.set(id, { id, source, target, estimate: estimateLatency(source, target), bidirectional: false });
      }
    }
  }
  return [...routes.values()];
}

export function countCombinations(sources: readonly Region[], targets: readonly Region[]): number {
  const targetCodes = new Set(targets.map(region => region.code));
  return sources.length * targets.length - sources.filter(region => targetCodes.has(region.code)).length;
}

export function latencyBand(rttMs: number): 'low' | 'medium' | 'high' {
  return rttMs < 50 ? 'low' : rttMs < 150 ? 'medium' : 'high';
}

export function longitudeNear(longitude: number, center = 180): number {
  return longitude + 360 * Math.round((center - longitude) / 360);
}

// Fit one compact world interval instead of combining different wrapped copies.
export function alignWorldCoordinates(coordinates: readonly Coordinates[]): Coordinates[] {
  if (coordinates.length === 0) {
    return [];
  }
  const longitudes = coordinates.map(([, longitude]) => ((longitude % 360) + 360) % 360).sort((first, second) => first - second);
  let largestGap = -1;
  let intervalStart = 0;
  for (const [index, longitude] of longitudes.entries()) {
    const next = longitudes.at(index + 1) ?? (longitudes.at(0) ?? 0) + 360;
    const gap = next - longitude;
    if (gap > largestGap) {
      largestGap = gap;
      intervalStart = next;
    }
  }
  const center = longitudeNear(intervalStart + (360 - largestGap) / 2);
  return coordinates.map(([latitude, longitude]) => [latitude, longitudeNear(longitude, center)]);
}

function toVector(region: Region): [number, number, number] {
  const latitude = region.latitude * TO_RADIANS;
  const longitude = region.longitude * TO_RADIANS;
  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
}

// Unwrap each sample to its predecessor so Pacific routes do not jump by 360°.
export function greatCirclePoints(source: Region, target: Region): Coordinates[] {
  const start = toVector(source);
  const end = toVector(target);
  const cosine = start[0] * end[0] + start[1] * end[1] + start[2] * end[2];
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const sine = Math.sin(angle);
  if (Math.abs(sine) < 1e-10) {
    return [
      [source.latitude, longitudeNear(source.longitude)],
      [target.latitude, longitudeNear(target.longitude, longitudeNear(source.longitude))],
    ];
  }

  const points: Coordinates[] = [];
  let previousLongitude = longitudeNear(source.longitude);
  for (let index = 0; index <= 96; index++) {
    const fraction = index / 96;
    const startWeight = Math.sin((1 - fraction) * angle) / sine;
    const endWeight = Math.sin(fraction * angle) / sine;
    const x = startWeight * start[0] + endWeight * end[0];
    const y = startWeight * start[1] + endWeight * end[1];
    const z = startWeight * start[2] + endWeight * end[2];
    const latitude = Math.atan2(z, Math.hypot(x, y)) / TO_RADIANS;
    const longitude = longitudeNear(Math.atan2(y, x) / TO_RADIANS, previousLongitude);
    points.push([latitude, longitude]);
    previousLongitude = longitude;
  }
  const midpoint = points.at(48);
  const offset = midpoint ? longitudeNear(midpoint[1]) - midpoint[1] : 0;
  return points.map(([latitude, longitude]) => [latitude, longitude + offset]);
}
