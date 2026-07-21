#!/usr/bin/env python3
"""
Pre-generate highscore data from Geonorge WFS Tilgjengelighet.

Downloads all TettstedVei + FriluftTurvei features, filters to
fully accessible segments (all 4 categories = 'Tilgjengelig'),
and outputs a compact JSON array for the mobile app's toppliste.

Output: JSON array of { p, x, y }
  - x, y are EPSG:3857 (Web Mercator) meters
  - p contains only the fields needed by highscore-modal.tsx

Usage:
  python3 scripts/extract-highscore.py [output_path]
  Default output: mobile/assets/highscore.dat
"""

import json
import math
import sys
import xml.etree.ElementTree as ET
from urllib.request import urlopen, Request
from urllib.error import URLError

# ── Config ─────────────────────────────────────────────────────────────
WFS_URL = 'https://wfs.geonorge.no/skwms1/wfs.tilgjengelighet'
CHUNK_SIZE = 5000
TIMEOUT = 120
USER_AGENT = 'TilgjengelighetApp/1.0 (highscore-generator)'

NS = {
    'wfs': 'http://www.opengis.net/wfs/2.0',
    'gml': 'http://www.opengis.net/gml/3.2',
    'app': 'https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1',
}

# Props to keep in output (everything the highscore modal displays)
KEEP_PROPS = {
    'veitype', 'segmentlengde', 'stigning', 'bredde', 'tverrfall',
    'kommune', 'fylkesnavn', 'gatetype', 'belysning', 'ledelinje',
    'dekkeFasthet', 'dekkeTilstand', 'varmekabel',
    'tilgjengvurderingElRull', 'tilgjengvurderingRulleMan',
    'tilgjengvurderingRulleAuto', 'tilgjengvurderingSyn',
}


# ── Helpers ─────────────────────────────────────────────────────────────

def to_mercator(lat: float, lon: float) -> tuple[float, float]:
    """Convert EPSG:4258 (lat/lon) to EPSG:3857 (Web Mercator meters)."""
    x = lon * 20037508.34 / 180
    y = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180)
    y = y * 20037508.34 / 180
    return (x, y)


def parse_poslist(text: str):
    """Parse gml:posList 'lon lat lon lat ...' → [(lat, lon), ...]"""
    nums = list(map(float, text.strip().split()))
    coords = []
    for i in range(0, len(nums), 2):
        coords.append((nums[i + 1], nums[i]))  # (lat, lon)
    return coords


def center_of(coords: list[tuple[float, float]]) -> tuple[float, float]:
    """Compute centroid of a list of (lat, lon) pairs."""
    if not coords:
        return (0, 0)
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    clat = (min(lats) + max(lats)) / 2
    clon = (min(lons) + max(lons)) / 2
    return (clat, clon)


def segment_length_m(coords: list[tuple[float, float]]) -> float:
    """Compute total length in meters using Haversine formula."""
    if len(coords) < 2:
        return 0.0
    R = 6371000  # Earth radius in meters
    total = 0.0
    for i in range(len(coords) - 1):
        lat1, lon1 = math.radians(coords[i][0]), math.radians(coords[i][1])
        lat2, lon2 = math.radians(coords[i + 1][0]), math.radians(coords[i + 1][1])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        total += R * c
    return total


def is_fully_accessible(props: dict[str, str]) -> bool:
    """All 4 accessibility categories must be 'Tilgjengelig'."""
    for key in ('tilgjengvurderingElRull', 'tilgjengvurderingRulleMan',
                'tilgjengvurderingRulleAuto', 'tilgjengvurderingSyn'):
        val = props.get(key, '').strip()
        if val != 'Tilgjengelig':
            return False
    return True


# ── Download ────────────────────────────────────────────────────────────

def download_features(type_name: str) -> list[dict]:
    """Download all features for a type, returning parsed segment dicts."""
    segments = []
    offset = 0

    print(f'\n── Downloading {type_name} ──')

    while True:
        url = (f'{WFS_URL}?service=WFS&request=GetFeature&version=2.0.0'
               f'&typeNames={type_name}&count={CHUNK_SIZE}&startIndex={offset}'
               f'&srsName=EPSG:4258')

        try:
            req = Request(url, headers={'User-Agent': USER_AGENT})
            xml_text = urlopen(req, timeout=TIMEOUT).read().decode('utf-8')
        except URLError as e:
            print(f'  Error at offset {offset}: {e}')
            break

        root = ET.fromstring(xml_text)
        members = root.findall('wfs:member', NS)
        received = len(members)

        if received == 0:
            break

        for m in members:
            vei = (m.find('{https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1}TettstedVei') or
                   m.find('{https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1}FriluftTurvei'))
            if vei is None:
                continue

            # Geometry
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

            # Properties
            props = {}
            for child in vei:
                tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if tag in ('geometri', 'identifikasjon', 'trapp'):
                    continue
                props[tag] = (child.text or '').strip()

            # Check for staircase
            trapp_el = vei.find('app:trapp/app:Trapp/app:trapp', NS)
            if trapp_el is not None:
                props['trapp'] = (trapp_el.text or '').strip()

            # Filter by accessibility
            if not is_fully_accessible(props):
                continue

            # Compute centroid and length
            clat, clon = center_of(coords)
            mx, my = to_mercator(clat, clon)
            seg_len = segment_length_m(coords)

            # Map gatetype → veitype (WFS uses 'gatetype', modal expects 'veitype')
            if 'gatetype' in props:
                props['veitype'] = props['gatetype']

            # Compute segmentlengde from geometry (WFS doesn't provide it)
            props['segmentlengde'] = f'{seg_len:.1f}'

            # Keep only needed props
            kept = {k: v for k, v in props.items() if k in KEEP_PROPS}

            segments.append({
                'p': kept,
                'x': round(mx, 1),
                'y': round(my, 1),
            })

        offset += received
        print(f'  [{offset:,}] {len(segments):,} accessible segments')

        if received < CHUNK_SIZE:
            break

    return segments


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    urban = download_features('app:TettstedVei')
    trail = download_features('app:FriluftTurvei')
    all_segments = urban + trail

    print(f'\n── Results ──')
    print(f'  TettstedVei accessible: {len(urban):,}')
    print(f'  FriluftTurvei accessible: {len(trail):,}')
    print(f'  Total accessible: {len(all_segments):,}')

    output_path = sys.argv[1] if len(sys.argv) > 1 else 'mobile/assets/highscore.dat'

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_segments, f, ensure_ascii=False, separators=(',', ':'))

    import os
    size = os.path.getsize(output_path)
    print(f'\n  Output: {output_path} ({size / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
