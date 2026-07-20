/**
 * valhalla-route.ts — Valhalla routing API wrapper.
 *
 * Uses the public Valhalla instance at valhalla1.openstreetmap.de
 * for free, no-auth pedestrian routing on OSM data.
 * See: https://valhalla.github.io/valhalla/api/route/api-reference/
 */

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const VALHALLA_TIMEOUT = 15_000; // ms

export interface ValhallaRoute {
  coordinates: [number, number][]; // [lng, lat][]
  distanceKm: number;
  durationSec: number;
}

/**
 * Decode a Google Encoded Polyline string to [lng, lat][] coordinates.
 * Ported from the official polyline-encoded algorithm:
 *   https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let idx = 0;
  let lat = 0;
  let lng = 0;

  while (idx < encoded.length) {
    // Latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(idx++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    // Longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(idx++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coords.push([lng * 1e-6, lat * 1e-6]);
  }

  return coords;
}

/**
 * Fetch a pedestrian route between two points using Valhalla.
 * Returns the route geometry + summary, or null on failure.
 */
export async function fetchValhallaRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): Promise<ValhallaRoute | null> {
  const requestBody = JSON.stringify({
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing: 'pedestrian',
    directions_options: { units: 'kilometers' },
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALHALLA_TIMEOUT);

    const resp = await fetch(
      `${VALHALLA_URL}?json=${encodeURIComponent(requestBody)}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TilgjengelighetApp/1.0 (route-planner)',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!resp.ok) return null;

    const data: any = await resp.json();
    const trip = data?.trip;
    if (!trip?.legs?.[0]) return null;

    const leg = trip.legs[0];
    const summary = trip.summary;

    const encodedShape = leg.shape;
    if (!encodedShape || typeof encodedShape !== 'string') return null;

    const coordinates = decodePolyline(encodedShape);
    if (coordinates.length < 2) return null;

    return {
      coordinates,
      distanceKm: summary?.length ?? 0,
      durationSec: summary?.time ?? 0,
    };
  } catch {
    return null;
  }
}
