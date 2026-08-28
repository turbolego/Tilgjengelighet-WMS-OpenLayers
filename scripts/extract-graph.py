#!/usr/bin/env python3
"""
Download all TettstedVei + FriluftTurvei features from Geonorge WFS,
build a connected walking graph, and export as compact JSON.

Key trick: WFS segments don't share nodes (unlike OSM).
We connect nearby endpoints to create a navigable graph.

Accessibility weights are encoded per edge.
"""
import hashlib
import json
import math
import sys
from datetime import datetime
import xml.etree.ElementTree as ET
from urllib.error import URLError, HTTPError

# ── Config ─────────────────────────────────────────────────────────────
WFS_URL = 'https://wfs.geonorge.no/skwms1/wfs.tilgjengelighet'
CHUNK_SIZE = 5000  # download 5000 features per request (pagination)
SNAP_RADIUS_M = 15  # snap endpoints within 15m to connect segments
MAX_DISTANCE_M = 500  # don't connect segments > 500m apart (prevents bridge)

NS = {
    'wfs': 'http://www.opengis.net/wfs/2.0',
    'gml': 'http://www.opengis.net/gml/3.2',
    'app': 'https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1',
}

# ── WFS hash (same logic as hash-wfs.py, kept in sync) ──────────────────
HASH_NS = NS.copy()
HASH_PROPS = (
    'tilgjengvurderingRulleMan', 'tilgjengvurderingRulleAuto',
    'tilgjengvurderingElRull', 'tilgjengvurderingSyn',
    'gatetype', 'bredde', 'stigning', 'tverrfall',
    'ledelinje', 'belysning', 'dekkeFasthet',
)
HASH_SAMPLE = 100


def fetch_with_retry(url, max_retries=8, base_delay=2, timeout=60):
    """Fetch URL with retry for transient errors (both connection and HTTP)."""
    import urllib.request
    import time
    req = urllib.request.Request(url, headers={'Accept': 'application/xml'})
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (URLError, HTTPError) as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (attempt + 1)
            code = e.code if isinstance(e, HTTPError) else str(e.reason)
            print(f"  WFS fetch failed (attempt {attempt+1}/{max_retries}, code={code}). Retrying in {delay}s...", file=sys.stderr)
            time.sleep(delay)
    raise Exception(f"Failed to fetch after {max_retries} attempts")


def compute_data_hash() -> str:
    """Compute a stable SHA-256 hash of a WFS sample (same as hash-wfs.py)."""
    chunks = []
    for type_name in ('app:TettstedVei', 'app:FriluftTurvei'):
        url = (
            f'{WFS_URL}?service=WFS&request=GetFeature&version=2.0.0'
            f'&typeNames={type_name}&count={HASH_SAMPLE}&srsName=EPSG:4258'
        )
        data = fetch_with_retry(url)
        root = ET.fromstring(data)
        for member in root.findall(f'{{{HASH_NS["wfs"]}}}member'):
            for feat in member:
                tag = feat.tag.split('}')[-1] if '}' in feat.tag else feat.tag
                if tag not in ('TettstedVei', 'FriluftTurvei'):
                    continue
                geom = feat.find('.//gml:posList', HASH_NS)
                if geom is not None and geom.text:
                    chunks.append(geom.text.strip())
                for name in HASH_PROPS:
                    prop = feat.find(f'{{{HASH_NS["app"]}}}{name}')
                    if prop is not None:
                        texts = []
                        for c in prop:
                            if c.text:
                                texts.append(c.text.strip())
                        if texts:
                            chunks.append(f'{name}={",".join(texts)}')
                        elif prop.text:
                            chunks.append(f'{name}={prop.text.strip()}')
                        else:
                            chunks.append(f'{name}=')
    stable = '\n'.join(chunks).encode()
    return hashlib.sha256(stable).hexdigest()


