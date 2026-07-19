#!/usr/bin/env python3
"""Compute a stable SHA-256 hash of WFS feature data.

Strips envelope metadata and timestamps from the XML response so the hash
only changes when actual road segment geometry or accessibility properties
change.
"""
import hashlib
import urllib.request
import xml.etree.ElementTree as ET

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


def hash_wfs() -> str:
    url = (
        f'{WFS_URL}?service=WFS&request=GetFeature&version=2.0.0'
        f'&typeNames=app:TettstedVei&count={SAMPLE_SIZE}&srsName=EPSG:4258'
    )
    req = urllib.request.Request(url, headers={'Accept': 'application/xml'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()

    root = ET.fromstring(data)
    chunks = []

    for member in root.findall(f'{{{NS["wfs"]}}}member'):
        for feat in member:
            tag = feat.tag.split('}')[-1] if '}' in feat.tag else feat.tag
            if tag not in ('TettstedVei', 'FriluftTurvei'):
                continue

            # Geometry: posList text
            geom = feat.find('.//gml:posList', NS)
            if geom is not None and geom.text:
                chunks.append(geom.text.strip())

            # Accessibility properties
            for name in PROPS:
                prop = feat.find(f'{{{NS["app"]}}}{name}')
                if prop is not None:
                    # Handle nested child elements (gatetype, etc.)
                    texts = []
                    for c in prop:
                        if c.text:
                            texts.append(c.text.strip())
                    if texts:
                        chunks.append(f'{name}=|'.join(texts))
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