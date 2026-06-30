import { describe, expect, it } from 'vitest';
import {
  esc,
  filterFullyAccessible,
  parseCapabilities,
  parseFeatureInfoText,
  parseGMLFeatureInfo,
} from './map-utils';

describe('parseCapabilities', () => {
  it('parses nested layers and legend URLs', () => {
    const xml = `
      <WMS_Capabilities>
        <Capability>
          <Layer>
            <Title>root</Title>
            <Layer>
              <Name>group_1</Name>
              <Title>Group One</Title>
              <Layer>
                <Name>leaf_1</Name>
                <Title>Leaf One</Title>
                <Style>
                  <LegendURL>
                    <OnlineResource xlink:href="https://example.com/legend.png" />
                  </LegendURL>
                </Style>
              </Layer>
            </Layer>
          </Layer>
        </Capability>
      </WMS_Capabilities>
    `;

    const layers = parseCapabilities(xml);

    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe('group_1');
    expect(layers[0].children[0].name).toBe('leaf_1');
    expect(layers[0].children[0].legendUrl).toBe('https://example.com/legend.png');
  });
});

describe('parseFeatureInfoText', () => {
  it('parses features and image fields from plain text', () => {
    const text = `
      GetFeatureInfo results:
      Layer 'layerA'
      Feature 7:
      navn = Teststed
      bildefil1 = bilde.jpg
      stigning = 3
    `;

    const features = parseFeatureInfoText(text);

    expect(features).toHaveLength(1);
    expect(features[0].layerName).toBe('layerA');
    expect(features[0].featureId).toBe('7');
    expect(features[0].props.get('navn')).toBe('Teststed');
    expect(features[0].images).toEqual(['bilde.jpg']);
  });
});

describe('parseGMLFeatureInfo', () => {
  it('parses objid and center point from GML', () => {
    const gml = `
      <msGMLOutput>
        <layer_feature>
          <gml:coordinates>10,20 14,28</gml:coordinates>
          <objid>abc-1</objid>
          <veitype>Turvei</veitype>
        </layer_feature>
      </msGMLOutput>
    `;

    const features = parseGMLFeatureInfo(gml);

    expect(features).toHaveLength(1);
    expect(features[0].featureId).toBe('abc-1');
    expect(features[0].centerX).toBe(12);
    expect(features[0].centerY).toBe(24);
    expect(features[0].props.get('veitype')).toBe('Turvei');
  });
});

describe('filterFullyAccessible', () => {
  it('keeps only features with all accessibility flags set', () => {
    const fully = {
      props: new Map([
        ['tilgjengvurderingrulleman', 'Tilgjengelig'],
        ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
        ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
        ['tilgjengvurderingsyn', 'Tilgjengelig'],
      ]),
    };

    const partial = {
      props: new Map([
        ['tilgjengvurderingrulleman', 'Tilgjengelig'],
        ['tilgjengvurderingrulleauto', 'Ikke tilgjengelig'],
        ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
        ['tilgjengvurderingsyn', 'Tilgjengelig'],
      ]),
    };

    const result = filterFullyAccessible([fully, partial]);
    expect(result).toEqual([fully]);
  });
});

describe('esc', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(esc('<tag attr="x">&')).toBe('&lt;tag attr=&quot;x&quot;&gt;&amp;');
  });
});
