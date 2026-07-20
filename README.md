# Tilgjengelighet-WMS-OpenLayers

Kartlag fra «Tilgjengelighet WMS» av Statens kartverk — WMS-visning med fokus på WCAG-standarden.

Kilde til WMS-kartlag: https://data.norge.no/data-services/98c22855-9637-3b91-9299-4138ac00f072

## 🎯 Hva gjør denne appen?

- **Web-app** (Vite + OpenLayers) — statisk kartvisning deployet til GitHub Pages
- **Mobil-app** (Expo + MapLibre React Native) — Android og iOS med ruteplanlegging for bevegelseshemmede

Appen viser **Geonorges tilgjengelighetskart** (universell utforming / t_vei_r) og lar deg planere ruter med tilgjengelighetsvurdering — hvilke veier og stier er konstruert for rullstol, barnevogn, og nedsatt syn?

---

## Live deployment

### Web
```
https://<your-username>.github.io/geonorge-wms-viewer/
```

### Mobile
Pre-built APK/AAB releases — [GitHub Releases](../../releases)

---

## Quick start

### Web (root)
```bash
npm install
npm run dev        # http://localhost:5173
npm run build        # → dist/
npm test
npm run check        # All quality gates
```

### Mobile (Expo)
```bash
cd mobile
npm install
npx expo start
# 'a' → Android emulator
# 'i' → iOS simulator
# Or scan QR code with Expo Go (Android only)
```

---

## Mobile app features

