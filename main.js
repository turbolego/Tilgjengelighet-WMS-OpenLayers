/**
 * Geonorge Tilgjengelighet WMS Viewer
 * OL 10 — native Controls + Overlay popup
 */

import 'ol/ol.css';
import OLMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Attribution } from 'ol/control';
import Control from 'ol/control/Control';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import {
  esc,
  filterFullyAccessible,
  parseCapabilities,
  parseFeatureInfoText,
  parseGMLFeatureInfo,
} from './map-utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const WMS_URL          = 'https://wms.geonorge.no/skwms1/wms.tilgjengelighet3';
const CAPABILITIES_URL = `${WMS_URL}?request=GetCapabilities&service=WMS&language=Norwegian`;

const NORWAY_CENTER = fromLonLat([15.5, 65.0]);
const NORWAY_ZOOM   = 5;

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  olLayers:     new Map(),
  activeLayers: new Set(),
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const elLayerLoading  = document.getElementById('layer-loading');
const elLayerTree     = document.getElementById('layer-tree');
const elStatusZoom    = document.getElementById('status-zoom');
const elStatusLayers  = document.getElementById('status-layers');
const elMapContainer  = document.getElementById('map');
const elPlaceSearch   = document.getElementById('place-search');
const elSearchResults = document.getElementById('search-results');

// Settings panel refs
const elSettingsPanel    = document.getElementById('settings-panel');
const elBtnCloseSettings = document.getElementById('btn-close-settings');
const elBtnOpenSettings  = document.getElementById('btn-open-settings');

// Action bar refs
const elBtnZoomIn  = document.getElementById('btn-zoom-in');
const elBtnZoomOut = document.getElementById('btn-zoom-out');
const elBtnReset   = document.getElementById('btn-reset-view');
const elBtnGPS     = document.getElementById('btn-gps');

// Popup refs
const elPopup        = document.getElementById('popup');
const elPopupContent = document.getElementById('popup-content');
const elPopupCloser  = document.getElementById('popup-closer');

// Highscore refs
const elHighscoreModal   = document.getElementById('highscore-modal');
const elHighscoreContent = document.getElementById('highscore-content');
const elHighscoreCloser  = document.getElementById('highscore-closer');
const elBtnHighscore     = document.getElementById('btn-highscore');
const elBtnFeatureList   = document.getElementById('btn-feature-list');
const elBtnSearch        = document.getElementById('btn-search');
const elBtnRoute         = document.getElementById('btn-route');
const elBtnToilet        = document.getElementById('btn-toilet');

// Feature list refs
const elFeatureListModal   = document.getElementById('feature-list-modal');
const elFeatureListContent = document.getElementById('feature-list-content');
const elFeatureListCloser  = document.getElementById('feature-list-closer');

// Nearest toilet modal refs
const elToiletModal       = document.getElementById('toilet-modal');
const elToiletCloser      = document.getElementById('toilet-closer');
const elToiletFrom        = document.getElementById('toilet-from');
const elToiletTo          = document.getElementById('toilet-to');
const elToiletFromResults = document.getElementById('toilet-from-results');
const elToiletStatus      = document.getElementById('toilet-status');
const elBtnToiletFind     = document.getElementById('btn-toilet-find');
const elBtnToiletFromGps  = document.getElementById('btn-toilet-from-gps');

let toiletFromCoords = null;

// Route planner refs
const elRouteModal      = document.getElementById('route-modal');
const elRouteContent    = document.getElementById('route-content');
const elRouteCloser     = document.getElementById('route-closer');
const elRouteFrom       = document.getElementById('route-from');
const elRouteTo         = document.getElementById('route-to');
const elRouteFromResults = document.getElementById('route-from-results');
const elRouteToResults   = document.getElementById('route-to-results');
const elBtnComputeRoute  = document.getElementById('btn-compute-route');
const elRouteStatus      = document.getElementById('route-status');

// ── Base layers ───────────────────────────────────────────────────────────────

const osmSource = new OSM();

const topoSource = new XYZ({
  url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
  attributions: '© <a href="https://www.kartverket.no/">Kartverket</a>',
  crossOrigin: 'anonymous',
});

const baseLayer = new TileLayer({ source: osmSource, zIndex: 0 });

// ── Composite WMS layer ───────────────────────────────────────────────────────

const compositeLayer = new ImageLayer({
  source: new ImageWMS({
    url: WMS_URL,
    params: { LAYERS: 'tilgjengelighet3', FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.3.0', language: 'Norwegian' },
    ratio: 1, serverType: 'mapserver', crossOrigin: 'anonymous',
  }),
  zIndex: 5, visible: true, opacity: 1,
});

// ── Feature info modal — same show/hide pattern as settings ──────────────────

const elPopupTitle = document.getElementById('popup-title');

function openPopup(titleText) {
  if (titleText) elPopupTitle.textContent = titleText;
  elPopup.hidden = false;
}

function closePopup() {
  elPopup.hidden = true;
}

elPopupCloser.addEventListener('click', () => {
  closePopup();
  elPopupCloser.blur();
});

// Close on backdrop click (click outside modal inner)
elPopup.addEventListener('click', (e) => {
  if (e.target === elPopup) closePopup();
});

// ── OL Controls ──────────────────────────────────────────────────────────────

const popupControl = new Control({
  element: elPopup,
});

const highscoreControl = new Control({
  element: elHighscoreModal,
});

const actionBarControl = new Control({
  element: document.getElementById('action-bar'),
});

const settingsPanelControl = new Control({
  element: elSettingsPanel,
});

const statusBarControl = new Control({
  element: document.getElementById('status-bar'),
});

const attributionControl = new Attribution({ collapsible: true });

// ── Map ───────────────────────────────────────────────────────────────────────

const map = new OLMap({
  target: 'map',
  layers: [baseLayer, compositeLayer],
  view: new View({
    center:  NORWAY_CENTER,
    zoom:    NORWAY_ZOOM,
    minZoom: 3,
    maxZoom: 18,
  }),
  controls: [popupControl, highscoreControl, actionBarControl, settingsPanelControl, statusBarControl, attributionControl],
  keyboardEventTarget: document,
});

map.once('rendercomplete', () => {
  const canvas = elMapContainer.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interaktivt kart over tilgjengelighetdata i Norge');
  }
});

// ── Status bar ────────────────────────────────────────────────────────────────

map.getView().on('change:resolution', () => {
  elStatusZoom.textContent = Math.round(map.getView().getZoom());
});

function updateLayerCount() {
  elStatusLayers.textContent = state.activeLayers.size;
}

// ── Keyboard: Enter on map → GetFeatureInfo at center ─────────────────────────

elMapContainer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const center = map.getView().getCenter();
    doGetFeatureInfo(center, center);
  }
});

// ── Action bar controls ───────────────────────────────────────────────────────

elBtnZoomIn.addEventListener('click', () => {
  const view = map.getView();
  view.animate({ zoom: view.getZoom() + 1, duration: 250 });
});

elBtnZoomOut.addEventListener('click', () => {
  const view = map.getView();
  view.animate({ zoom: view.getZoom() - 1, duration: 250 });
});

