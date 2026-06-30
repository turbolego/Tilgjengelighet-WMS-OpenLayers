export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tagText(str, tag) {
  const alts = tag === 'Name' ? '(?:Name|n)' : tag;
  const m = str.match(new RegExp(`<${alts}[^>]*>([\\s\\S]*?)<\\/${alts}>`));
  return m ? m[1].trim() : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function extractDirectLayers(xml) {
  const results = [];
  let i = 0;

  while (i < xml.length) {
    const start = xml.indexOf('<Layer', i);
    if (start === -1) break;

    let depth = 1;
    let j = start + 6;

    while (j < xml.length && depth > 0) {
      const no = xml.indexOf('<Layer', j);
      const nc = xml.indexOf('</Layer>', j);

      if (nc === -1) {
        j = xml.length;
        break;
      }

      if (no !== -1 && no < nc) {
        depth++;
        j = no + 6;
      } else {
        depth--;
        j = nc + 8;
      }
    }

    const block = xml.slice(start, j);
    const firstNested = block.indexOf('<Layer', 6);
    const header = firstNested > -1 ? block.slice(0, firstNested) : block;
    const name = tagText(header, 'Name');
    const title = tagText(header, 'Title') || name;

    let legendUrl = '';
    const styleBlock = header.match(/<Style>([\s\S]*?)<\/Style>/);
    if (styleBlock) {
      const hrefMatch = styleBlock[1].match(/xlink:href="([^"]+)"/);
      if (hrefMatch) legendUrl = decodeEntities(hrefMatch[1]);
    }

    const innerStart = block.indexOf('>') + 1;
    const innerEnd = block.lastIndexOf('</Layer>');
    const innerXml = innerStart < innerEnd ? block.slice(innerStart, innerEnd) : '';

    if (name || innerXml.includes('<Layer')) {
      results.push({ name, title, legendUrl, innerXml });
    }
    i = j;
  }

  return results;
}

function buildLayerData(xml) {
  return extractDirectLayers(xml).map((layer) => ({
    name: layer.name,
    title: layer.title,
    legendUrl: layer.legendUrl,
    children: buildLayerData(layer.innerXml),
  }));
}

export function parseCapabilities(xml) {
  const capMatch = xml.match(/<Capability[\s\S]*?>([\s\S]*)<\/Capability>/);
  if (!capMatch) return [];

  const rootLayers = extractDirectLayers(capMatch[1]);
  if (!rootLayers.length) return [];

  return buildLayerData(rootLayers[0].innerXml);
}

export function parseFeatureInfoText(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const features = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('GetFeatureInfo')) continue;

    const layerMatch = line.match(/^Layer\s+'?([^']+)'?$/i);
    if (layerMatch) {
      current = { layerName: layerMatch[1], featureId: '', props: new Map(), images: [] };
      features.push(current);
      continue;
    }

    const featureMatch = line.match(/^Feature\s+([^:\s]+):?\s*$/i);
    if (featureMatch) {
      if (current && current.featureId) {
        current = { layerName: current.layerName, featureId: featureMatch[1], props: new Map(), images: [] };
        features.push(current);
      } else if (current) {
        current.featureId = featureMatch[1];
      }
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx > -1 && current) {
      const key = line.slice(0, eqIdx).trim();
      const value = line
        .slice(eqIdx + 1)
        .trim()
        .replace(/^'|'$/g, '');

      current.props.set(key, value);

      if (/^bildefil[123]$/i.test(key) && value) {
        current.images.push(value);
      }
    }
  }

  return features;
}

export function parseGMLFeatureInfo(gmlText) {
  const features = [];
  const featureBlocks = gmlText.matchAll(/<(\w+_feature)>([\s\S]*?)<\/\1>/g);

  for (const [, , block] of featureBlocks) {
    const props = new Map();
    const images = [];

    const boxMatch = block.match(/<gml:coordinates>([\d.,\s]+)<\/gml:coordinates>/);
    let centerX = 0;
    let centerY = 0;

    if (boxMatch) {
      const coords = boxMatch[1].trim().split(/\s+/);
      if (coords.length === 2) {
        const [x1, y1] = coords[0].split(',').map(Number);
        const [x2, y2] = coords[1].split(',').map(Number);
        centerX = (x1 + x2) / 2;
        centerY = (y1 + y2) / 2;
      }
    }

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

export function filterFullyAccessible(features) {
  return features.filter((feature) => {
    const r1 = feature.props.get('tilgjengvurderingrulleman');
    const r2 = feature.props.get('tilgjengvurderingrulleauto');
    const r3 = feature.props.get('tilgjengvurderingelrullestol');
    const r4 = feature.props.get('tilgjengvurderingsyn');

    return r1 === 'Tilgjengelig' && r2 === 'Tilgjengelig' && r3 === 'Tilgjengelig' && r4 === 'Tilgjengelig';
  });
}
