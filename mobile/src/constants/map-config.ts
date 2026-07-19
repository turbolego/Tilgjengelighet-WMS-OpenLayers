/** Map configuration shared across components */

export const WMS_URL = 'https://wms.geonorge.no/skwms1/wms.tilgjengelighet3';
export const CAPABILITIES_URL = `${WMS_URL}?request=GetCapabilities&service=WMS&language=Norwegian`;
export const STEDSNAVN_URL = 'https://ws.geonorge.no/stedsnavn/v1/navn';
export const IMAGE_BASE_URL = 'https://wfs.geonorge.no/skwfs/tilgjengelighet/bilder';

export const NORWAY_CENTER: [number, number] = [15.5, 65.0]; // [lng, lat]
export const NORWAY_ZOOM = 5;
export const MAX_ZOOM = 18;
export const MIN_ZOOM = 3;

export const BASE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const BASE_MAP_STYLE_TOPO = 'https://tiles.openfreemap.org/styles/topo';

export const WMS_TILE_URL =
  `${WMS_URL}?service=WMS&request=GetMap&version=1.1.1` +
  `&layers=tilgjengelighet3&styles=&format=image/png` +
  `&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}`;

export const HIGHSCORE_QUERY_LAYERS = 'tilgjengelighet3';
export const HIGHSCORE_GRID_SIZE = 8;
export const HIGHSCORE_FEATURE_COUNT = 200;
export const HIGHSCORE_BATCH_SIZE = 8;

// ── OpenRouteService API ───────────────────────────────────────────────
// Get your free API key at https://openrouteservice.org/dev/#/signup
// Free tier: 500 requests/day, 40 requests/minute
export const ORS_API_URL = 'https://api.openrouteservice.org';
export const ORS_API_KEY = ''; // TODO: paste your API key here

export interface LayerInfo {
  name: string;
  title: string;
  legendUrl?: string;
  children: LayerInfo[];
}

export interface FeatureInfo {
  layerName: string;
  featureId: string;
  props: Map<string, string>;
  images: string[];
}