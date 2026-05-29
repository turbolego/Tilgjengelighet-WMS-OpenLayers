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
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

// ── Constants ─────────────────────────────────────────────────────────────────

const WMS_URL          = 'https://wms.geonorge.no/skwms1/wms.tilgjengelighet3';
const CAPABILITIES_URL = `${WMS_URL}?request=GetCapabilities&service=WMS&language=Norwegian`;

// Base URL for feature photos served by Geonorge
const PHOTO_BASE_URL = 'https://wfs.geonorge.no/skwfs/wfs.tilgjengelighet3?request=GetMap&service=WFS&tilgjengelighet=bilder&bildefil=';

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

function tagText(str, tag) {
  const alts = tag === 'Name' ? '(?:Name|n)' : tag;
  const m = str.match(new RegExp(`<${alts}[^>]*>([\\s\\S]*?)<\\/${alts}>`));
  return m ? m[1].trim() : '';
}

function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function extractDirectLayers(xml) {
  const results = [];
  let i = 0;
  while (i < xml.length) {
    const start = xml.indexOf('<Layer', i);
    if (start === -1) break;
    let depth = 1, j = start + 6;
    while (j < xml.length && depth > 0) {
      const no = xml.indexOf('<Layer', j), nc = xml.indexOf('</Layer>', j);
      if (nc === -1) { j = xml.length; break; }
      if (no !== -1 && no < nc) { depth++; j = no + 6; }
      else { depth--; j = nc + 8; }
    }
    const block = xml.slice(start, j);
    const firstNested = block.indexOf('<Layer', 6);
    const header = firstNested > -1 ? block.slice(0, firstNested) : block;
    const name  = tagText(header, 'Name');
    const title = tagText(header, 'Title') || name;
    let legendUrl = '';
    const styleBlock = header.match(/<Style>([\s\S]*?)<\/Style>/);
    if (styleBlock) {
      const hrefMatch = styleBlock[1].match(/xlink:href="([^"]+)"/);
      if (hrefMatch) legendUrl = decodeEntities(hrefMatch[1]);
    }
    const innerStart = block.indexOf('>') + 1;
    const innerEnd   = block.lastIndexOf('</Layer>');
    const innerXml   = innerStart < innerEnd ? block.slice(innerStart, innerEnd) : '';
    if (name) results.push({ name, title, legendUrl, innerXml });
    i = j;
  }
  return results;
}

function buildLayerData(xml) {
  return extractDirectLayers(xml).map(l => ({
    name: l.name, title: l.title, legendUrl: l.legendUrl,
    children: buildLayerData(l.innerXml),
  }));
}

