/**
 * Geonorge Tilgjengelighet WMS Viewer
 * WCAG 2.1 AA compliant – accessible map application
 */

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';

// ── Constants ─────────────────────────────────────────────────────────────────

const WMS_URL          = 'https://wms.geonorge.no/skwms1/wms.tilgjengelighet3';
const CAPABILITIES_URL = `${WMS_URL}?request=GetCapabilities&service=WMS&language=Norwegian`;

const NORWAY_CENTER = fromLonLat([15.5, 65.0]);
const NORWAY_ZOOM   = 5;

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  olLayers:     new Map(),   // layerName → ImageLayer
  activeLayers: new Set(),
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const elLayerLoading = document.getElementById('layer-loading');
const elLayerTree    = document.getElementById('layer-tree');
const elFeatureInfo  = document.getElementById('feature-info');
const elStatusZoom   = document.getElementById('status-zoom');
const elStatusLayers = document.getElementById('status-layers');
const elBtnZoomIn    = document.getElementById('btn-zoom-in');
const elBtnZoomOut   = document.getElementById('btn-zoom-out');
const elBtnReset     = document.getElementById('btn-reset-view');
const elBtnMobile    = document.getElementById('btn-mobile-sidebar');
const elSidebar      = document.querySelector('.sidebar');
const elMapContainer = document.getElementById('map');

// ── Base layers ───────────────────────────────────────────────────────────────

const osmSource = new OSM();

const topoSource = new XYZ({
  url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
  attributions: '© <a href="https://www.kartverket.no/">Kartverket</a>',
  crossOrigin: 'anonymous',
});

const baseLayer = new TileLayer({ source: osmSource, zIndex: 0 });

// ── Composite WMS layer (root group — all icons at once) ──────────────────────
// Equivalent to: LAYERS=tilgjengelighet3 in the curl example.
// OpenLayers sends CRS=EPSG:3857 automatically; the server reprojects from 25833.

const compositeLayer = new ImageLayer({
  source: new ImageWMS({
    url: WMS_URL,
    params: {
      LAYERS:      'tilgjengelighet3',
      FORMAT:      'image/png',
      TRANSPARENT: true,
      VERSION:     '1.3.0',
      language:    'Norwegian',
    },
    ratio:       1,
    serverType:  'mapserver',
    crossOrigin: 'anonymous',
  }),
  zIndex:  5,
  visible: true,
  opacity: 1,
});

// ── Map ───────────────────────────────────────────────────────────────────────

const map = new Map({
  target: 'map',
  layers: [baseLayer, compositeLayer],
  view: new View({
    center:  NORWAY_CENTER,
    zoom:    NORWAY_ZOOM,
    minZoom: 3,
    maxZoom: 18,
  }),
  controls: defaultControls({ zoom: false, rotate: false, attribution: true }),
  keyboardEventTarget: document,
});

// Accessibility: set role on canvas after first render
map.once('rendercomplete', () => {
  const canvas = elMapContainer.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interaktivt kart over tilgjengelighetsdata i Norge');
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
    doGetFeatureInfo(map.getView().getCenter());
  }
});

// ── Custom map controls ───────────────────────────────────────────────────────

elBtnZoomIn.addEventListener('click',  () => map.getView().animate({ zoom: map.getView().getZoom() + 1, duration: 250 }));
elBtnZoomOut.addEventListener('click', () => map.getView().animate({ zoom: map.getView().getZoom() - 1, duration: 250 }));
elBtnReset.addEventListener('click',   () => map.getView().animate({ center: NORWAY_CENTER, zoom: NORWAY_ZOOM, duration: 400 }));

// ── Mobile sidebar ────────────────────────────────────────────────────────────

elBtnMobile.addEventListener('click', () => {
  const isOpen = elSidebar.classList.toggle('mobile-open');
  elBtnMobile.setAttribute('aria-expanded', String(isOpen));
});

// ── Basemap switcher ──────────────────────────────────────────────────────────

document.querySelectorAll('input[name="basemap"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'osm')  { baseLayer.setSource(osmSource);  baseLayer.setVisible(true); }
    if (radio.value === 'topo') { baseLayer.setSource(topoSource); baseLayer.setVisible(true); }
    if (radio.value === 'none') { baseLayer.setVisible(false); }
  });
});

