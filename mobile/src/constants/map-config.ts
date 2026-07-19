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

// ── Graph coverage ─────────────────────────────────────────────────────
// The client-side routing graph covers Oslo and surrounding areas.
// Coverage bounds (decimal degrees):
export const ROUTE_GRAPH_COVERAGE = {
  minLat: 59.728,
  maxLat: 60.090,
  minLon: 10.358,
  maxLon: 11.116,
};

// ── Accessibility assessment layer ─────────────────────────────────────
// The t_vei_r layer contains road segments with wheelchair accessibility
// assessment properties (tilgjengvurderingrulleman, etc.). We sample this
// along the route to color segments by accessibility.
export const ACCESSIBILITY_LAYER = 't_vei_r';
export const ACCESSIBILITY_FEATURE_COUNT = 5;
export const ACCESSIBILITY_SAMPLE_INTERVAL_M = 100; // sample every 100m

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