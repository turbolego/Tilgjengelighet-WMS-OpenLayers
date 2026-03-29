/**
 * Geonorge Tilgjengelighet WMS Viewer
 * WCAG 2.1 AA compliant
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
import { defaults as defaultControls } from 'ol/control';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

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

// ── Composite WMS layer (root group — renders all icons together) ─────────────

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

const map = new OLMap({
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

// ── Keyboard: Enter on focused map → GetFeatureInfo at center ─────────────────

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

// ── GetCapabilities: regex-based XML parsing ──────────────────────────────────
//
// Every DOMParser approach failed due to browsers' inconsistent handling of
// the WMS default namespace (xmlns="http://www.opengis.net/wms"):
//   - text/xml:  getElementsByTagName / child.tagName break in Firefox/Safari
//   - text/html: deeply nested <Layer> elements get flattened by the HTML parser
//
// Solution: parse the raw XML string with regex. The WMS GetCapabilities format
// is well-defined and regular. We find direct <Layer>...</Layer> children by
// tracking nesting depth manually, then extract Name/Title/LegendURL from
// each block's header (before its first nested child Layer).

async function fetchCapabilitiesXML() {
  const res = await fetch(CAPABILITIES_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Get first occurrence of <Name> or <n> (WMS uses both) in a string */
function tagText(str, tag) {
  // The WMS server sometimes uses abbreviated <n> instead of <Name>.
  // Match whichever is present.
  const alts = tag === 'Name' ? '(?:Name|n)' : tag;
  const m = str.match(new RegExp(`<${alts}[^>]*>([\\s\\S]*?)<\\/${alts}>`));
  return m ? m[1].trim() : '';
}

/** Decode XML entities in a URL string */
function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

/**
 * Extract direct <Layer>…</Layer> children from an XML string,
 * properly handling arbitrary nesting depth.
 * Returns array of { name, title, legendUrl, innerXml }
 */
function extractDirectLayers(xml) {
  const results = [];
  let i = 0;

  while (i < xml.length) {
    const start = xml.indexOf('<Layer', i);
    if (start === -1) break;

    // Walk forward finding the matching </Layer> by tracking depth
    let depth = 1;
    let j = start + 6;
    while (j < xml.length && depth > 0) {
      const nextOpen  = xml.indexOf('<Layer', j);
      const nextClose = xml.indexOf('</Layer>', j);
      if (nextClose === -1) { j = xml.length; break; }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        j = nextOpen + 6;
      } else {
        depth--;
        j = nextClose + 8;
      }
    }

    const block = xml.slice(start, j);

    // Header = everything before the first nested <Layer child
    const firstNested = block.indexOf('<Layer', 6);
    const header = firstNested > -1 ? block.slice(0, firstNested) : block;

    const name  = tagText(header, 'Name');
    const title = tagText(header, 'Title') || name;

    // Legend URL lives in: Style > LegendURL > OnlineResource xlink:href
    let legendUrl = '';
    const styleBlock = header.match(/<Style>([\s\S]*?)<\/Style>/);
    if (styleBlock) {
      const hrefMatch = styleBlock[1].match(/xlink:href="([^"]+)"/);
      if (hrefMatch) legendUrl = decodeEntities(hrefMatch[1]);
    }

    // innerXml = content between outer <Layer ...> and </Layer>
    const innerStart = block.indexOf('>') + 1;
    const innerEnd   = block.lastIndexOf('</Layer>');
    const innerXml   = innerStart < innerEnd ? block.slice(innerStart, innerEnd) : '';

    if (name) {
      results.push({ name, title, legendUrl, innerXml });
    }

    i = j;
  }

  return results;
}

/** Recursively build a layer tree from raw XML */
function buildLayerData(xml) {
  return extractDirectLayers(xml).map(layer => ({
    name:      layer.name,
    title:     layer.title,
    legendUrl: layer.legendUrl,
    children:  buildLayerData(layer.innerXml),
  }));
}

/** Parse full capabilities XML → array of top-level group layer objects */
function parseCapabilities(xml) {
  // Find Capability element content
  const capMatch = xml.match(/<Capability[\s\S]*?>([\s\S]*)<\/Capability>/);
  if (!capMatch) return [];

  // Find the root Layer (tilgjengelighet3) — first Layer inside Capability
  const rootLayers = extractDirectLayers(capMatch[1]);
  if (!rootLayers.length) return [];

  // Return the root layer's direct children as top-level groups
  return buildLayerData(rootLayers[0].innerXml);
}