elBtnReset.addEventListener('click', () => {
  map.getView().animate({ center: NORWAY_CENTER, zoom: NORWAY_ZOOM, duration: 400 });
});

// ── Settings panel open/close ─────────────────────────────────────────────────

function openSettings() {
  elSettingsPanel.hidden = false;
  elBtnOpenSettings.setAttribute('aria-expanded', 'true');
  elBtnCloseSettings.focus();
}

function closeSettings() {
  elSettingsPanel.hidden = true;
  elBtnOpenSettings.setAttribute('aria-expanded', 'false');
  elBtnOpenSettings.focus();
}

elBtnOpenSettings.addEventListener('click', openSettings);
elBtnCloseSettings.addEventListener('click', closeSettings);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!elSettingsPanel.hidden) closeSettings();
    else if (!elPopup.hidden) closePopup();
    else if (!elHighscoreModal.hidden) closeHighscore();
  }
});

// ── Basemap switcher ──────────────────────────────────────────────────────────

document.querySelectorAll('input[name="basemap"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'osm')  { baseLayer.setSource(osmSource);  baseLayer.setVisible(true); }
    if (radio.value === 'topo') { baseLayer.setSource(topoSource); baseLayer.setVisible(true); }
    if (radio.value === 'none') { baseLayer.setVisible(false); }
  });
});

// ── GetCapabilities: regex-based XML parsing ──────────────────────────────────

async function fetchCapabilitiesXML() {
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

// ── OL sublayer factory ───────────────────────────────────────────────────────

function createSubLayer(layerName) {
  return new ImageLayer({
    source: new ImageWMS({
      url: WMS_URL,
      params: { LAYERS: layerName, FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.3.0', language: 'Norwegian' },
      ratio: 1, serverType: 'mapserver', crossOrigin: 'anonymous',
    }),
    zIndex: 10, visible: false, opacity: 0.9,
  });
}

// ── Layer tree UI ─────────────────────────────────────────────────────────────

function buildLayerTree(topGroups) {
  elLayerTree.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'layer-item layer-item--composite';
  const allLabel = document.createElement('label');
  const allCb = document.createElement('input');
  allCb.type = 'checkbox'; allCb.checked = true;
  allCb.setAttribute('aria-label', 'Vis alle lag (sammensatt visning)');
  const allSpan = document.createElement('span');
  allSpan.textContent = 'Alle lag (sammensatt)'; allSpan.style.fontWeight = '600';
  allLabel.append(allCb, allSpan);
  allItem.appendChild(allLabel);
  elLayerTree.appendChild(allItem);
  allCb.addEventListener('change', () => compositeLayer.setVisible(allCb.checked));

  const divider = document.createElement('div');
  divider.className = 'layer-divider'; divider.setAttribute('aria-hidden', 'true');
  elLayerTree.appendChild(divider);

  for (const group of topGroups) {
    const nc = group.children.filter(c => c.name);
    if (group.name && nc.length === 0) elLayerTree.appendChild(makeLeaf(group));
    else if (nc.length > 0) elLayerTree.appendChild(makeGroup(group));
  }

  elLayerTree.hidden = false;
}

function makeGroup(group) {
  const wrap = document.createElement('div');
  wrap.className = 'layer-group';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'layer-group-header';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', `Ekspander gruppe: ${group.title}`);
  const arrow = document.createElement('span');
  arrow.className = 'layer-group-arrow'; arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '▶';
  btn.append(arrow, document.createTextNode(' ' + group.title));
  wrap.appendChild(btn);
  const body = document.createElement('div');
  body.className = 'layer-group-children'; body.hidden = true;
  for (const child of group.children) {
    if (!child.name) continue;
    body.appendChild(child.children.some(c => c.name) ? makeGroup(child) : makeLeaf(child));
  }
  wrap.appendChild(body);
  btn.addEventListener('click', () => {
    const opening = body.hidden;
    body.hidden = !opening;
    arrow.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', String(opening));
    btn.setAttribute('aria-label', `${opening ? 'Skjul' : 'Ekspander'} gruppe: ${group.title}`);
  });
  return wrap;
}

function makeLeaf(layer) {
  if (!layer.name) return document.createDocumentFragment();
  if (!state.olLayers.has(layer.name)) {
    const ol = createSubLayer(layer.name);
    map.addLayer(ol);
    state.olLayers.set(layer.name, ol);
  }
  const item = document.createElement('div');
  item.className = 'layer-item';
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.setAttribute('aria-label', `Vis lag: ${layer.title}`);
  const span = document.createElement('span');
  span.textContent = layer.title;
  label.append(cb, span);
  item.appendChild(label);
  if (layer.legendUrl) {
    const img = document.createElement('img');
    img.src = layer.legendUrl; img.alt = `Tegnforklaring for ${layer.title}`;
    img.loading = 'lazy'; img.className = 'layer-legend-img';
    item.appendChild(img);
  }
  cb.addEventListener('change', () => {
    const ol = state.olLayers.get(layer.name);
    if (!ol) return;
    ol.setVisible(cb.checked);
    if (cb.checked) state.activeLayers.add(layer.name);
    else            state.activeLayers.delete(layer.name);
    updateLayerCount();
  });
  return item;
}

// ── GetFeatureInfo — shown in OL popup overlay ────────────────────────────────

map.on('singleclick', (evt) => {
  doGetFeatureInfo(evt.coordinate);
});

async function doGetFeatureInfo(coordinate) {
  elPopupContent.innerHTML = `<div class="popup-loading"><div class="spinner"></div> Henter stedsinfo…</div>`;
  openPopup('Stedsinfo');

  const queryLayers = state.activeLayers.size > 0
    ? [...state.activeLayers].join(',')
    : 'tilgjengelighet3';

  const resolution = map.getView().getResolution();
  const url = compositeLayer.getSource().getFeatureInfoUrl(
    coordinate, resolution, 'EPSG:3857',
    { INFO_FORMAT: 'text/plain', QUERY_LAYERS: queryLayers, LAYERS: queryLayers, FEATURE_COUNT: 10 }
  );

  if (!url) {
    elPopupContent.innerHTML = `<p class="popup-empty">Kan ikke hente info ved dette zoomnivået.</p>`;
    return;
  }

  try {
    const res  = await fetch(url);
    const text = await res.text();
    renderPopup(text, coordinate);
  } catch {
    elPopupContent.innerHTML = `<p style="color:var(--red-warn)">Feil ved henting av stedsinfo.</p>`;
  }
}

// ── Render popup ──────────────────────────────────────────────────────────────

function renderPopup(text, coord) {
  const [lon, lat] = toLonLat(coord).map(v => v.toFixed(5));
  const features = parseFeatureInfoText(text);

  // No data — close silently instead of showing an empty modal
  const hasData = features.some(f => f.props.size > 0);
  if (!hasData) {
    closePopup();
    return;
  }

  // Set modal title to clicked coordinate
  elPopupTitle.textContent = `${lat}° N, ${lon}° Ø`;

  // Deduplicate by layerName + featureId
  const seen = new Set();
  const unique = features.filter(f => {
    const key = `${f.layerName}::${f.featureId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const allImages = [...new Set(unique.flatMap(f => f.images).filter(Boolean))];

  let html = '';

  for (const feat of unique) {
    if (feat.props.size === 0) continue;

    html += `<p class="popup-layer-label">${esc(feat.layerName)}`;
    if (feat.featureId) html += ` · #${esc(feat.featureId)}`;
    html += `</p>`;

    html += `<table><caption class="sr-only">Egenskaper for valgt punkt</caption>
      <thead><tr><th scope="col">Egenskap</th><th scope="col">Verdi</th></tr></thead><tbody>`;

    for (const [k, v] of feat.props) {
      if (!v || /^bildefil[123]$/i.test(k)) continue;
      html += `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  if (allImages.length > 0) {
    html += `<div class="popup-images" role="list" aria-label="Bilder av stedet">`;
    for (const filename of allImages) {
      const src = `https://data.kartverket.no/tilgjengelighet/tilgjengelighet/${encodeURIComponent(filename)}`;
      html += `<img
        src="${src}"
        alt="Bilde: ${esc(filename)}"
        loading="lazy"
        role="listitem"
        onerror="this.style.display='none'"
        onclick="window.open('${src}','_blank','noopener')"
        title="Åpne bilde i ny fane"
      />`;
    }
    html += `</div>`;
  }

  elPopupContent.innerHTML = html;
}

// ── Place search ──────────────────────────────────────────────────────────────

elPlaceSearch.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (query.length < 3) { elSearchResults.innerHTML = ''; return; }
  try {
    const res = await fetch(`https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(query)}*&treffPerSide=15&side=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    elSearchResults.innerHTML = data.navn
      .map(p => `<li data-lat="${p.representasjonspunkt.nord}" data-lon="${p.representasjonspunkt.øst}">${p.skrivemåte} – ${p.kommuner?.[0]?.kommunenavn || 'Ukjent'}</li>`)
      .join('');
  } catch (err) {
    console.error('Search error:', err);
    elSearchResults.innerHTML = '<li>Feil ved søk.</li>';
  }
});

elSearchResults.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const lat = parseFloat(li.dataset.lat), lon = parseFloat(li.dataset.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    map.getView().animate({ center: fromLonLat([lon, lat]), zoom: 12, duration: 400 });
  }
  elSearchResults.innerHTML = '';
  elPlaceSearch.value = '';
  closeSettings();
});

// ── Toast notification ────────────────────────────────────────────────────────

function showToast(message, type = 'error') {
  const existing = document.getElementById('map-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'map-toast';
  toast.className = `map-toast map-toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger reflow so the enter transition fires
  requestAnimationFrame(() => toast.classList.add('map-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('map-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4000);
}

// ── GPS ───────────────────────────────────────────────────────────────────────

let gpsLayer = null;

function placeGPSDot(pos) {
  const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
  if (!gpsLayer) {
    const feature = new Feature({ geometry: new Point(coords) });
    feature.setStyle(new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#e8a020' }),
        stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
      }),
    }));
    gpsLayer = new VectorLayer({
      source: new VectorSource({ features: [feature] }),
      zIndex: 20,
    });
    map.addLayer(gpsLayer);
  } else {
    gpsLayer.getSource().getFeatures()[0].setGeometry(new Point(coords));
  }
  map.getView().animate({ center: coords, zoom: 14, duration: 500 });
}

function gpsErrorMessage(code) {
  if (code === 1) return 'Posisjonstilgang nektet – sjekk nettleser- eller systeminnstillinger.';
  if (code === 2) return 'Posisjon utilgjengelig. Prøv igjen, eller sjekk at posisjonstjenester er aktivert.';
  if (code === 3) return 'Tidsavbrudd ved henting av posisjon. Prøv igjen.';
  return 'Kunne ikke hente posisjon.';
}

elBtnGPS.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolokasjon støttes ikke i denne nettleseren.');
    return;
  }

  elBtnGPS.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      placeGPSDot(pos);
      elBtnGPS.disabled = false;
    },
    (err) => {
      console.error(err);
      showToast(gpsErrorMessage(err.code));
      elBtnGPS.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 20000 } // Increased timeout to 20 seconds
  );
});

