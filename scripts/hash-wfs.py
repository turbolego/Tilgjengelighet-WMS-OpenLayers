#!/usr/bin/env python3
"""Compute a stable SHA-256 hash of WFS feature data.

Strips envelope metadata and timestamps from the XML response so the hash
only changes when actual road segment geometry or accessibility properties
change.
"""
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
import time
import sys
from urllib.error import URLError

WFS_URL = 'https://wfs.geonorge.no/skwms1/wfs.tilgjengelighet'
SAMPLE_SIZE = 100
NS = {
    'gml': 'http://www.opengis.net/gml/3.2',
    'app': 'https://skjema.geonorge.no/SOSI/produktspesifikasjon/Tilgjengelighet/1.3.1',
    'wfs': 'http://www.opengis.net/wfs/2.0',
}

PROPS = (
    'tilgjengvurderingRulleMan', 'tilgjengvurderingRulleAuto',
    'tilgjengvurderingElRull', 'tilgjengvurderingSyn',
    'gatetype', 'bredde', 'stigning', 'tverrfall',
    'ledelinje', 'belysning', 'dekkeFasthet',
)

def fetch_with_retry(req, max_retries=5, base_delay=1):
    """
    Fetch data with retry logic for transient errors.
    """
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except URLError as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (attempt + 1)
            print(f"Connection failed. Retrying in {delay} seconds...", file=sys.stderr)
            time.sleep(delay)
    raise URLError(f"Failed to fetch after {max_retries} attempts")

def hash_wfs() -> str:
    chunks = []

    for type_name in ('app:TettstedVei', 'app:FriluftTurvei'):
        url = (
            f'{WFS_URL}?service=WFS&request=GetFeature&version=2.0.0'
            f'&typeNames={type_name}&count={SAMPLE_SIZE}&srsName=EPSG:4258'
        )
        req = urllib.request.Request(url, headers={'Accept': 'application/xml'})
        data = fetch_with_retry(req)

        root = ET.fromstring(data)
        for member in root.findall(f'{{{NS["wfs"]}}}member'):
            for feat in member:
                tag = feat.tag.split('}')[-1] if '}' in feat.tag else feat.tag
                if tag not in ('TettstedVei', 'FriluftTurvei'):
                    continue

                # Geometry: posList text
                geom = feat.find('.//gml:posList', NS)
                if geom is not None and geom.text:
                    chunks.append(geom.text.strip())

                # Accessibility properties (stable format: name=value)
                for name in PROPS:
                    prop = feat.find(f'{{{NS["app"]}}}{name}')
                    if prop is not None:
                        # Handle nested child elements (gatetype, etc.)
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
    digest = hashlib.sha256(stable).hexdigest()
    print(digest)
    return digest


if __name__ == '__main__':
    hash_wfs()
