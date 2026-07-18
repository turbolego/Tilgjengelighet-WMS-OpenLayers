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
  type FeatureInfo,
} from '@/constants/map-config';

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