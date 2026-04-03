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
  controls: [popupControl, actionBarControl, settingsPanelControl, statusBarControl, attributionControl],
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
  const res = await fetch(CAPABILITIES_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  elStatusZoom.textContent = Math.round(map.getView().getZoom());

  let xml;
  try {
    xml = await fetchCapabilitiesXML();
  } catch (err) {
    console.error('GetCapabilities error:', err);
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">Kunne ikke laste kartlag: ${esc(err.message)}</p>`;
    return;
  }

  const topGroups = parseCapabilities(xml);
  if (topGroups.length === 0) {
    elLayerLoading.innerHTML = `<p style="color:var(--red-warn);font-size:.82rem;">Ingen kartlag funnet.</p>`;
    return;
  }

  topGroups.sort((a, b) => a.title.localeCompare(b.title, 'no'));
  elLayerLoading.hidden = true;
  buildLayerTree(topGroups);
  updateLayerCount();
}

init();