function parseCapabilities(xml) {
  const capMatch = xml.match(/<Capability[\s\S]*?>([\s\S]*)<\/Capability>/);
  if (!capMatch) return [];
  const rootLayers = extractDirectLayers(capMatch[1]);
  if (!rootLayers.length) return [];
  return buildLayerData(rootLayers[0].innerXml);
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

// ── Parse feature-info text into structured feature blocks ────────────────────

/**
 * Parses the plain-text GetFeatureInfo response into an array of feature
 * objects, each with a layerName, featureId, properties map, and imageFiles.
 *
 * Response format (per Geonorge tilgjengelighet WMS):
 *   Layer 'layerName'
 *   Feature N:
 *   key = value
 *   …
 */
function parseFeatureInfoText(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const features = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('GetFeatureInfo')) continue;

    // "Layer 'foo'"
    const layerMatch = line.match(/^Layer\s+'?([^']+)'?$/i);
    if (layerMatch) {
      current = { layerName: layerMatch[1], featureId: '', props: new Map(), images: [] };
      features.push(current);
      continue;
    }

    // "Feature N:"
    const featureMatch = line.match(/^Feature\s+(\S+):?\s*$/i);
    if (featureMatch) {
      if (current && current.featureId) {
        // New feature within same layer — clone into a new entry
        current = { layerName: current.layerName, featureId: featureMatch[1], props: new Map(), images: [] };
        features.push(current);
      } else if (current) {
        current.featureId = featureMatch[1];
      }
      continue;
    }

    // "key = value"
    const eqIdx = line.indexOf('=');
    if (eqIdx > -1 && current) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim().replace(/^'|'$/g, ''); // strip surrounding quotes
      current.props.set(k, v);

      // Collect bildefil1/2/3
      if (/^bildefil[123]$/i.test(k) && v) {
        current.images.push(v);
      }
    }
  }

  return features;
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
      const src = `https://wfs.geonorge.no/skwfs/tilgjengelighet/bilder/${encodeURIComponent(filename)}`;
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

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
      if (!gpsLayer) {
        const feature = new Feature({ geometry: new Point(coords) });
        feature.setStyle(new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#e8a020' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }));
        gpsLayer = new VectorLayer({ source: new VectorSource({ features: [feature] }), zIndex: 20 });
        map.addLayer(gpsLayer);
      } else {
        gpsLayer.getSource().getFeatures()[0].setGeometry(new Point(coords));
      }
      map.getView().animate({ center: coords, zoom: 14, duration: 500 });
      elBtnGPS.disabled = false;
    },
    (err) => {
      console.error(err);
      let errorMessage = 'Kunne ikke hente posisjon.';
      if (err.code === 1) {
        errorMessage = 'Tilgang til posisjon ble nektet. Vennligst aktiver posisjonstjenester.';
      } else if (err.code === 2) {
        errorMessage = 'Posisjonsoppdatering er utilgjengelig. Prøv igjen senere.';
      } else if (err.code === 3) {
        errorMessage = 'Tidsavbrudd ved henting av posisjon. Prøv igjen eller angi posisjon manuelt.';
      }
      alert(errorMessage);
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
 * Parses GML GetFeatureInfo response into feature objects with real coordinates.
 */
function parseGMLFeatureInfo(gmlText) {
  const features = [];
  // Match each feature block (pattern: <*_feature>...</*_feature>)
  const featureBlocks = gmlText.matchAll(/<(\w+_feature)>([\s\S]*?)<\/\1>/g);

  for (const [, , block] of featureBlocks) {
    const props = new Map();
    const images = [];

    // Extract bounding box coordinates
    const boxMatch = block.match(/<gml:coordinates>([\d.,\s]+)<\/gml:coordinates>/);
    let centerX = 0, centerY = 0;
    if (boxMatch) {
      const coords = boxMatch[1].trim().split(/\s+/);
      if (coords.length === 2) {
        const [x1, y1] = coords[0].split(',').map(Number);
        const [x2, y2] = coords[1].split(',').map(Number);
        centerX = (x1 + x2) / 2;
        centerY = (y1 + y2) / 2;
      }
    }

    // Extract all property elements (simple text content tags)
    const propMatches = block.matchAll(/<(?!gml:)(\w+)>([^<]*)<\/\1>/g);
    for (const [, key, value] of propMatches) {
      const v = value.trim();
      props.set(key, v);
      if (/^bildefil[123]$/i.test(key) && v) images.push(v);
    }

    const objid = props.get('objid') || props.get('lokalid') || '';
    if (objid) {
      features.push({ layerName: '', featureId: objid, props, images, centerX, centerY });
    }
  }

  return features;
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
 * Filters features to only those that are fully accessible on all 4 types.
 */
function filterFullyAccessible(features) {
  return features.filter(f => {
    const r1 = f.props.get('tilgjengvurderingrulleman');
    const r2 = f.props.get('tilgjengvurderingrulleauto');
    const r3 = f.props.get('tilgjengvurderingelrullestol');
    const r4 = f.props.get('tilgjengvurderingsyn');
    return r1 === 'Tilgjengelig' && r2 === 'Tilgjengelig' &&
           r3 === 'Tilgjengelig' && r4 === 'Tilgjengelig';
  });
}

/**
 * Renders the highscore tables from the collected features.
 */
function renderHighscore(features) {
  const accessible = filterFullyAccessible(features);

  if (accessible.length === 0) {
    elHighscoreContent.innerHTML = `
      <p class="highscore-intro">Skanner kartvisningen for veier som er tilgjengelige for alle (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>
      <p class="highscore-empty">Ingen universelt tilgjengelige veier funnet i dette kartområdet. Prøv å zoome inn på et område med turveier.</p>
      <p class="highscore-empty" style="margin-top:.5rem">Tips: Zoom inn på byer/tettsteder for å finne kartlagte turstier.</p>
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
    <p class="highscore-intro">Veier tilgjengelige for alle i gjeldende kartvisning (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>

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
  elHighscoreContent.innerHTML = `
    <p class="highscore-intro">Skanner kartvisningen for veier som er tilgjengelige for alle (manuell rullestol, elektrisk rullestol, el-rullestol og synshemmede).</p>
    <div class="highscore-loading"><div class="spinner"></div> Skanner kartområdet… dette kan ta noen sekunder.</div>
  `;

  try {
    const features = await scanForHighscoreData();
    renderHighscore(features);
  } catch (err) {
    console.error('Highscore scan error:', err);
    elHighscoreContent.innerHTML = `
      <p class="highscore-intro">Skanner kartvisningen for veier som er tilgjengelige for alle.</p>
      <p style="color:var(--red-warn);font-size:.82rem;">Feil ved skanning: ${esc(err.message)}</p>
    `;
  }
});

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