| Funksjon | Beskrivelse |
|---|---|
| **🗺️ Kartvisning** | OpenFreeMap basemap + Geonorge WMS overlay («t_vei_r», «t_adr_k», etc.) |
| **🧭 Ruteplanlegging** | WFS Dijkstra → OSM Overpass → Valhalla public fallback Automatisk kjede: lokal graf → Overpass API → global ruting |
| **♿ Tilgjegelighetsanalysis** | Per segment: grønn (tilgjengelig) · ● gul (delvis) · rød (ikke) · grå (ukjent) |
| **🚻 Nærmeste toalett** | Hovedmenuknapp: fin `nærmeste`amenity=toilets` · ruter dit Automatik |
| **📍 GPS-sporing** | Blå posisjonsmerke som følger deg i sanntid (hvert 5. sek/10 m) |
| **🔎 Steds søk** | Kartverket stedsnavntjeneste (3+ tegn, 15 treff) |
| **🏆 Toppliste** | Universelt tilgjengelige veier i visningsområdet |
| **📋 Funn oversikt** | Alle WMS-objekter i visnigsområde (filtrett på aktive lags) |
| **📸 Trykk for info** | GetFeatureInfo som henter egenskapsdata når brukeren tapper |
| **⚙ Innstillinger** | Basisk kartvalg (OSM/Topo/None) · lagveksler · WCAG farger |
| **🌓 Mørk temat** | Ink/amber/stil fargepalet (#0d1117 / #e8a020 / #3a5068) |
| **♿ Tilgjenjeligheit** | Norske a11yLabel's · safe area-håndtering · modal backdrops med liskeetiketter |

### Ruting pipeline (3 fallbacks)

| Priority | Engine | Coverage | Auth | When used |
|---|---|---|---|---|
| 1 | **WFS Dijkstra** (TettstedVei + FriluftsTurvei) | Norway dense areas | None | Always first |
| 2 | **OSM Overpass** (bbox query) | Matrix of single-road areas | User-Agent header | WFS disconnected or sparse |
| 3 | **Valhalla** (valhalla1.openstreetmap.de) | **Global** | **None** | All else fails |

---

## Features (web app)

- **Dynamic layer list** — fetched live from `GetCapabilities` XML, grouped and sorted alphabetically
- **WMS GetFeatureInfo** — click or press Enter on the map to query feature details at that point
- **Basemap switcher** — OpenStreetMap, Kartverket Topografisk, or no basemap
- **ARIA live region** — feature info is announced to screen readers automatically
- **Keyboard navigation** — full Tab/Arrow/Enter support; custom zoom buttons; skip links
- **High-contrast theme** — ink blue + signal amber palette, meeting WCAG AA 4.5:1
- **Mobile responsive** — collapsible sidebar for small screens

---

## Accessibility (WCAG 2.1 AA)

| Criterion | How it's met |
|---|---|
| 1.1.1 Non-text Content | Map canvas has `aria-label`; legends have `alt` text |
| 1.3.1 Info & Relationships | Semantic `<fieldset>`, `<legend>`, `<table>` in feature info |
| 1.4.3 Contrast | UI text/icons ≥ 4.5:1 on backgrounds (mobile: verified ≥ 5.65:1) |
| 2.1.1 Keyboard | All controls reachable and operable by keyboard |
| 2.4.1 Bypass Blocks | Skip links to map and layer panel |
| 2.4.7 Focus Visible | 3px amber focus ring on all interactive elements |
| 4.1.2 Name/Role/Value | Checkboxes have `aria-label`; Norwegian `a11yLabel` on mobile |
| 4.1.3 Status Messages | Feature info uses `aria-live="polite"`; mobile toast notifications |

**Testing checklist:**
- [ ] Aristone / Lighthouse accessibility audit
- [ ] Keyboard-only navigation (Tab, arrows, Enter, +/-)
- [ ] Screen reader test with NVDA (Windows), VoiceOver (macOS), or TalkBack (Android)
- [ ] Check at 200% browser zoom
- [ ] Mobile: verify safe area handling on all device sizes

---

## Deploy to GitHub Pages

### Option A – GitHub Actions (recommended, automatic)

1. Push this repo to GitHub (e.g., `geonorge-wms-viewer`).
2. In Settings → Pages, set source to GitHub Actions.
3. `.github/workflows/deploy.yml` runs on every push to `main` and deploys automatically.

### Option B – Manual deploy

```bash
npm run build
npx gh-pages -d dist
```

### `vite.config.js` base path

If your repo is not at the root of your GitHub Pages domain, set the `base` in `vite.config.js`:

```js
base: '/geonorge-wms-viewer/'
```

---

## Mobile apps — builds and releases

### Production builds (GitHub Releases)

**Release ( `.github/workflows/ release.yml` ):**
- **Android**: Builds APK + AAB on every push to `main` (no tokens)
- **iOS**: Manual trigger (`workflow_dispatch`, requires macOS)

### Preview builds (EAS)

` `.github/workflows/mobile-eas.yml`:`
- Requires `EXPO_TOKEN` repository secret
- Supports signed iOS IPA and Play Store-ready AAB
- Can also submit to app stores

### Local development builds

```bash
cd mobile
npx expo run:android    # Or: npm run android
npx expo run:ios        # Or: npm run ios
```

For details, see [MOBILE_BUILD.md](./MOBILE_BUILD.md).

---

## Tech stack

| Library | Purpose |
|---|---|
| **Web** | |
| [OpenLayers 10](https://openlayers.org/) | Map rendering, WMS, projections |
| [Vite 8](https://vitejs.dev/) | Bundler, dev server |
| [Vitest](https://vitest.dev/) | Unit testing |
| Vanilla JS / CSS | UI, accessibility |
| GitHub Actions | CI/CD deployment |
| **Mobile** | |
| [Expo SDK 57](https://docs.expo.dev/) | Universal React Native framework |
| [Expo Router](https://docs.expo.dev/router/introduction/) | File-based routing |
| [MapLibre GL Native](https://maplibre.org/) | Map rendering (WMS, layers) |
| [Valhalla](https://github.com/valhalla/valhalla) | Global OSM routing (public instance) |
| [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | OSM graph extraction + toilet search |
| [Geonorge WFS](https://register.org/) | Norwegian route graph (TettstadVej, FriluftTurvej) |
| Shared TypeScript utilities | XML/GML/e. parsing, filtering, routing core |

---

## WMS services

- **Primary**: `https://wms.geonorge.no/skwms1/wms.tilgjengelighet3`
- **Provider**: Kartverket / Statens kartverk
- **License**: Norge digitalt / © Statens kartverk
- **Metadata**: [Geonorge](https://www.geonorge.no/geonetwork/srv/nor/catalog.search#/metadata/b139a2c3-bdc3-4420-9def-4ce1080fcf0c)

---

## Project structure

```
.                   ← web app (Vite + OpenLayers)
├── index.html
├── main.js
├── src/              ← web-specific UI + logic
├── test/             ← vitest suite
└── .github/workflows/  ← CI/CD (lint, test, git, deploy, mobile, release)

mobile/              ← mobile app (Expo + MapLibre)
├── app.json
├── src/
│   ├── app/           ← Expo Router screens (index.tsx = HomeScenen)
│   ├── components/    ← React Native components (init, status, toasts
│   └── utils/         ← Routing, search, API clients
└── .expo/             ← Expo config
```

---

## Development workflows

### Web

```bash
npm install
npm run dev
npm run build
npm test
npm run check         # lint + test + type-check
```

### Mobile

```bash
cd mobile
npx expo start
npx expo lint
npx tsc --noEmit      # type check
```

### All pre-commit checks

```bash
npm run check          # web
npx expo lint && npx tsc --noEmit       # mobile
```

### Routes (API, no auth required)

| Route | Type | URL | Limits |
|---|---|---|---|
| WMS tile | Raster | `https://wms.geonorge.no/skwms1/wms.tilgjengelighet3` | None |
| WMS GetFeatureInfo | Plain text | Same base URL | None |
| OSM graph (routing) | `POST` | `https://overpass-api.de/api/interpreter` | User-Agent header |
| OSM toilet search | `POST` | Same Overpass endpoint | User-Agent header |
| Valhalla routing | `GET` | `https://valhalla1.openstreetmap.de/route` | None |
| Places search | `REST` | `https://api.norgeskart.no/ws/stedsnavn.json` | Public |
| Statens Vegvesen (cars) | `GET` | `https://www.vegesen.no/ws/ruuteplan/.../routingservice` | 2500/day, UTM33N |