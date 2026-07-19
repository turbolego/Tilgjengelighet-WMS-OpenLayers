/**
 * Map API utilities for Geonorge WMS — adapted from the web app's map-utils.js
 * for React Native. Uses the shared @tilgjengelighet/shared package for
 * parsing and filtering logic.
 */
import {
  parseCapabilities,
  parseFeatureInfoText,
  parseGMLFeatureInfo,
  filterFullyAccessible,
  esc,
} from '@tilgjengelighet/shared';
import {
  WMS_URL,
  CAPABILITIES_URL,
  STEDSNAVN_URL,
  HIGHSCORE_QUERY_LAYERS,
  HIGHSCORE_GRID_SIZE,
  HIGHSCORE_FEATURE_COUNT,
  HIGHSCORE_BATCH_SIZE,
  ACCESSIBILITY_LAYER,
  ACCESSIBILITY_FEATURE_COUNT,
  ACCESSIBILITY_SAMPLE_INTERVAL_M,
  ROUTE_GRAPH_COVERAGE,
  type FeatureInfo,
} from '@/constants/map-config';
import { computeRoute } from './graph-utils';

export { esc, parseCapabilities, parseFeatureInfoText, parseGMLFeatureInfo, filterFullyAccessible };

// ── Coordinate conversion: EPSG:4326 (lon/lat) → EPSG:3857 (Web Mercator meters) ────
// Required because WMS 1.3.0 with EPSG:4326 uses reversed axis order (lat,lon),
// causing BBOX misalignment. All GetFeatureInfo queries use EPSG:3857 to avoid
// this pitfall, matching the web app's proven approach.

function lonLatToMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180;
  const y =
    Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180) *
    (20037508.34 / 180);
  return [x, y];
}

function extent4326to3857(extent: { xMin: number; yMin: number; xMax: number; yMax: number }) {
  const [xMin, yMin] = lonLatToMercator(extent.xMin, extent.yMin);
  const [xMax, yMax] = lonLatToMercator(extent.xMax, extent.yMax);
  return { xMin, yMin, xMax, yMax };
}

// ── GetCapabilities ──────────────────────────────────────────────────────────

