/**
 * toilet-search.ts — Overpass-based search for nearest toilet (amenity=toilets).
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT = 10_000; // ms

export interface ToiletResult {
  lat: number;
  lon: number;
  name: string;
  distanceKm: number;
}

/**
 * Find the nearest toilet (amenity=toilets) within `radiusMeters` of
 * a given location using OSM Overpass API.
 * Returns the closest toilet with estimated distance, or null if none found.
 */
export async function findNearestToilet(
  lat: number,
  lon: number,
  radiusMeters = 3000,
): Promise<ToiletResult | null> {
  // Use a compact Overpass query — fetch nodes + ways around the point
  const query = [
    '[out:json][timeout:10];',
    '(',
    `  node["amenity"="toilets"](around:${radiusMeters},${lat},${lon});`,
    `  way["amenity"="toilets"](around:${radiusMeters},${lat},${lon});`,
    ');',
    'out body center;',
  ].join('\n');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT);

    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TilgjengelighetApp/1.0 (toilet-search)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) return null;

    const data: any = await resp.json();
    const elements: any[] = data?.elements ?? [];
    if (elements.length === 0) return null;

    // Build toilet list with distance
    const toilets: { lat: number; lon: number; name: string; dist: number }[] = [];

    for (const el of elements) {
      const tLat =
        el.type === 'node'
          ? el.lat
          : el.center?.lat;
      const tLon =
        el.type === 'node'
          ? el.lon
          : el.center?.lon;

      if (tLat == null || tLon == null) continue;

      const dist = haversineKm(lat, lon, tLat, tLon);
      const tags = el.tags ?? {};
      const name =
        tags.name ??
        tags.operator ??
        tags.description ??
        tags.toilets ??
        tags.amenity ??
        'Toalett';

      toilets.push({ lat: tLat, lon: tLon, name: String(name), dist });
    }

    if (toilets.length === 0) return null;

    // Sort by distance and return the nearest
    toilets.sort((a, b) => a.dist - b.dist);
    const nearest = toilets[0];
    return {
      lat: nearest.lat,
      lon: nearest.lon,
      name: nearest.name,
      distanceKm: Math.round(nearest.dist * 100) / 100,
    };
  } catch {
    return null;
  }
}

/** Haversine distance between two lat/lon points in km. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