// ── Highscore modal open/close ────────────────────────────────────────────────

function openHighscore() {
  elHighscoreModal.hidden = false;
}

function closeHighscore() {
  elHighscoreModal.hidden = true;
}

elHighscoreCloser.addEventListener('click', () => {
  closeHighscore();
  elBtnHighscore.focus();
});

elHighscoreModal.addEventListener('click', (e) => {
  if (e.target === elHighscoreModal) closeHighscore();
});

// ── Highscore data scanning ───────────────────────────────────────────────────


/**
 * Loads pre-generated highscore data from the bundled highscore.dat file.
 * Returns parsed entries with EPSG:3857 center coordinates and property maps.
 * Falls back to live WMS scan of all-Norway extent if the file is unavailable.
 */
let highscoreFileCache = null;
let highscoreRenderedHTML = null;

async function loadHighscoreFromFile() {
  if (highscoreFileCache) return highscoreFileCache;

  try {
    const resp = await fetch('highscore.dat', { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const entries = await resp.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('Empty or invalid highscore data');
    }
    // Convert compact format { p: {...}, x, y } to HighscoreFeature with Map props
    const features = entries.map(e => ({
      featureId: e.featureId || null,
      layerName: e.layerName || null,
      props: new Map(Object.entries(e.p || {})),
      centerX: e.x,
      centerY: e.y,
      images: [],
    }));
    highscoreFileCache = features;
    return features;
  } catch (fileErr) {
    console.warn('highscore.dat not available, falling back to WMS scan:', fileErr);
    // Fallback: live WMS scan on the current viewport
  }

  return null;
}


/**
 * Scans the current map view using a grid of GetFeatureInfo requests
 * to find fully accessible road segments.
 */
async function scanForHighscoreData() {
  const view = map.getView();
  const extent = view.calculateExtent(map.getSize());

  // Use the turvei layers which contain road accessibility data
  const queryLayers = 'tilgjengelighet3';

  // Strategy: Use WIDTH=3, HEIGHT=3 with I=1, J=1 so the center pixel covers
  // 1/3 of the cell bbox. Use overlapping bboxes (3x step) so that center pixels
  // tile the full extent with no gaps.
  const gridSize = 8; // 8x8 grid = 64 requests
  const featureCount = 200;

  const xMin = extent[0], yMin = extent[1], xMax = extent[2], yMax = extent[3];
  const xStep = (xMax - xMin) / gridSize;
  const yStep = (yMax - yMin) / gridSize;

  const allFeatures = new Map(); // keyed by objid to deduplicate

  const requests = [];
  for (let xi = 0; xi < gridSize; xi++) {
    for (let yi = 0; yi < gridSize; yi++) {
      // Center of this grid cell
      const centerX = xMin + (xi + 0.5) * xStep;
      const centerY = yMin + (yi + 0.5) * yStep;
      // Bbox = 3x step so center pixel (1/3 of bbox) = exactly 1 step
      const cellXMin = centerX - xStep * 1.5;
      const cellYMin = centerY - yStep * 1.5;
      const cellXMax = centerX + xStep * 1.5;
      const cellYMax = centerY + yStep * 1.5;
      const bbox = `${cellXMin},${cellYMin},${cellXMax},${cellYMax}`;

      const url = `${WMS_URL}?` + new URLSearchParams({
        QUERY_LAYERS: queryLayers,
        INFO_FORMAT: 'application/vnd.ogc.gml',
        REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        FORMAT: 'image/png',
        STYLES: '',
        TRANSPARENT: 'true',
        LAYERS: queryLayers,
        language: 'Norwegian',
        FEATURE_COUNT: String(featureCount),
        I: '1',
        J: '1',
        WIDTH: '3',
        HEIGHT: '3',
        CRS: 'EPSG:3857',
        BBOX: bbox,
      }).toString();

      requests.push(url);
    }
  }

  // Execute requests in parallel batches of 8
  const batchSize = 8;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const responses = await Promise.allSettled(batch.map(url => fetch(url).then(r => r.text())));

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const features = parseGMLFeatureInfo(result.value);
      for (const feat of features) {
        const objid = feat.props.get('objid') || feat.props.get('lokalid') || feat.featureId;
        if (objid && !allFeatures.has(objid)) {
          allFeatures.set(objid, feat);
        }
      }
    }
  }

  return [...allFeatures.values()];
}

