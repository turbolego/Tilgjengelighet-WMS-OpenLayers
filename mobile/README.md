# Tilgjengelighet — Mobilapp

Geonorge tilgjengelighetskart som **Expo-mobilapp** for Android og iOS. Planlegger ruter med fokus på universell utforming — hvilke veier og stier er konstruert for rullestol, barnevogn og nedsatt syn?

Ruting støtter tre motorer:
- **WFS Dijkstra** (lokal graf, null nettverk)
- **OSM Overpass API** (global, krever User-Agent header)
- **Valhalla** (global, ingen autentisering)

---

## 🚀 Komme i gang

```bash
npm install
npx expo start
```

Da får du opp Expo dev-server. Deretter:
- `a` → Android-emulator
- `i` → iOS-simulator
- Skann QR-kode med **Expo Go** (Android)

## 🧪 Testing & CI

```bash
npx expo lint       # ESLint
npx tsc --noEmit     # TypeScript-kompilering
```

Disse kjøres automatisk i CI ved pull requests.

## 📱 Funksjoner

### Hovedmeny (ActionBar)

| Knapp | Funksjon |
|---|---|
| + / − | Zoom inn / ut |
| ⌂ | Tilbakestill kartvisning |
| 📍 | Hent min posisjon + start kontinuerlig GPS-sporing |
| 🏆 | Toppliste — universelt tilgjengelige veier i nærheten |
| 📋 | Vis WMS-objekter i visningsområdet |
| 🔎 | Søk stedsnavn (Kartverket) |
| 🧭 | Ruteplanlegger |
| 🚻 | Nærmeste toalett (ruter automatisk) |
| ⚙ | Innstillinger |

### Ruteplanlegger

1. Velg startsted (søk eller «Min posisjon»)
2. Velg destinasjon
3. Trykk «Planlegg rute»
4. Ruten vises på kartet med fargekodet tilgjegelighetsanalyse

**3 ruting-fallbacks:**
- WFS Dijkstra (lokal graf — null nettverkskall)
- OSM Overpass (bbox-spørring med highway-tags)
- Valhalla (global, gratis, ingen API-nøkkel)

**Tilgjengelighetsvurdering:**
- 🟢 Tilgjengelig (asfalt/gangvei)
- 🟡 Delvis tilgjengelig (skogsvei)
- 🔴 Ikke tilgjengelig (sti/trapp)
- ⚪ Manglende data → OSM tag-fallback

### 🔍 Tekniske detaljer

**WMS-tjenester:**
- Primær: `wms.tilgjengelighet3` → `t_vei_r`-lag
- Sekundær: veggrunn, stedsnavn (toppliste/kartskanning)

**Ruting (i rekkefølge):**
- **WFS Dijkstra**: Lokal graf fra Geonorge WFS
- **OSM Overpass**: `overpass-api.de` API med User-Agent-header
- **Valhalla**: `valhalla1.openstreetmap.de` globalt API

**Ingen API-nøkler!** Alle rutingtjenester og kartdata er offentlige og gratis.

---

## 🏗 Bygge appen

For lokale produksjonsbygg, se [MOBILE_BUILD.md](../MOBILE_BUILD.md).

GitHub Actions bygger automatisk:
- **Release**: APK/AAB på hver push til `main`
- **Playwright-tester**: E2E på hver PR
- **Lint + TypeScript**: CI på hver PR

---

## 🎨 Design

- Mørk palett: `#0d1117` (ink), `#e8a020` (amber), `#3a5068` (steel)
- WCAG AA: Kontrast ≥ 5.65:1
- Norsk UI (a11yLabels, feilmeldinger, toast)
- SafeAreaProvider — ingen overlapping med system bars

---

## 🌍 Ressurser

- [MapLibre React Native docs](https://maplibre.org/maplibre-react-native/)
- [Valhalla API docs](https://valhalla.github.io/valhalla/api/route/api-reference/)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Geonorge Tilgjengelighet WMS](https://data.norge.no/data-services/98c22855-9637-3b91-9299-4138ac00f072)
- [Statens Vegvesen Ruteplantjeneste](https://www.vegvesen.no/ws/no/vegvesen/ruteplan/routingservice_v2_0/open/routingservice)