export async function fetchCapabilitiesXML(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(CAPABILITIES_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ── GetFeatureInfo ───────────────────────────────────────────────────────────

export function buildFeatureInfoUrl(
  coordinate: [number, number],
  activeLayers: string[],
  zoom: number,
): string {
  const [lng, lat] = coordinate;
  const [mx, my] = lonLatToMercator(lng, lat);

  // Resolution in meters per pixel at this zoom level (Web Mercator)
  const resolution = 156543.03392804097 / Math.pow(2, zoom);
  const pixelSize = resolution / 2;

  const bboxW = pixelSize * 101;
  const bboxH = pixelSize * 101;

  const bbox = `${mx - bboxW},${my - bboxH},${mx + bboxW},${my + bboxH}`;

  const queryLayers =
    activeLayers.length > 0 ? activeLayers.join(',') : 'tilgjengelighet3';

  const params = new URLSearchParams({
    REQUEST: 'GetFeatureInfo',
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    LAYERS: queryLayers,
    QUERY_LAYERS: queryLayers,
    INFO_FORMAT: 'text/plain',
    FEATURE_COUNT: '10',
    I: '50',
    J: '50',
    WIDTH: '101',
    HEIGHT: '101',
    CRS: 'EPSG:3857',
    BBOX: bbox,
    language: 'Norwegian',
  });

  return `${WMS_URL}?${params.toString()}`;
}

export async function fetchFeatureInfo(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Highscore scanning ──────────────────────────────────────────────────────

export async function scanForHighscoreData(
  extent: { xMin: number; yMin: number; xMax: number; yMax: number },
): Promise<ReturnType<typeof parseGMLFeatureInfo>> {
  // Convert degree extent to Web Mercator meters for WMS 1.3.0 query
  const merc = extent4326to3857(extent);
  const gridSize = HIGHSCORE_GRID_SIZE;
  const xStep = (merc.xMax - merc.xMin) / gridSize;
  const yStep = (merc.yMax - merc.yMin) / gridSize;

  const deduped = new Map<string, ReturnType<typeof parseGMLFeatureInfo>[number]>();

  const requests: string[] = [];

  // Build all request URLs (EPSG:3857)
  for (let xi = 0; xi < gridSize; xi++) {
    for (let yi = 0; yi < gridSize; yi++) {
      const cx = merc.xMin + (xi + 0.5) * xStep;
      const cy = merc.yMin + (yi + 0.5) * yStep;
      const cellW = xStep * 1.5;
      const cellH = yStep * 1.5;

      const bbox = `${cx - cellW},${cy - cellH},${cx + cellW},${cy + cellH}`;

      const params = new URLSearchParams({
        QUERY_LAYERS: HIGHSCORE_QUERY_LAYERS,
        INFO_FORMAT: 'application/vnd.ogc.gml',
        REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        FORMAT: 'image/png',
        STYLES: '',
        TRANSPARENT: 'true',
        LAYERS: HIGHSCORE_QUERY_LAYERS,
        language: 'Norwegian',
        FEATURE_COUNT: String(HIGHSCORE_FEATURE_COUNT),
        I: '1',
        J: '1',
        WIDTH: '3',
        HEIGHT: '3',
        CRS: 'EPSG:3857',
        BBOX: bbox,
      });

      requests.push(`${WMS_URL}?${params.toString()}`);
    }
  }

  // Execute in batches
  const batchSize = HIGHSCORE_BATCH_SIZE;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const responses = await Promise.allSettled(
      batch.map((url) =>
        fetch(url).then((r) => r.text()),
      ),
    );

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const features = parseGMLFeatureInfo(result.value);
      for (const feat of features) {
        const objid =
          feat.props.get('objid') || feat.props.get('lokalid') || feat.featureId;
        if (objid && !deduped.has(objid)) {
          deduped.set(objid, feat);
        }
      }
    }
  }

  return [...deduped.values()];
}

// ── Viewport feature scan ──────────────────────────────────────────────────────

export async function scanViewportFeatures(
  extent: { xMin: number; yMin: number; xMax: number; yMax: number },
  activeLayers: string[],
): Promise<FeatureInfo[]> {
  // Convert degree extent to Web Mercator meters
  const merc = extent4326to3857(extent);
  const gridSize = 6;
  const xStep = (merc.xMax - merc.xMin) / gridSize;
  const yStep = (merc.yMax - merc.yMin) / gridSize;

  const deduped = new Map<string, FeatureInfo>();
  const queryLayers =
    activeLayers.length > 0 ? activeLayers.join(',') : 'tilgjengelighet3';
  const requests: string[] = [];

  for (let xi = 0; xi < gridSize; xi++) {
    for (let yi = 0; yi < gridSize; yi++) {
      const cx = merc.xMin + (xi + 0.5) * xStep;
      const cy = merc.yMin + (yi + 0.5) * yStep;
      const cellW = xStep * 0.6;
      const cellH = yStep * 0.6;

      const bbox = `${cx - cellW},${cy - cellH},${cx + cellW},${cy + cellH}`;
      const params = new URLSearchParams({
        REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        LAYERS: queryLayers,
        QUERY_LAYERS: queryLayers,
        INFO_FORMAT: 'text/plain',
        FEATURE_COUNT: '30',
        I: '2',
        J: '2',
        WIDTH: '5',
        HEIGHT: '5',
        CRS: 'EPSG:3857',
        BBOX: bbox,
        language: 'Norwegian',
      });
      requests.push(`${WMS_URL}?${params.toString()}`);
    }
  }

  const batchSize = 8;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const responses = await Promise.allSettled(
      batch.map((url) => fetch(url).then((r) => r.text())),
    );

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const text = result.value;
      if (!text.trim()) continue;
      try {
        const features = parseFeatureInfoText(text);
        for (const feat of features) {
          if (feat.props.size === 0) continue;
          const key = `${feat.layerName}::${feat.featureId}`;
          if (!deduped.has(key)) {
            deduped.set(key, feat);
          }
        }
      } catch {
        // skip malformed responses
      }
    }
  }

  return [...deduped.values()];
}