// ── OL sublayer factory ───────────────────────────────────────────────────────

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

  // ── "Alle lag" composite entry — on by default, toggleable ───────────────────
  const allItem = document.createElement('div');
  allItem.className = 'layer-item layer-item--composite';

  const allLabel = document.createElement('label');
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = true;
  allCb.setAttribute('aria-label', 'Vis alle lag (sammensatt visning)');

  const allSpan = document.createElement('span');
  allSpan.textContent = 'Alle lag (sammensatt)';
  allSpan.style.fontWeight = '600';

  allLabel.append(allCb, allSpan);
  allItem.appendChild(allLabel);
  elLayerTree.appendChild(allItem);

  allCb.addEventListener('change', () => compositeLayer.setVisible(allCb.checked));

  // ── Divider ───────────────────────────────────────────────────────────────────
  const divider = document.createElement('div');
  divider.className = 'layer-divider';
  divider.setAttribute('aria-hidden', 'true');
  elLayerTree.appendChild(divider);

  // ── Individual sublayers from GetCapabilities ─────────────────────────────────
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

  let xml;
  try {
    xml = await fetchCapabilitiesXML();
  } catch (err) {
    console.error('GetCapabilities error:', err);
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">
      Kunne ikke laste kartlag: ${esc(err.message)}</p>`;
    return;
  }

  const topGroups = parseCapabilities(xml);

  if (topGroups.length === 0) {
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">
      Ingen kartlag funnet i GetCapabilities-svaret.</p>`;
    return;
  }

  topGroups.sort((a, b) => a.title.localeCompare(b.title, 'no'));

  elLayerLoading.hidden = true;
  buildLayerTree(topGroups);
  updateLayerCount();
}

init();

// ── Place Search ─────────────────────────────────────────────────────────────
const elPlaceSearch = document.getElementById('place-search');
const elSearchResults = document.getElementById('search-results');

elPlaceSearch.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (query.length < 3) {
    elSearchResults.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(query)}*&treffPerSide=15&side=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const results = data.navn.map((place) => ({
      name: place.skrivemåte,
      lat: place.representasjonspunkt.nord,
      lon: place.representasjonspunkt.øst,
      kommune: place.kommuner?.[0]?.kommunenavn || 'Ukjent kommune',
    }));

    elSearchResults.innerHTML = results
      .map((result) => `<li data-lat="${result.lat}" data-lon="${result.lon}">${result.name} - ${result.kommune}</li>`)
      .join('');
  } catch (err) {
    console.error('Search error:', err);
    elSearchResults.innerHTML = '<li>Feil ved henting av søkeresultater.</li>';
  }
});

elSearchResults.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;

  const lat = parseFloat(li.getAttribute('data-lat'));
  const lon = parseFloat(li.getAttribute('data-lon'));
  if (!isNaN(lat) && !isNaN(lon)) {
    map.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: 12,
      duration: 400,
    });
  }

  // Close the search results dropdown
  elSearchResults.innerHTML = '';
});

let gpsLayer = null;

const elBtnGPS = document.getElementById('btn-gps');

elBtnGPS.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolokasjon støttes ikke i denne nettleseren.');
    return;
  }

  elBtnGPS.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const coords = fromLonLat([longitude, latitude]);

      // Create/update marker
      if (!gpsLayer) {
        const feature = new Feature({
          geometry: new Point(coords),
        });

        feature.setStyle(new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#e8a020' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }));

        const source = new VectorSource({ features: [feature] });

        gpsLayer = new VectorLayer({
          source,
          zIndex: 20,
        });

        map.addLayer(gpsLayer);
      } else {
        gpsLayer.getSource().getFeatures()[0].setGeometry(new Point(coords));
      }

      // Center map
      map.getView().animate({
        center: coords,
        zoom: 14,
        duration: 500,
      });

      elBtnGPS.disabled = false;
    },
    (err) => {
      console.error(err);
      alert('Kunne ikke hente posisjon.');
      elBtnGPS.disabled = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
    }
  );
});

document.querySelectorAll('.btn-mobile-sidebar').forEach(button => {
  button.addEventListener('click', () => {
    const isOpen = elSidebar.classList.toggle('mobile-open');
    button.setAttribute('aria-expanded', String(isOpen));
  });
});

document.getElementById('btn-zoom-in-mobile')
  ?.addEventListener('click', () =>
    elBtnZoomIn.click()
  );

document.getElementById('btn-zoom-out-mobile')
  ?.addEventListener('click', () =>
    elBtnZoomOut.click()
  );

document.getElementById('btn-reset-view-mobile')
  ?.addEventListener('click', () =>
    elBtnReset.click()
  );

document.getElementById('btn-gps-mobile')
  ?.addEventListener('click', () =>
    elBtnGPS.click()
  );