/**
 * Renders the highscore tables from the collected features.
 */
function renderHighscore(features) {
  const accessible = filterFullyAccessible(features);

  if (accessible.length === 0) {
    elHighscoreContent.innerHTML = `
      <p class="highscore-intro">Veier tilgjengelige for alle i hele Norge (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>
      <p class="highscore-empty">Ingen universelt tilgjengelige veier funnet. Data kan være utdatert — prøv å oppdatere grafen.</p>
    `;
    return;
  }

  // Compute stats
  const totalSegmentLength = accessible.reduce((sum, f) => {
    const len = parseFloat(f.props.get('segmentlengde') || '0');
    return sum + (isNaN(len) ? 0 : len);
  }, 0);

  const avgStigning = accessible.reduce((sum, f) => {
    const s = parseFloat(f.props.get('stigning') || '0');
    return sum + (isNaN(s) ? 0 : s);
  }, 0) / accessible.length;

  // Sort by segment length (longest first)
  const byLength = [...accessible]
    .map(f => ({ ...f, segmentlengde: parseFloat(f.props.get('segmentlengde') || '0') }))
    .filter(f => !isNaN(f.segmentlengde) && f.segmentlengde > 0)
    .sort((a, b) => b.segmentlengde - a.segmentlengde)
    .slice(0, 10);

  // Sort by steepest (highest stigning first)
  const bySteepness = [...accessible]
    .map(f => ({ ...f, stigning: parseFloat(f.props.get('stigning') || '0') }))
    .filter(f => !isNaN(f.stigning) && f.stigning > 0)
    .sort((a, b) => b.stigning - a.stigning)
    .slice(0, 10);

  // Sort by widest (bredde)
  const byWidth = [...accessible]
    .map(f => ({ ...f, bredde: parseFloat(f.props.get('bredde') || '0') }))
    .filter(f => !isNaN(f.bredde) && f.bredde > 0)
    .sort((a, b) => b.bredde - a.bredde)
    .slice(0, 10);

  // Sort by flattest (lowest stigning)
  const byFlattest = [...accessible]
    .map(f => ({ ...f, stigning: parseFloat(f.props.get('stigning') || '0') }))
    .filter(f => !isNaN(f.stigning) && f.stigning >= 0)
    .sort((a, b) => a.stigning - b.stigning)
    .slice(0, 10);

  let html = `
    <p class="highscore-intro">Veier tilgjengelige for alle i hele Norge (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>

    <div class="highscore-stats">
      <div class="highscore-stat-card">
        <div class="stat-value">${accessible.length}</div>
        <div class="stat-label">Segmenter funnet</div>
      </div>
      <div class="highscore-stat-card">
        <div class="stat-value">${(totalSegmentLength / 1000).toFixed(2)} km</div>
        <div class="stat-label">Total lengde</div>
      </div>
      <div class="highscore-stat-card">
        <div class="stat-value">${avgStigning.toFixed(1)}%</div>
        <div class="stat-label">Snitt stigning</div>
      </div>
    </div>
  `;

  // Longest roads
  if (byLength.length > 0) {
    html += `<div class="highscore-section"><h3>🏅 Lengste tilgjengelige veier</h3>`;
    html += `<table class="highscore-table"><thead><tr><th>#</th><th>Veitype</th><th>Lengde</th><th>Stigning</th><th>Kommune</th><th></th></tr></thead><tbody>`;
    byLength.forEach((f, i) => {
      html += `<tr>
        <td class="highscore-rank">${i + 1}</td>
        <td>${esc(f.props.get('veitype') || '—')}</td>
        <td>${f.segmentlengde.toFixed(1)} m</td>
        <td>${f.props.get('stigning') || '—'}%</td>
        <td>${esc(f.props.get('kommune') || '—')}</td>
        <td><button class="highscore-zoom-btn" data-x="${f.centerX}" data-y="${f.centerY}" aria-label="Zoom til vei">Zoom til veien</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Steepest accessible roads
  if (bySteepness.length > 0) {
    html += `<div class="highscore-section"><h3>⛰️ Bratteste tilgjengelige veier</h3>`;
    html += `<table class="highscore-table"><thead><tr><th>#</th><th>Veitype</th><th>Stigning</th><th>Lengde</th><th>Kommune</th><th></th></tr></thead><tbody>`;
    bySteepness.forEach((f, i) => {
      html += `<tr>
        <td class="highscore-rank">${i + 1}</td>
        <td>${esc(f.props.get('veitype') || '—')}</td>
        <td>${f.stigning.toFixed(1)}%</td>
        <td>${f.props.get('segmentlengde') || '—'} m</td>
        <td>${esc(f.props.get('kommune') || '—')}</td>
        <td><button class="highscore-zoom-btn" data-x="${f.centerX}" data-y="${f.centerY}" aria-label="Zoom til vei">Zoom til veien</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Widest accessible roads
  if (byWidth.length > 0) {
    html += `<div class="highscore-section"><h3>↔️ Bredeste tilgjengelige veier</h3>`;
    html += `<table class="highscore-table"><thead><tr><th>#</th><th>Veitype</th><th>Bredde</th><th>Lengde</th><th>Kommune</th><th></th></tr></thead><tbody>`;
    byWidth.forEach((f, i) => {
      html += `<tr>
        <td class="highscore-rank">${i + 1}</td>
        <td>${esc(f.props.get('veitype') || '—')}</td>
        <td>${f.bredde.toFixed(0)} cm</td>
        <td>${f.props.get('segmentlengde') || '—'} m</td>
        <td>${esc(f.props.get('kommune') || '—')}</td>
        <td><button class="highscore-zoom-btn" data-x="${f.centerX}" data-y="${f.centerY}" aria-label="Zoom til vei">Zoom til veien</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Flattest accessible roads
  if (byFlattest.length > 0) {
    html += `<div class="highscore-section"><h3>🛤️ Flateste tilgjengelige veier</h3>`;
    html += `<table class="highscore-table"><thead><tr><th>#</th><th>Veitype</th><th>Stigning</th><th>Lengde</th><th>Kommune</th><th></th></tr></thead><tbody>`;
    byFlattest.forEach((f, i) => {
      html += `<tr>
        <td class="highscore-rank">${i + 1}</td>
        <td>${esc(f.props.get('veitype') || '—')}</td>
        <td>${f.stigning.toFixed(1)}%</td>
        <td>${f.props.get('segmentlengde') || '—'} m</td>
        <td>${esc(f.props.get('kommune') || '—')}</td>
        <td><button class="highscore-zoom-btn" data-x="${f.centerX}" data-y="${f.centerY}" aria-label="Zoom til vei">Zoom til veien</button></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  elHighscoreContent.innerHTML = html;
}

// ── Highscore zoom-to-road handler (delegated) ───────────────────────────────

elHighscoreContent.addEventListener('click', (e) => {
  const btn = e.target.closest('.highscore-zoom-btn');
  if (!btn) return;
  const x = parseFloat(btn.dataset.x);
  const y = parseFloat(btn.dataset.y);
  if (isNaN(x) || isNaN(y)) return;
  closeHighscore();
  map.getView().animate({ center: [x, y], zoom: 16, duration: 500 });
});

// ── Highscore button handler ──────────────────────────────────────────────────

elBtnHighscore.addEventListener('click', async () => {
  openHighscore();
  // If we already have rendered HTML cached, re-open is instant
  if (highscoreRenderedHTML) {
    elHighscoreContent.innerHTML = highscoreRenderedHTML;
    return;
  }
  elHighscoreContent.innerHTML = `
    <p class="highscore-intro">Laster oversikt over veier som er tilgjengelige for alle (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>
    <div class="highscore-loading"><div class="spinner"></div> Henter data for hele Norge…</div>
  `;

  try {
    // Try pre-generated data first (same as Expo), fall back to viewport scan
    let features = await loadHighscoreFromFile();
    if (!features) {
      features = await scanForHighscoreData();
    }
    renderHighscore(features);
    // Cache the rendered HTML for instant re-open
    highscoreRenderedHTML = elHighscoreContent.innerHTML;
  } catch (err) {
    console.error('Highscore scan error:', err);
    elHighscoreContent.innerHTML = `
      <p class="highscore-intro">Laster veier som er tilgjengelige for alle.</p>
      <p style="color:var(--red-warn);font-size:.82rem;">Feil ved lasting: ${esc(err.message)}</p>
    `;
  }
});

// ── Feature list button handler ──────────────────────────────────────────────

let featureListAllFeatures = [];

async function openFeatureList() {
  elFeatureListModal.hidden = false;
  elFeatureListContent.innerHTML = `<div class="loading-state"><div class="spinner"></div> Skanner kartvisningen…</div>`;

  try {
    const extent = map.getView().calculateExtent(map.getSize());
    const features = await scanViewportFeatures(extent);
    featureListAllFeatures = features;
    renderFeatureList(features);
  } catch (err) {
    console.error('Feature list scan error:', err);
    elFeatureListContent.innerHTML = `<p style="font-size:.82rem;color:var(--red-warn)">Feil: ${esc(err.message)}</p>`;
  }
}

function closeFeatureList() {
  elFeatureListModal.hidden = true;
  featureListAllFeatures = [];
}

elBtnFeatureList.addEventListener('click', openFeatureList);
elFeatureListCloser.addEventListener('click', closeFeatureList);

async function scanViewportFeatures(extent) {
  const queryLayers = 'tilgjengelighet3';
  const gridSize = 8;
  const featureCount = 200;
  const allFeatures = new Map();

  const [xMin, yMin, xMax, yMax] = extent;
  const xStep = (xMax - xMin) / gridSize;
  const yStep = (yMax - yMin) / gridSize;

  const requests = [];
  for (let xi = 0; xi < gridSize; xi++) {
    for (let yi = 0; yi < gridSize; yi++) {
      const centerX = xMin + (xi + 0.5) * xStep;
      const centerY = yMin + (yi + 0.5) * yStep;
      const cellXMin = centerX - xStep * 1.5;
      const cellYMin = centerY - yStep * 1.5;
      const cellXMax = centerX + xStep * 1.5;
      const cellYMax = centerY + yStep * 1.5;
      const bbox = `${cellXMin},${cellYMin},${cellXMax},${cellYMax}`;

      const url = `${WMS_URL}?` + new URLSearchParams({
        QUERY_LAYERS: queryLayers, REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS', VERSION: '1.3.0', INFO_FORMAT: 'application/vnd.ogc.gml',
        FORMAT: 'image/png', STYLES: '', TRANSPARENT: 'true',
        LAYERS: queryLayers, language: 'Norwegian',
        FEATURE_COUNT: String(featureCount),
        I: '1', J: '1', WIDTH: '3', HEIGHT: '3',
        CRS: 'EPSG:3857', BBOX: bbox,
      }).toString();
      requests.push(url);
    }
  }

  const batchSize = 8;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const responses = await Promise.allSettled(batch.map(url => fetch(url).then(r => r.text())));
    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const features = parseGMLFeatureInfo(result.value);
      for (const feat of features) {
        const key = feat.props.get('objid') || feat.props.get('lokalid') || feat.featureId;
        if (key && !allFeatures.has(key)) {
          allFeatures.set(key, feat);
        }
      }
    }
  }

  return [...allFeatures.values()].sort((a, b) => {
    const la = (a.props.get('objekttype') || a.layerName || '');
    const lb = (b.props.get('objekttype') || b.layerName || '');
    return la.localeCompare(lb, 'no');
  });
}

function renderFeatureList(features) {
  if (features.length === 0) {
    elFeatureListContent.innerHTML = `<p style="font-size:.82rem;color:var(--muted-text);text-align:center;padding:2rem">Ingen objekter funnet i kartvisningen.</p>`;
    return;
  }

  // Group by object type
  const groups = new Map();
  for (const f of features) {
    const type = f.props.get('objekttype') || f.layerName || 'Ukjent';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(f);
  }

  let html = `<p style="font-size:.75rem;color:var(--muted-text);margin-bottom:.75rem">${features.length} objekter funnet i kartvisningen.</p>`;

  for (const [type, feats] of groups) {
    html += `<div class="fl-group"><div class="fl-group-header" onclick="this.parentElement.classList.toggle('open')">`;
    html += `<span class="fl-arrow">▶</span>`;
    html += `<span class="fl-type">${esc(type)}</span>`;
    html += `<span class="fl-count">${feats.length}</span>`;
    html += `</div><div class="fl-items">`;

    for (const feat of feats) {
      const featId = feat.featureId || '';
      const name = feat.props.get('gatetype') || feat.props.get('veitype') ||
                   feat.props.get('navn') || featId;
      html += `<button class="fl-item-btn" data-feat="${encodeURIComponent(JSON.stringify({
        layerName: feat.layerName,
        featureId: feat.featureId,
        props: Object.fromEntries(feat.props),
      }))}">`;
      html += esc(name);
      html += `</button>`;
    }
    html += `</div></div>`;
  }

  elFeatureListContent.innerHTML = html;
}

// Feature list row tap opens popup with full details
elFeatureListContent.addEventListener('click', (e) => {
  const btn = e.target.closest('.fl-item-btn');
  if (!btn) return;
  try {
    const data = JSON.parse(decodeURIComponent(btn.dataset.feat));
    const props = data.props || {};

    let html = `<p class="popup-layer-label">${esc(data.layerName || 'TettstedVei')}`;
    if (data.featureId) html += ` · #${esc(data.featureId)}`;
    html += `</p>`;

    html += `<table><thead><tr><th scope="col">Egenskap</th><th scope="col">Verdi</th></tr></thead><tbody>`;
    for (const [k, v] of Object.entries(props)) {
      if (!v || /^bildefil[123]$/i.test(k)) continue;
      html += `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`;
    }
    html += `</tbody></table>`;

    // Images
    const images = [];
    for (let i = 1; i <= 3; i++) {
      const img = props[`bildefil${i}`];
      if (img) images.push(img);
    }
    if (images.length > 0) {
      html += `<div class="popup-images" role="list" aria-label="Bilder av stedet">`;
      for (const filename of images) {
        const src = `https://data.kartverket.no/tilgjengelighet/tilgjengelighet/${encodeURIComponent(filename)}`;
        html += `<img src="${src}" alt="Bilde: ${esc(filename)}" loading="lazy" role="listitem" />`;
      }
      html += `</div>`;
    }

    elPopupTitle.textContent = data.layerName || 'Stedsinfo';
    elPopupContent.innerHTML = html;
    elPopup.hidden = false;
    closeFeatureList();
  } catch (err) {
    console.error('Feature detail error:', err);
  }
});

// ── Search button handler (opens settings with search focused) ─────────────

elBtnSearch.addEventListener('click', () => {
  openSettings();
  setTimeout(() => elPlaceSearch.focus(), 100);
});

// ── Route planner ───────────────────────────────────────────────────────────

let routeFromCoords = null;
let routeToCoords = null;
let routeLayer = null;

const elBtnRouteFromGps = document.getElementById('btn-route-from-gps');

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10000,
      enableHighAccuracy: true,
      maximumAge: 60000,
    });
  });
}