# ── Helpers ─────────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def parse_poslist(poslist_text: str):
    """Parse gml:posList 'lon lat lon lat ...' → [(lat, lon), ...]"""
    nums = list(map(float, poslist_text.strip().split()))
    coords = []
    for i in range(0, len(nums), 2):
        lat = nums[i + 1]
        lon = nums[i]
        coords.append((lat, lon))
    return coords

def parse_float(val, default=0.0):
    """Parse a value that may be a string or XML element to float."""
    if isinstance(val, str):
        text = val.strip()
    elif hasattr(val, 'text'):
        text = (val.text or '').strip()
    else:
        return default
    try:
        return float(text.replace(',', '.'))
    except (ValueError, AttributeError):
        return default

def parse_bool(val, default=False):
    """Parse a value that may be a string or XML element to bool."""
    if isinstance(val, str):
        text = val.strip().lower()
    elif hasattr(val, 'text'):
        text = (val.text or '').strip().lower()
    else:
        return default
    if text in ('ja', 'true', '1', 'tilgjengelig'):
        return True
    if text in ('nei', 'false', '0'):
        return False
    return default

# ── Accessibility scoring ───────────────────────────────────────────────

def score_road(props):
    """
    Compute accessibility weight from road properties.
    Lower weight = more accessible. Higher = less accessible.
    Base weight 100. Each positive property reduces it.

    Properties:
    - tilgjengvurderingElRull / RulleMan / RulleAuto / Syn
      Values: Tilgjengelig, Delvis tilgjengelig, Ikke tilgjengelig, ''
    - bredde: width in cm (wider = better)
    - stigning: gradient % (lower = better)
    - tverrfall: crossfall % (lower = better)
    - ledelinje: tactile paving
    - dekkeFasthet: surface hardness
    - belysning: lighting
    - varmekabel: heated pavement
    """
    weight = 100

    # Accessibility assessments (from Kartverket)
    for key in ('tilgjengvurderingElRull', 'tilgjengvurderingRulleMan',
                 'tilgjengvurderingRulleAuto', 'tilgjengvurderingSyn'):
        val = (props.get(key) or '').strip()
        if val == 'Tilgjengelig':
            weight -= 10
        elif val == 'Delvis tilgjengelig':
            weight -= 3
        # Ikke tilgjengelig: no reduction
        # empty: no reduction

    # Width bonus (cm)
    bredde = parse_float(props.get('bredde'), 0)
    if bredde >= 200:
        weight -= 10
    elif bredde >= 150:
        weight -= 5
    elif bredde < 100 and bredde > 0:
        weight += 5

    # Gradient penalty
    stigning = parse_float(props.get('stigning'), 0)
    if stigning > 5:
        weight += stigning * 2  # steep incline
    elif stigning > 3:
        weight += stigning

    # Crossfall penalty (tilts wheelchair sideways)
    tverrfall = parse_float(props.get('tverrfall'), 0)
    if tverrfall > 2:
        weight += tverrfall * 5

    # Surface hardness (fast = firm, good)
    # DekkeTilstand: Jevnt = even
    dekke_fast = (props.get('dekkeFasthet') or '').strip()
    if dekke_fast == 'Fast':
        weight -= 5
    elif dekke_fast == 'Løs':
        weight += 10

    dekke_tilstand = (props.get('dekkeTilstand') or '').strip()
    if dekke_tilstand == 'Ujevnt':
        weight += 10
    elif dekke_tilstand == 'Jevnt':
        weight -= 3

    # Tactile paving
    ledelinje = (props.get('ledelinje') or '').strip()
    if 'Taktil' in ledelinje:
        weight -= 3

    # Lighting
    belysning = (props.get('belysning') or '').strip().lower()
    if belysning == 'ja':
        weight -= 2

    # Heated pavement (winter ice prevention)
    varmekabel = (props.get('varmekabel') or '').strip().lower()
    if varmekabel == 'ja':
        weight -= 5

    # Gate type adjustment
    gatetype = (props.get('gatetype') or '').strip().lower()
    if gatetype in ('fortau', 'gangfelt', 'gangvei'):
        weight -= 5  # pedestrian infrastructure
    elif gatetype == 'trapp':
        weight += 200  # stairs are NOT accessible

    return max(weight, 0)

