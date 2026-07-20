# Expo Mobile Plan — Completed

This document describes the architecture migration from a Vite+OpenLayers web app to a unified web+mobile project with Expo.

## What was built

### Phase 1: Bootstrap Expo ✅

```bash
cd mobile
npx expo start
```

- Uses `@maplibre/maplibre-react-native` (no Google Maps API key)
- Expo Router for file-based navigation
- Dark theme shared between web and mobile

### Phase 2: Native map screen ✅

- MapLibre GL Native replaces OpenLayers
- WMS raster overlay via `RasterSource`
- GetFeatureInfo via tap → modal popup
- Search via Kartverket's stedsnavntjeneste
- Layer toggling via GetCapabilities XML parse

### Phase 3: Shared core module ✅

Shared TypeScript utilities extracted to `mobile/src/utils/`:

| Module | Purpose |
|---|---|
| `map-api.ts` | WMS queries, routing orchestrator, search |
| `osm-route.ts` | Overpass API graph fetch + Dijkstra routing |
| `valhalla-route.ts` | Free global Valhalla routing (public instance) |
| `graph-utils.ts` | Local WFS graph loading + Dijkstra |
| `toilet-search.ts` | Overpass search for nearest `amenity=toilets` |

### Phase 4: Delivery and deployment ✅

- Web: GitHub pages from root (`deploy.yml`)
- Mobile: GitHub Release builds on push to main (`release.yml`)
- Optional EAS: Cloud builds with `EXPO_TOKEN` (`mobile-eas.yml`)
- CI: lint + type-check + E2E on every PR

---

## Architecture decisions

### Why MapLibre instead of Google Maps?

- **No API key required** — MapLibre is free and open source
- WMS overlay works natively via `RasterSource`
- Same coordinate system and projection support as OpenLayers
- Norwegian WMS data → no Google dependency

### Why 3 routing fallbacks instead of 1?

| Engine | Strength | Weakness |
|---|---|---|
| WFS Dijkstra | Has accessibility scores | Fragmentering i skogområderr |
| OSM Overpass | Full Norway coverage | Needs User-Agent, 10-30 sec |
| Valhalla | Global, instant, no auth | No accessibility scores |

The auto-fallback chain ensures the user always gets a route.

### Why Valhalla instead of OSRM/GraphHopper?

- **OSRM** public demo returns driving speed for all profiles (walk = 8.4 m/s)
- **GraphHopper / ORS / FreeRoute** require API keys
- **Valhalla** (FOSSGIS instance) is the only truly free, no-key option with correct walking speed

---

## Files structure

```
mobile/src/
├── app/
│   ├── _layout.tsx          ← Root layout (SafeAreaProvider)
│   ├── index.tsx            ← HomeScreen (main map + all logic)
│   └── modal-test.tsx       ← Dev testing modal
├── components/
│   ├── action-bar.tsx       ← Zoom, GPS, route planner, toilet, settings
│   ├── status-bar.tsx       ← Zoom + layer count display
│   ├── settings-panel.tsx   ← Basemap, layer toggles
│   ├── route-planner-modal.tsx ← From/To search + plan button + results
│   ├── search-modal.tsx     ← Search modal (Kartverket stedsnavn)
│   ├── place-search.tsx     ← Reusable search bar component
│   ├── feature-popup.tsx    ← Tap-on-map feature info popup
│   ├── feature-list-modal.tsx ← Viewport scanning results
│   ├── highscore-modal.tsx  ← Top road accessibility listing
│   ├── toast-overlay.tsx    ← Global toast notification system
│   └── ... (shared UI components)
├── utils/
│   ├── map-api.ts           ← WMS query pipeline + routing orchestrator
│   ├── graph-utils.ts       ← WFS graph: load, Dijkstra, snap
│   ├── osm-route.ts         ← Overpass API: fetch graph + route
│   ├── valhalla-route.ts    ← Valhalla: free global routing
│   └── toilet-search.ts     ← Overpass: nearest toilet search
├── constants/
│   ├── map-config.ts        ← WMS URLs, routing config, coverage
│   └── map-theme.ts         ← Dark palette (ink/amber/steel)
└── hooks/
    └── use-theme.ts         ← Color scheme detection
```

---

## Next steps / ideas

- [ ] Accessibility score aggregation per road (highscore → topliste)
- [ ] "Avoid stairs" route preference
- [ ] Offline caching of WFS graph (avoid re-downloading)
- [ ] iOS signed release builds (requires Apple Developer account)
- [ ] Share route (link + QR code)
- [ ] Voice navigation (TTS turn-by-turn in Norwegian)
- [ ] Multiple accessibility profiles (wheelchair, stroller, vision-impaired)
- [ ] Push notifications for route updates
- [ ] Matrikkeladresse-søk (addresse ↔ koordinat)
- [ ] Turforslag: pre-definerede ruter med tilgjengelighetsinfo

---

**See also:**
- [main README](../README.md) — full project overview
- [MOBILE_BUILD.md](../MOBILE_BUILD.md) — build guide (CIC, EAS, troubleshooting)