elBtnRouteFromGps.addEventListener('click', async () => {
  if (!navigator.geolocation) {
    showToast('Geolokasjon støttes ikke i denne nettleseren.');
    return;
  }
  elBtnRouteFromGps.disabled = true;
  try {
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    routeFromCoords = [lat, lon];
    elRouteFrom.value = `Min posisjon (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    elRouteFromResults.innerHTML = '';
    placeGPSDot(pos);
    map.getView().animate({ center: fromLonLat([lon, lat]), zoom: 14, duration: 500 });
    elRouteStatus.textContent = 'Startpunkt satt til din posisjon.';
  } catch (err) {
    console.error(err);
    const code = err && err.code;
    elRouteStatus.textContent = gpsErrorMessage(code);
  } finally {
    elBtnRouteFromGps.disabled = false;
  }
});

function openRouteModal() {
  elRouteModal.hidden = false;
  elRouteFrom.value = '';
  elRouteTo.value = '';
  elRouteStatus.textContent = '';
  routeFromCoords = null;
  routeToCoords = null;
}

function closeRouteModal() {
  elRouteModal.hidden = true;
}

elBtnRoute.addEventListener('click', openRouteModal);
elRouteCloser.addEventListener('click', closeRouteModal);

// Place search delegates for route form inputs
async function searchForRouteSide(query, searchResultsEl, coordSetter) {
  if (query.length < 2) { searchResultsEl.innerHTML = ''; return; }
  try {
    const results = await searchNominatim(query);
    let html = '';
    for (const r of results.slice(0, 5)) {
      html += `<li><button class="search-result-btn" data-lon="${r.lon}" data-lat="${r.lat}" data-name="${esc(r.display_name)}">${esc(r.display_name)}</button></li>`;
    }
    searchResultsEl.innerHTML = html || '<li style="font-size:.75rem;color:var(--muted-text);padding:.5rem">Ingen treff</li>';
  } catch { searchResultsEl.innerHTML = ''; }
}

// Simple Nominatim search for route endpoints
async function searchNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=no`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'TiligjengelighetApp/1.0' } });
  if (!resp.ok) throw new Error('Search failed');
  return await resp.json();
}