# ── Download ────────────────────────────────────────────────────────────

def download_features(type_name, count_hint=0):
    """Download all features for a given typeName, returning parsed segments."""
    segments = []
    offset = 0
    received = None
    total_expected = 71720  # known total

    print(f'\n── Downloading {type_name} ──')
    while True:
        url = (f'{WFS_URL}?service=WFS&request=GetFeature&version=2.0.0'
               f'&typeNames={type_name}&count={CHUNK_SIZE}&startIndex={offset}'
               f'&srsName=EPSG:4258')
        try:
            import urllib.request
            req = urllib.request.urlopen(url, timeout=120)
            xml_text = req.read().decode('utf-8')
        except Exception as e:
            print(f'  Error at offset {offset}: {e}')
            break

        root = ET.fromstring(xml_text)

        # The server sometimes reports numberReturned="0" but still returns
        # members — always check for actual member elements.
        members = root.findall('{http://www.opengis.net/wfs/2.0}member')

        if len(members) == 0:
            # Fallback: try without namespace
            members = root.findall('.//wfs:member', {'wfs': 'http://www.opengis.net/wfs/2.0'})

        received = len(members)
        if received == 0:
            break

        members = root.findall('wfs:member', NS)
        for m in members:
            vei = m.find('{https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1}TettstedVei') or \
                  m.find('{https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1}FriluftTurvei')
            if vei is None:
                continue

            # ── Geometry ──
            geom = vei.find('{https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1}geometri')
            if geom is None:
                continue
            ls = geom.find('{http://www.opengis.net/gml/3.2}LineString')
            if ls is None:
                continue
            poslist = ls.find('{http://www.opengis.net/gml/3.2}posList')
            if poslist is None or poslist.text is None:
                continue
            coords = parse_poslist(poslist.text)
            if len(coords) < 2:
                continue

            # ── Properties ──
            props = {}
            for child in vei:
                tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if tag in ('geometri', 'identifikasjon', 'trapp'):
                    continue
                props[tag] = child.text or ''

            # Special: nested Trapp
            trapp_el = vei.find('app:trapp/app:Trapp/app:trapp', NS)
            if trapp_el is not None:
                props['trapp'] = trapp_el.text or ''

            weight = score_road(props)
            segments.append({
                'coords': coords,  # [(lat, lon), ...]
                'weight': weight,
                'props': props,
            })

        offset += received
        pct = ''
        if count_hint:
            pct = f'  ({offset/(count_hint+received)*100:.0f}%)'
        print(f'  [{offset:,}{pct}] {len(segments):,} segments')

        if received < CHUNK_SIZE:
            break

    return segments

# ── Graph Build ────────────────────────────────────────────────────────