// ── Place search ────────────────────────────────────────────────────────────

export interface PlaceResult {
  name: string;
  municipality: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.length < 3) return [];
  const url =
    `${STEDSNAVN_URL}?sok=${encodeURIComponent(query)}*&treffPerSide=15&side=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.navn.map(
    (p: { skrivemåte: string; kommuner?: { kommunenavn: string }[]; representasjonspunkt: { nord: number; øst: number } }) => ({
      name: p.skrivemåte,
      municipality: p.kommuner?.[0]?.kommunenavn ?? 'Ukjent',
      lat: p.representasjonspunkt.nord,
      lon: p.representasjonspunkt.øst,
    }),
  );
}

// ── Route planning (local graph + WMS accessibility overlay) ────────────
// Uses a pre-built OSM road graph bundled as a JSON asset.
// Dijkstra's algorithm runs in pure TypeScript — zero network calls.
// After routing, we sample WMS GetFeatureInfo on the t_vei_r layer
// to assess wheelchair accessibility along the path.



export interface RouteAccessibilitySample {
  range: [number, number];  // [startM, endM] along the route
  score: 0 | 1 | 2 | 3;    // 0=no data, 1=not accessible, 2=partial, 3=full
  label: string;
}

export interface RouteResult {
  geojson: any;
  distance: number;
  duration: number;
  distanceLabel: string;
  durationLabel: string;
  segments: RouteAccessibilitySample[];
  accessiblePct: number;
}

function scoreAccessibility(props: Map<string, string>): 0 | 1 | 2 | 3 {
  const r1 = props.get('tilgjengvurderingrulleman') ?? '';
  const r2 = props.get('tilgjengvurderingrulleauto') ?? '';
  const r3 = props.get('tilgjengvurderingelrull') ?? '';
  const r4 = props.get('tilgjengvurderingsyn') ?? '';
  if (!r1 && !r2 && !r3 && !r4) return 0;
  const count =
    (r1 === 'Tilgjengelig' ? 1 : 0) +
    (r2 === 'Tilgjengelig' ? 1 : 0) +
    (r3 === 'Tilgjengelig' ? 1 : 0) +
    (r4 === 'Tilgjengelig' ? 1 : 0);
  if (count === 4) return 3;
  if (count > 0) return 2;
  return 1;
}

async function sampleAccessibilityAt(
  lng: number, lat: number,
): Promise<{ score: 0 | 1 | 2 | 3; label: string }> {
  const bboxSize = 0.002; // ~200m at 60°N
  const bbox = `${lng - bboxSize},${lat - bboxSize},${lng + bboxSize},${lat + bboxSize}`;
  const params = new URLSearchParams({
    REQUEST: 'GetFeatureInfo', SERVICE: 'WMS', VERSION: '1.3.0',
    LAYERS: ACCESSIBILITY_LAYER, QUERY_LAYERS: ACCESSIBILITY_LAYER,
    INFO_FORMAT: 'text/plain', FEATURE_COUNT: String(ACCESSIBILITY_FEATURE_COUNT),
    I: '1', J: '1', WIDTH: '3', HEIGHT: '3',
    CRS: 'EPSG:4326', BBOX: bbox, language: 'Norwegian',
  });
  try {
    const res = await fetch(`${WMS_URL}?${params.toString()}`);
    if (!res.ok) return { score: 0, label: 'Ingen data' };
    const features = parseFeatureInfoText(await res.text());
    let best: 0 | 1 | 2 | 3 = 0;
    for (const f of features) { const s = scoreAccessibility(f.props); if (s > best) best = s; }
    return { score: best, label: best === 3 ? 'Tilgjengelig' : best === 2 ? 'Delvis tilgjengelig' : best === 1 ? 'Ikke tilgjengelig' : 'Ingen data' };
  } catch { return { score: 0, label: 'Ingen data' }; }
}

export async function fetchRoute(
  from: [number, number],
  to: [number, number],
): Promise<RouteResult> {
  // ── 1. Local graph route (pure Dijkstra, zero network) ─────────────
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;

  // Check coverage
  if (
    fromLat < ROUTE_GRAPH_COVERAGE.minLat || fromLat > ROUTE_GRAPH_COVERAGE.maxLat ||
    fromLon < ROUTE_GRAPH_COVERAGE.minLon || fromLon > ROUTE_GRAPH_COVERAGE.maxLon ||
    toLat < ROUTE_GRAPH_COVERAGE.minLat || toLat > ROUTE_GRAPH_COVERAGE.maxLat ||
    toLon < ROUTE_GRAPH_COVERAGE.minLon || toLon > ROUTE_GRAPH_COVERAGE.maxLon
  ) {
    throw new Error(
      'Ruteplanleggeren har kun kartdata for Oslo-området. ' +
      'Velg punkter innenfor Oslo (10.36–11.11° Ø, 59.73–60.09° N).',
    );
  }

  const route = await computeRoute(fromLat, fromLon, toLat, toLon);
  if (!route) {
    throw new Error('Kunne ikke finne en rute mellom disse punktene.');
  }

  const geometry = {
    type: 'LineString' as const,
    coordinates: route.coordinates,
  };

  const distance = route.distance;
  const duration = route.duration;

  const geojson = {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: {}, geometry }],
  };

  // ── 2. Sample accessibility along route ───────────────────────────
  const coords: [number, number][] = geometry.coordinates;
  const samplePts: { m: number; lng: number; lat: number }[] = [];
  if (coords.length >= 2) {
    let acc = 0; let prev: [number, number] = coords[0];
    samplePts.push({ m: 0, lng: prev[0], lat: prev[1] });
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = prev; const [lng2, lat2] = coords[i]; prev = coords[i];
      const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
      const seg = 6371000 * 2 * Math.atan2(
        Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2),
        Math.sqrt(1 - (Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2)),
      );
      acc += seg;
      if (acc >= ACCESSIBILITY_SAMPLE_INTERVAL_M) { samplePts.push({ m: acc, lng: lng2, lat: lat2 }); acc = 0; }
    }
    const last = coords[coords.length - 1];
    samplePts.push({ m: distance, lng: last[0], lat: last[1] });
  }

  const samples: { m: number; score: 0 | 1 | 2 | 3; label: string }[] = [];
  for (let i = 0; i < samplePts.length; i += 10) {
    const results = await Promise.allSettled(samplePts.slice(i, i + 10).map(p => sampleAccessibilityAt(p.lng, p.lat)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      samples.push({
        m: samplePts[i + j].m,
        ...(r.status === 'fulfilled' ? r.value : { score: 0 as const, label: 'Ingen data' }),
      });
    }
  }

  // ── 3. Build segments ─────────────────────────────────────────────
  const segments: RouteAccessibilitySample[] = [];
  let accessibleMeters = 0; let totalSampled = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const segM = samples[i + 1].m - samples[i].m;
    totalSampled += segM;
    if (samples[i].score === 3) accessibleMeters += segM;
    segments.push({ range: [samples[i].m, samples[i + 1].m], score: samples[i].score, label: samples[i].label });
  }

  return {
    geojson, distance, duration,
    distanceLabel: distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`,
    durationLabel: duration >= 3600 ? `${Math.floor(duration / 3600)} t ${Math.round((duration % 3600) / 60)} min` : `${Math.round(duration / 60)} min`,
    segments,
    accessiblePct: totalSampled > 0 ? Math.round((accessibleMeters / totalSampled) * 100) : 0,
  };
}