let routeFromTimer, routeToTimer;
elRouteFrom.addEventListener('input', () => {
  clearTimeout(routeFromTimer);
  routeFromTimer = setTimeout(() => searchForRouteSide(elRouteFrom.value, elRouteFromResults), 300);
});

elRouteTo.addEventListener('input', () => {
  clearTimeout(routeToTimer);
  routeToTimer = setTimeout(() => searchForRouteSide(elRouteTo.value, elRouteToResults), 300);
});

// Handle result clicks for route from/to
elRouteFromResults.addEventListener('click', (e) => {
  const btn = e.target.closest('.search-result-btn');
  if (!btn) return;
  elRouteFrom.value = btn.dataset.name;
  routeFromCoords = [parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon)];
  elRouteFromResults.innerHTML = '';
});

elRouteToResults.addEventListener('click', (e) => {
  const btn = e.target.closest('.search-result-btn');
  if (!btn) return;
  elRouteTo.value = btn.dataset.name;
  routeToCoords = [parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon)];
  elRouteToResults.innerHTML = '';
});

// Compute route (Valhalla)
elBtnComputeRoute.addEventListener('click', async () => {
  if (!routeFromCoords || !routeToCoords) {
    elRouteStatus.textContent = 'Vennligst velg både start- og målpunkt.';
    return;
  }
  elRouteStatus.textContent = 'Beregner rute…';
  try {
    const [fromLat, fromLon] = routeFromCoords;
    const [toLat, toLon] = routeToCoords;
    const body = JSON.stringify({
      locations: [
        { lat: fromLat, lon: fromLon },
        { lat: toLat, lon: toLon },
      ],
      costing: 'pedestrian',
      directions_options: { units: 'kilometers' },
    });
    const resp = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(body)}`);
    const data = await resp.json();
    if (data.trip) {
      const leg = data.trip.legs[0];
      const coords = decodePolyline(leg.shape);
      // Valhalla summary.length is already in km (units: 'kilometers')
      const km = leg.summary.length.toFixed(1);
      drawRouteOnMap(coords);
      elRouteStatus.textContent = `Rute funnet: ${km} km.`;
      // Fit map to route
      const ext = coordsToExtent(coords);
      if (ext) map.getView().fit(ext, { maxZoom: 14, duration: 500 });
    } else {
      elRouteStatus.textContent = 'Kunne ikke beregne rute. Prøv andre punkt.';
    }
  } catch (err) {
    elRouteStatus.textContent = `Feil: ${esc(err.message || 'Ukjent feil')}`;
  }
});

/**
 * Decode an encoded polyline (Google's polyline algorithm, as used by Valhalla).
 */
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  const len = encoded.length;
  while (index < len) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lng * 1e-6, lat * 1e-6]);
  }
  return coordinates;
}

function drawRouteOnMap(coords) {
  // Remove previous route
  if (routeLayer) map.removeLayer(routeLayer);
  // Coords from Valhalla are [lon, lat] in EPSG:4326 — transform to map
  // projection (EPSG:3857) or the line lands at the wrong location.
  const projected = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
  routeLayer = new VectorLayer({
    source: new VectorSource({
      features: [new Feature({
        geometry: new LineString(projected),
      })],
    }),
    style: new Style({
      stroke: new Stroke({ color: '#e8a020', width: 3 }),
    }),
    zIndex: 20,
  });
  map.addLayer(routeLayer);
}

function coordsToExtent(coords) {
  if (!coords || coords.length === 0) return null;
  // Fit expects the extent in the view projection (EPSG:3857)
  const projected = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
  const lons = projected.map(c => c[0]);
  const lats = projected.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// ── Nearest toilet ──────────────────────────────────────────────────────────

// ── Accessibility data cache (per search) ────────────────────────────────────
let accessibilityGrid = []; // { x, y, w, h } — EPSG:3857 bounding boxes of accessible segments

// Check if a coordinate is near any fully-accessible road segment
function isAccessiblePoint(x, y, w, h) {
  for (const seg of accessibilityGrid) {
    const dx = Math.abs(x - seg.x);
    const dy = Math.abs(y - seg.y);
    // Use the segment's bounding area (approx 100m buffer in screen space)
    if (dx < seg.w && dy < seg.h) return true;
  }
  return false;
}

// Find the bounding box of a polyline in EPSG:3857 and check accessibility ratio
function routeAccessibilityRatio(coords, w, h) {
  if (!coords || coords.length < 2) return null;
  // Transform route coords to view projection (EPSG:3857)
  const projected = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
  const xs = projected.map(p => p[0]);
  const ys = projected.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Sample along the route at regular intervals
  const sampleCount = 50;
  const totalLength = projected.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const dx = p[0] - projected[i - 1][0];
    const dy = p[1] - projected[i - 1][1];
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  let accessibleLength = 0;
  let cumulativeDist = 0;

  for (let i = 0; i < projected.length - 1; i++) {
    const p1 = projected[i], p2 = projected[i + 1];
    const segLen = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
    const steps = Math.max(1, Math.round(segLen / 100)); // 100px steps
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = p1[0] + (p2[0] - p1[0]) * t;
      const cy = p1[1] + (p2[1] - p1[1]) * t;
      if (isAccessiblePoint(cx, cy, 50, 50)) {
        accessibleLength += segLen / steps;
      }
    }
    cumulativeDist += segLen;
  }

  return cumulativeDist > 0 ? Math.round((accessibleLength / cumulativeDist) * 100) : 0;
}

// Fetch accessibility data for the viewport using WMS GetFeatureInfo
async function fetchAccessibilityData() {
  const view = map.getView();
  const extent = view.calculateExtent(view.getZoom() < 12 ? view.getSize() : [800, 600]);

  // Grid: sample the viewport for road accessibility
  const cols = 20, rows = 15;
  const xStep = (extent[2] - extent[0]) / cols;
  const yStep = (extent[3] - extent[1]) / rows;
  const features = [];

  const batchSize = 10;
  for (let i = 0; i < cols; i += batchSize) {
    const batch = [];
    for (let xi = i; xi < Math.min(i + batchSize, cols); xi++) {
      for (let yj = 0; yj < rows; yj++) {
        const cx = extent[0] + (xi + 0.5) * xStep;
        const cy = extent[1] + (yj + 0.5) * yStep;
        const bbox = `${cx - xStep / 2},${cy - yStep / 2},${cx + xStep / 2},${cy + yStep / 2}`;
        const url = `${WMS_URL}?${new URLSearchParams({
          QUERY_LAYERS: 'tilgjengelighet3',
          INFO_FORMAT: 'application/vnd.ogc.gml',
          REQUEST: 'GetFeatureInfo',
          SERVICE: 'WMS', VERSION: '1.3.0',
          FORMAT: 'image/png', STYLES: '', TRANSPARENT: 'true',
          LAYERS: 'tilgjengelighet3', language: 'Norwegian',
          FEATURE_COUNT: '50',
          I: '1', J: '1', WIDTH: '3', HEIGHT: '3',
          CRS: 'EPSG:3857', BBOX: bbox,
        }).toString()}`;
        batch.push(fetch(url).then(r => r.text()));
      }
    }
    const results = await Promise.allSettled(batch);
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const feats = parseGMLFeatureInfo(result.value);
      const accessible = filterFullyAccessible(feats);
      for (const feat of accessible) {
        features.push({
          x: feat.centerX,
          y: feat.centerY,
          w: xStep / 2,
          h: yStep / 2,
        });
      }
    }
  }

  return features;
}

// Get all toilets within radius, sorted by distance
async function findAllToiletsWeb(lat, lon, radiusMeters = 5000) {
  const query = [
    '[out:json][timeout:10];',
    '(', `  node["amenity"="toilets"](around:${radiusMeters},${lat},${lon});`, ')',
    ';', 'out body;',
  ].join('\n');

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000);
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TilgjengelighetApp/1.0' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const elements = data.elements ?? [];

    const toilets = elements.map(el => {
      const tLat = el.lat || el.center?.lat || 0;
      const tLon = el.lon || el.center?.lon || 0;
      const dist = haversineKm(lat, lon, tLat, tLon);
      const tags = el.tags ?? {};
      const name = tags.name ?? tags.operator ?? tags.toilets ?? 'Toalett';
      return { lat: tLat, lon: tLon, name: String(name), dist };
    }).filter(t => !isNaN(t.lat) && t.lat !== 0 && t.lon !== 0);

    toilets.sort((a, b) => a.dist - b.dist);
    return toilets;
  } catch { return []; }
}

// Render the toilet results list
function renderToiletResults(toilets) {
  const elToiletResults = document.getElementById('toilet-results');
  if (!toilets || toilets.length === 0) {
    elToiletResults.innerHTML = '<li style="color:var(--mist);font-size:.82rem;padding:.5rem">Fant ingen toalett innen 5 km.</li>';
    elToiletResults.hidden = false;
    return;
  }

  // Render cards with accessibility ratio already computed
  let html = '';
  for (const { toilet } of toilets) {
    const pct = toilet.ratio;
    const pctClass = pct === null ? '' : pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';
    html += `
      <li class="toilet-item" data-lat="${toilet.lat}" data-lon="${toilet.lon}">
        <div class="toilet-item-header">
          <span class="toilet-item-name">${esc(toilet.name)}</span>
          <span class="toilet-item-meta">${toilet.distanceKm} km · ${toilet.km || '—'} km</span>
        </div>
        ${pct === null
          ? `<div class="toilet-bar-track"><div class="toilet-bar-fill" style="width:0%"></div></div>
             <span class="toilet-item-meta">Beregner tilgjengelighet…</span>`
          : `<div class="toilet-bar-track"><div class="toilet-bar-fill ${pctClass}" style="width:${pct}%"></div></div>
             <span class="toilet-item-pct">${pct}% av ruten tilgjengelig</span>`
        }
      </li>`;
  }
  elToiletResults.innerHTML = html;
  elToiletResults.hidden = false;
}

// Fetch route for each toilet and compute accessibility
async function computeToiletRoutesAndAccessibility(toilets) {
  const results = [];
  for (const toilet of toilets) {
    const body = JSON.stringify({
      locations: [
        { lat: toiletFromCoords[0], lon: toiletFromCoords[1] },
        { lat: toilet.lat, lon: toilet.lon },
      ],
      costing: 'pedestrian',
      directions_options: { units: 'kilometers' },
    });
    try {
      const resp = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(body)}`);
      const data = await resp.json();
      if (data.trip && data.trip.legs && data.trip.legs[0]) {
        const coords = decodePolyline(data.trip.legs[0].shape);
        const routeProjected = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
        const ratio = routeAccessibilityRatio(routeProjected, 50, 50);
        results.push({ toilet, coords, ratio, km: data.trip.legs[0].summary.length.toFixed(1) });
      } else {
        results.push({ toilet, coords: null, ratio: null, km: null });
      }
    } catch {
      results.push({ toilet, coords: null, ratio: null, km: null });
    }
  }
  return results;
}