def build_graph(all_segments):
    """
    Convert disconnected WFS road segments into a connected graph.

    Strategy:
    1. Only endpoints matter for connectivity (first & last coord of each segment)
    2. Grid-snap nearby endpoints together (within SNAP_RADIUS_M)
    3. Each segment becomes edges between its endpoint nodes, with
       intermediate coordinates as routing waypoints.
    4. Each edge carries accessibility weight adjusted distance.
    """
    print(f'\n── Building graph from {len(all_segments):,} segments ──')

    # ── Phase 1: collect endpoints ──
    # For each segment, track: start_idx, end_idx, and all coordinates
    segment_ends = []  # [(seg_index, start_lat, start_lon, end_lat, end_lon)]
    segment_coords = []  # [seg_index] -> [(lat, lon), ...]
    all_endpoints = []  # (lat, lon) tuples for spatial index

    for seg_idx, seg in enumerate(all_segments):
        coords = seg['coords']
        segment_coords.append(coords)
        start_lat, start_lon = coords[0]
        end_lat, end_lon = coords[-1]
        segment_ends.append((seg_idx, start_lat, start_lon, end_lat, end_lon))
        all_endpoints.append((start_lat, start_lon))
        if len(coords) > 1:
            all_endpoints.append((end_lat, end_lon))

    print(f'  Segment endpoints: {len(all_endpoints):,}')

    # ── Phase 2: build spatial grid for endpoints ──
    # Grid cell = 0.002° (~200m) — smaller for faster endpoint snapping
    cell_size = 0.002  # degrees
    grid = {}

    def grid_key(lat, lon):
        return (int(lat / cell_size), int(lon / cell_size))

    # Insert all endpoints into grid with their ID
    for i, (lat, lon) in enumerate(all_endpoints):
        key = grid_key(lat, lon)
        grid.setdefault(key, []).append((lat, lon, i))

    print(f'  Grid cells: {len(grid):,}')

    # ── Phase 3: snap endpoints ──
    # Map: original endpoint index → unique node index
    endpoint_to_node = {}  # endpoint_index -> node_index
    node_to_coord = []  # node_index -> (lat, lon)
    snap_stats = {'snapped': 0, 'new': 0}

    for i, (lat, lon) in enumerate(all_endpoints):
        key = grid_key(lat, lon)
        nearest_dist = SNAP_RADIUS_M
        nearest_node = None

        # Search 3x3 cell neighborhood
        for dlat in (-1, 0, 1):
            for dlon in (-1, 0, 1):
                search_key = (key[0] + dlat, key[1] + dlon)
                for (lat2, lon2, j) in grid.get(search_key, []):
                    if j == i:
                        continue
                    if j in endpoint_to_node:
                        dist = haversine(lat, lon, lat2, lon2)
                        if dist < nearest_dist:
                            nearest_dist = dist
                            nearest_node = endpoint_to_node[j]

        if nearest_node is not None:
            endpoint_to_node[i] = nearest_node
            snap_stats['snapped'] += 1
        else:
            node_id = len(node_to_coord)
            endpoint_to_node[i] = node_id
            node_to_coord.append((lat, lon))
            snap_stats['new'] += 1

    print(f'  Endpoint snapping: {snap_stats["snapped"]:,} snapped, '
          f'{snap_stats["new"]:,} unique nodes = {len(node_to_coord):,} total')

    # ── Phase 4: build edges from segments ──
    edge_dict = {}  # (min_node, max_node) -> [from, to, weight]

    for seg_idx, seg in enumerate(all_segments):
        coords = segment_coords[seg_idx]
        # Get node for start point
        # start is endpoint index 2*seg_idx (since endpoints stored in pairs)
        start_ep_idx = seg_idx * 2
        end_ep_idx = seg_idx * 2 + int(len(coords) > 1)

        start_node = endpoint_to_node[start_ep_idx]
        end_node = endpoint_to_node[end_ep_idx]

        if start_node == end_node:
            continue  # zero-length segment

        # Calculate total distance and accessibility weight
        total_dist = 0.0
        for k in range(1, len(coords)):
            total_dist += haversine(coords[k-1][0], coords[k-1][1], coords[k][0], coords[k][1])

        if total_dist < 2 or total_dist > MAX_DISTANCE_M:
            continue

        # Weighted distance: accessibility_factor * distance
        weight = seg['weight']
        factor = 1.0 + (weight / 100)  # 1.0 to 2.0
        edge_weight = round(total_dist * factor)

        edge_key = (min(start_node, end_node), max(start_node, end_node))
        if edge_key not in edge_dict or edge_weight < edge_dict[edge_key][2]:
            edge_dict[edge_key] = [start_node, end_node, edge_weight, total_dist]

    # Add reverse edges (undirected graph)
    all_edges = list(edge_dict.values())
    rev = []
    for (u, v, w, d) in all_edges:
        key = (v, u)
        if key not in edge_dict:
            rev.append([v, u, w, d])
    all_edges.extend(rev)

    print(f'  Edges: {len(all_edges):,}')

    # ── Phase 5: compact export ──
    # node_to_coord stores (lat, lon) from parse_poslist — v[0]=lat, v[1]=lon
    node_lats_int = [round(v[0] * 10000) for v in node_to_coord]
    node_lons_int = [round(v[1] * 10000) for v in node_to_coord]

    flat_edges = []
    for u, v, w, d in all_edges:
        flat_edges.extend([u, v, w])

    graph = {
        'la': node_lats_int,
        'lo': node_lons_int,
        'e': flat_edges,
    }

    return graph, all_edges, node_to_coord