// ── GetCapabilities fetch & parse ─────────────────────────────────────────────
//
// THE FIX: parse as 'text/html', not 'text/xml'.
//
// The WMS response has xmlns="http://www.opengis.net/wms" as the default
// namespace on the root element. When parsed as text/xml, browsers put every
// element in that namespace. Then:
//   - getElementsByTagName('Layer') may return 0 in strict parsers
//   - child.tagName varies: 'Layer' in Chrome, 'wms:Layer' in Firefox
//   - el.children iteration works but tag comparisons are unreliable
//
// Parsing as text/html (the HTML parser) is completely namespace-blind:
//   - All tag names are uppercased: <Layer> → tagName === 'LAYER'
//   - querySelector('layer'), getElementsByTagName('LAYER') work everywhere
//   - No namespace declarations affect anything
// This approach is 100% cross-browser reliable.

async function fetchCapabilities() {
  try {
    const res = await fetch(CAPABILITIES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Parse as HTML — namespace-blind, all tags uppercased
    return new DOMParser().parseFromString(text, 'text/html');
  } catch (err) {
    console.error('GetCapabilities failed:', err);
    return null;
  }
}

// Get text of a DIRECT child element (HTML parser uppercases tag names)
function childText(el, tag) {
  const UP = tag.toUpperCase();
  for (const child of el.children) {
    if (child.tagName === UP) return child.textContent.trim();
  }
  return '';
}

/**
 * Recursively extract layer metadata from a parsed-as-HTML WMS Layer element.
 * All tag names are UPPERCASED by the HTML parser.
 */
function extractLayer(layerEl) {
  const name     = childText(layerEl, 'Name');
  const title    = childText(layerEl, 'Title') || name;
  const abstract = childText(layerEl, 'Abstract');

  // Legend URL: Layer > Style > LegendURL > OnlineResource[xlink:href]
  // The HTML parser lowercases attribute names, so xlink:href becomes just
  // the local attribute. We try multiple fallbacks.
  let legendUrl = '';
  for (const child of layerEl.children) {
    if (child.tagName === 'STYLE') {
      for (const sc of child.children) {
        if (sc.tagName === 'LEGENDURL') {
          for (const lc of sc.children) {
            if (lc.tagName === 'ONLINERESOURCE') {
              legendUrl = lc.getAttribute('xlink:href')
                       || lc.getAttribute('href')
                       || lc.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
                       || '';
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }

  // Collect direct child LAYER elements
  const children = [];
  for (const child of layerEl.children) {
    if (child.tagName === 'LAYER') {
      children.push(extractLayer(child));
    }
  }

  return { name, title, abstract, legendUrl, children };
}

// ── OL sublayer factory ───────────────────────────────────────────────────────
// Each individual sublayer sits above the composite (zIndex 10).

function createSubLayer(layerName) {
  return new ImageLayer({
    source: new ImageWMS({
      url: WMS_URL,
      params: {
        LAYERS:      layerName,
        FORMAT:      'image/png',
        TRANSPARENT: true,
        VERSION:     '1.3.0',
        language:    'Norwegian',
      },
      ratio:       1,
      serverType:  'mapserver',
      crossOrigin: 'anonymous',
    }),
    zIndex:  10,
    visible: false,
    opacity: 0.9,
  });
}

// ── Layer tree UI ─────────────────────────────────────────────────────────────

function buildLayerTree(topGroups) {
  elLayerTree.innerHTML = '';
  for (const group of topGroups) {
    const namedChildren = group.children.filter(c => c.name);
    if (group.name && namedChildren.length === 0) {
      elLayerTree.appendChild(makeLeaf(group));
    } else if (namedChildren.length > 0) {
      elLayerTree.appendChild(makeGroup(group));
    }
  }
  elLayerTree.hidden = false;
}

function makeGroup(group) {
  const wrap = document.createElement('div');
  wrap.className = 'layer-group';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'layer-group-header';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', `Ekspander gruppe: ${group.title}`);

  const arrow = document.createElement('span');
  arrow.className = 'layer-group-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '▶';

  btn.append(arrow, document.createTextNode(' ' + group.title));
  wrap.appendChild(btn);

  const body = document.createElement('div');
  body.className = 'layer-group-children';
  body.hidden = true;

  for (const child of group.children) {
    if (!child.name) continue;
    const hasNamedGrandchildren = child.children.some(c => c.name);
    body.appendChild(hasNamedGrandchildren ? makeGroup(child) : makeLeaf(child));
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

  // Create and register the OL sublayer lazily
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
  if (layer.abstract) cb.title = layer.abstract;

  const span = document.createElement('span');
  span.textContent = layer.title;

  label.append(cb, span);
  item.appendChild(label);

  if (layer.legendUrl) {
    const img = document.createElement('img');
    img.src       = layer.legendUrl;
    img.alt       = `Tegnforklaring for ${layer.title}`;
    img.loading   = 'lazy';
    img.className = 'layer-legend-img';
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

// ── GetFeatureInfo ────────────────────────────────────────────────────────────

map.on('singleclick', (evt) => doGetFeatureInfo(evt.coordinate));

async function doGetFeatureInfo(coordinate) {
  const queryLayers = state.activeLayers.size > 0
    ? [...state.activeLayers].join(',')
    : 'tilgjengelighet3';

  setFeatureInfo(`<div class="feature-info-loading"><div class="spinner"></div> Henter stedsinfo…</div>`);

  const resolution = map.getView().getResolution();
  const url = compositeLayer.getSource().getFeatureInfoUrl(
    coordinate, resolution, 'EPSG:3857',
    { INFO_FORMAT: 'text/plain', QUERY_LAYERS: queryLayers, LAYERS: queryLayers, FEATURE_COUNT: 10 }
  );

  if (!url) {
    setFeatureInfo(`<p class="feature-info-placeholder">Kan ikke hente info ved dette zoomnivået.</p>`);
    return;
  }

  try {
    const res  = await fetch(url);
    const text = await res.text();
    renderFeatureInfo(text, coordinate);
  } catch {
    setFeatureInfo(`<p style="color:var(--red-warn)">Feil ved henting av stedsinfo.</p>`);
  }
}

function setFeatureInfo(html) { elFeatureInfo.innerHTML = html; }

function renderFeatureInfo(text, coord) {
  const [lon, lat] = toLonLat(coord).map(v => v.toFixed(5));
  const lines = text.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('GetFeatureInfo'));
  const empty = lines.length === 0 || lines.every(l => /no features/i.test(l));

  if (empty) {
    setFeatureInfo(`<p class="feature-info-placeholder">Ingen objekter funnet på (${lat}° N, ${lon}° Ø).</p>`);
    return;
  }

  const rows = lines.map(l => {
    const i = l.indexOf('=');
    return i > -1 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: '', v: l };
  });

  let html = `<p class="feature-info-title">Punkt: ${lat}° N, ${lon}° Ø</p>
    <table><caption class="sr-only">Egenskaper for valgt punkt</caption>
    <thead><tr><th scope="col">Egenskap</th><th scope="col">Verdi</th></tr></thead><tbody>`;
  for (const { k, v } of rows) {
    if (k || v) html += `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`;
  }
  html += '</tbody></table>';
  setFeatureInfo(html);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  elStatusZoom.textContent = Math.round(map.getView().getZoom());

  const doc = await fetchCapabilities();

  if (!doc) {
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">
      Kunne ikke laste kartlag fra Geonorge. Sjekk nettverkstilkobling.</p>`;
    return;
  }

  // With text/html parsing, all tags are UPPERCASED and querySelector works
  // with lowercase selectors (it upcases internally for HTML documents).
  const capabilityEl = doc.querySelector('capability');
  if (!capabilityEl) {
    elLayerLoading.textContent = 'Uventet svarformat (mangler Capability-element).';
    return;
  }

  const rootLayerEl = capabilityEl.querySelector('layer');
  if (!rootLayerEl) {
    elLayerLoading.textContent = 'Ingen lag funnet i GetCapabilities-svaret.';
    return;
  }

  // Direct child <LAYER> elements of the root layer = top-level groups
  const topGroups = [];
  for (const child of rootLayerEl.children) {
    if (child.tagName === 'LAYER') {
      topGroups.push(extractLayer(child));
    }
  }

  if (topGroups.length === 0) {
    elLayerLoading.textContent = 'Ingen underlag funnet.';
    return;
  }

  topGroups.sort((a, b) => a.title.localeCompare(b.title, 'no'));

  elLayerLoading.hidden = true;
  buildLayerTree(topGroups);
  updateLayerCount();
}

init();