function openToiletModal() {
  elToiletModal.hidden = false;
  elToiletFrom.value = '';
  document.getElementById('toilet-end-text').textContent = 'Nærmeste toalett';
  document.getElementById('toilet-status').textContent = '';
  document.getElementById('toilet-results').hidden = true;
  document.getElementById('toilet-results').innerHTML = '';
  toiletFromCoords = null;
  elBtnToiletFromGps.disabled = false;
  elBtnToiletFind.disabled = false;
}

function closeToiletModal() {
  elToiletModal.hidden = true;
}

elBtnToilet.addEventListener('click', openToiletModal);
elToiletCloser.addEventListener('click', closeToiletModal);

// "Min posisjon" button inside toilet modal
elBtnToiletFromGps.addEventListener('click', async () => {
  if (!navigator.geolocation) {
    elToiletStatus.textContent = 'Geolokasjon støttes ikke.';
    return;
  }
  elBtnToiletFromGps.disabled = true;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    toiletFromCoords = [lat, lon];
    elToiletFrom.value = `Min posisjon (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    placeGPSDot(pos);
    map.getView().animate({ center: fromLonLat([lon, lat]), zoom: 14, duration: 500 });
    elToiletStatus.textContent = 'Startpunkt satt til din posisjon.';
  } catch (err) {
    elToiletStatus.textContent = gpsErrorMessage(err && err.code);
  } finally {
    elBtnToiletFromGps.disabled = false;
  }
});

// "Finn nærmeste toalett" button — computes routes + accessibility
elBtnToiletFind.addEventListener('click', async () => {
  if (!toiletFromCoords) {
    elToiletStatus.textContent = 'Vennligst angi startpunkt først (📍 Min posisjon).';
    return;
  }
  elBtnToiletFind.disabled = true;
  elToiletStatus.textContent = 'Søker etter toaletter…';

  try {
    // Fetch accessibility data for current viewport (shared across all routes)
    elToiletStatus.textContent = 'Henter tilgjengelighetsdata…';
    accessibilityGrid = await fetchAccessibilityData();
    if (accessibilityGrid.length === 0) {
      elToiletStatus.textContent = 'Kunne ikke hente tilgjengelighetsdata. Vær sikker på at kartlaget er aktivert.';
      return;
    }

    const [lat, lon] = toiletFromCoords;
    const toilets = await findAllToiletsWeb(lat, lon, 5000);
    if (toilets.length === 0) {
      elToiletStatus.textContent = 'Fant ingen toalett i nærheten (innen 5 km).';
      document.getElementById('toilet-results').innerHTML =
        '<li style="color:var(--mist);font-size:.82rem;padding:.5rem">Fant ingen toalett innen 5 km.</li>';
      document.getElementById('toilet-results').hidden = false;
      return;
    }

    // Filter: show nearest 2 if within 500m, otherwise show at least 2 nearest
    const nearToilets = toilets.filter(t => t.dist <= 0.5);
    const count = nearToilets.length >= 2 ? 2 : Math.min(2, toilets.length);
    const selected = toilets.slice(0, count);

    elToiletStatus.textContent = `Fant ${toilets.length} toalett. Beregner ruter…`;
    document.getElementById('toilet-end-text').textContent = `Nærmeste toalett (${count} valgt)`;

    const routeResults = await computeToiletRoutesAndAccessibility(selected);

    // Draw routes + render results
    let primaryRouteCoords = null;
    for (const { toilet, coords, ratio, km } of routeResults) {
      if (coords) {
        if (!primaryRouteCoords) primaryRouteCoords = coords;
        drawRouteOnMap(coords);
        toilet.ratio = ratio;
        toilet.km = km;
      }
    }

    if (primaryRouteCoords) {
      const ext = coordsToExtent(primaryRouteCoords);
      if (ext) map.getView().fit(ext, { padding: [50, 50, 50, 50], maxZoom: 15, duration: 500 });
    }

    renderToiletResults(selected);
    elToiletStatus.textContent = `Ferdig. ${selected.length} toalett vist med tilgjengelighetsoversikt.`;
  } catch (err) {
    elToiletStatus.textContent = `Feil: ${esc(err.message || 'Ukjent')}`;
  } finally {
    elBtnToiletFind.disabled = false;
  }
});

// Haversine distance
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function findNearestToiletWeb(lat, lon, radiusMeters = 3000) {
  const query = [
    '[out:json][timeout:10];',
    '(', `  node["amenity"="toilets"](around:${radiusMeters},${lat},${lon});`, ')',
    ';', 'out body;',
  ].join('\n');

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TilgjengelighetApp/1.0' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const elements = data.elements ?? [];
    if (elements.length === 0) return null;

    const toilets = elements.map(el => {
      const tLat = el.lat || el.center?.lat || 0;
      const tLon = el.lon || el.center?.lon || 0;
      const dist = haversineKm(lat, lon, tLat, tLon);
      const tags = el.tags ?? {};
      const name = tags.name ?? tags.operator ?? tags.toilets ?? 'Toalett';
      return { lat: tLat, lon: tLon, name: String(name), dist };
    }).filter(t => !isNaN(t.lat) && t.lat !== 0 && t.lon !== 0);

    if (toilets.length === 0) return null;
    toilets.sort((a, b) => a.dist - b.dist);
    const nearest = toilets[0];
    return { lat: nearest.lat, lon: nearest.lon, name: nearest.name, distanceKm: Math.round(nearest.dist * 100) / 100 };
  } catch { return null; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  elStatusZoom.textContent = Math.round(map.getView().getZoom());

  try {
    const xml = await fetchCapabilitiesXML();

    const topGroups = parseCapabilities(xml);
    if (topGroups.length === 0) {
      elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">Ingen kartlag funnet.</p>`;
      return;
    }

    topGroups.sort((a, b) => a.title.localeCompare(b.title, 'no'));
    elLayerLoading.hidden = true;
    buildLayerTree(topGroups);
    updateLayerCount();
  } catch (err) {
    console.error('Init error:', err);
    const msg = err.name === 'AbortError'
      ? 'Tidsavbrudd ved lasting av kartlag. Prøv å laste siden på nytt.'
      : `Kunne ikke laste kartlag: ${esc(err.message)}`;
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">${msg}</p>`;
  }
}

init();