# ── Main ─────────────────────────────────────────────────────────────────

def main():
    import urllib.request

    # Download
    urban = download_features('app:TettstedVei', 47835)
    trail = download_features('app:FriluftTurvei', 23885)
    all_segs = urban + trail

    print(f'\n── Total ──')
    print(f'  TettstedVei: {len(urban):,}')
    print(f'  FriluftTurvei: {len(trail):,}')
    print(f'  Combined: {len(all_segs):,}')

    # Build graph
    graph, edges, coords = build_graph(all_segs)

    # Calculate coverage bounds from the graph data (correctly ordered)
    lats = [v / 10000 for v in graph['la']]
    lons = [v / 10000 for v in graph['lo']]
    bounds = {
        'minLat': round(min(lats), 4),
        'maxLat': round(max(lats), 4),
        'minLon': round(min(lons), 4),
        'maxLon': round(max(lons), 4),
    }

    output_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/norge-routing-graph.json'
    with open(output_path, 'w') as f:
        json.dump(graph, f, separators=(',', ':'))

    import os
    size = os.path.getsize(output_path)

    # Compute data hash for change detection
    print('\n── Computing data hash ──')
    data_hash = compute_data_hash()
    print(f'  dataHash: {data_hash}')

    # Build timestamp
    ts = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

    manifest = {
        'source': 'geonorge.no WFS Tilgjengelighet (app:TettstedVei + app:FriluftTurvei)',
        'extracted': ts,
        'dataHash': data_hash,
        'nodeCount': len(graph['la']),
        'edgeCount': len(graph['e']) // 3,
        'bounds': bounds,
    }

    manifest_path = output_path.replace('.json', '-manifest.json').replace('.dat', '-manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f'\n── Output ──')
    node_count = len(graph['la'])
    edge_count = len(graph['e']) // 3
    print(f'  Size: {size / 1024 / 1024:.1f} MB')
    print(f'  Nodes: {node_count:,}')
    print(f'  Edges: {edge_count:,}')
    mlat = bounds['minLat']
    mlon = bounds['minLon']
    xlat = bounds['maxLat']
    xlon = bounds['maxLon']
    print(f'  Bounds: lat [{mlat}, {xlat}]  lon [{mlon}, {xlon}]')
    print(f'  Manifest: {manifest_path}')

    # Coverage assessment
    print(f'\n── Coverage ──')
    lat_span = bounds['maxLat'] - bounds['minLat']
    lon_span = bounds['maxLon'] - bounds['minLon']
    print(f'  Latitude span: {lat_span:.2f}°')
    print(f'  Longitude span: {lon_span:.2f}°')

    # Find cities in coverage by sampling
    cities = {
        'Oslo': (59.91, 10.75),
        'Bergen': (60.39, 5.32),
        'Trondheim': (63.43, 10.40),
        'Stavanger': (58.97, 5.73),
        'Tromsø': (69.65, 18.96),
        'Kristiansand': (58.15, 7.99),
        'Drammen': (59.74, 10.20),
        'Fredrikstad': (59.22, 10.93),
        'Bodø': (67.28, 14.40),
        'Ålesund': (62.47, 6.15),
        'Hamar': (60.79, 11.07),
    }
    print('  City coverage check:')
    for name, (lat, lon) in cities.items():
        in_bounds = (bounds['minLat'] <= lat <= bounds['maxLat'] and
                      bounds['minLon'] <= lon <= bounds['maxLon'])
        label = 'IN' if in_bounds else 'OUT '
        print(f'    {name:15s}: {label} ({lat}, {lon})')


if __name__ == '__main__':
    main()