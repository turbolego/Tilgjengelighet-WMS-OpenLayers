# Tilgjengelighet-WMS-OpenLayers
Kartlag fra 'Tilgjengelighet WMS' av Statens kartverk med OpenLayers som webapp med fokus på WCAG -standarden.

Kilde til WMS kartlagene: https://data.norge.no/data-services/98c22855-9637-3b91-9299-4138ac00f072

# Geonorge Tilgjengelighet – WMS Kartvisning

An accessible, static web map viewer for the [Geonorge Tilgjengelighet WMS](https://wms.geonorge.no/skwms1/wms.tilgjengelighet3) — Norway's national dataset on universal design and accessibility.

## Live deployment

After following the steps below, your map will be at:
```
https://<your-username>.github.io/geonorge-wms-viewer/
```

---

## Quick start (local development)

```bash
npm install
npm run dev
```
Open http://localhost:5173

## Build for production

```bash
npm run build
# Output is in ./dist/
```

---

## Deploy to GitHub Pages

### Option A – GitHub Actions (recommended, automatic)

1. Push this repo to GitHub (e.g. as `geonorge-wms-viewer`).
2. In the repo **Settings → Pages**, set the source to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs on every push to `main` and deploys to GitHub Pages automatically.

### Option B – Manual deploy

```bash
npm run build
# Copy contents of ./dist/ to the gh-pages branch, or use:
npx gh-pages -d dist
```

### Important: `vite.config.js` base path

If your repo name is not the root of your GitHub Pages domain, set the `base` in `vite.config.js`:

```js
base: '/geonorge-wms-viewer/'   // replace with your repo name
```

---

## Features

- **Dynamic layer list** – fetched live from `GetCapabilities` XML, grouped and sorted alphabetically.
- **WMS GetFeatureInfo** – click or press Enter on the map to query feature details at that point.
- **Basemap switcher** – OpenStreetMap, Kartverket Topografisk, or no basemap.
- **ARIA live region** – feature info is announced to screen readers automatically.
- **Keyboard navigation** – full Tab/Arrow/Enter support; custom zoom buttons; skip links.
- **High-contrast theme** – ink blue + signal amber palette, meeting WCAG AA 4.5:1.
- **Mobile responsive** – collapsible sidebar for small screens.

---

## Accessibility (WCAG 2.1 AA)

| Criterion | How it's met |
|---|---|
| 1.1.1 Non-text Content | Map canvas has `aria-label`; legends have `alt` text |
| 1.3.1 Info & Relationships | Semantic `<fieldset>`, `<legend>`, `<table>` in feature info |
| 1.4.3 Contrast | UI text/icons ≥ 4.5:1 on backgrounds |
| 2.1.1 Keyboard | All controls reachable and operable by keyboard |
| 2.4.1 Bypass Blocks | Skip links to map and layer panel |
| 2.4.7 Focus Visible | 3px amber focus ring on all interactive elements |
| 4.1.2 Name/Role/Value | Checkboxes have `aria-label`; sidebar uses `role="region"` |
| 4.1.3 Status Messages | Feature info uses `aria-live="polite"` |

**Testing checklist:**
- [ ] Axe / Lighthouse accessibility audit
- [ ] Keyboard-only navigation (Tab, arrows, Enter, +/-)
- [ ] Screen reader test with NVDA (Windows) or VoiceOver (macOS)
- [ ] Check at 200% browser zoom

---

## Data

- **WMS**: `https://wms.geonorge.no/skwms1/wms.tilgjengelighet3`
- **Provider**: Kartverket / Statens kartverk
- **License**: Norge digitalt | © Statens kartverk
- **Metadata**: [Geonorge](https://www.geonorge.no/geonetwork/srv/nor/catalog.search#/metadata/b139a2c3-bdc3-4420-9def-4ce1080fcf0c)

---

## Tech stack

| Library | Purpose |
|---|---|
| [OpenLayers 9](https://openlayers.org/) | Map rendering, WMS, projections |
| [Vite 5](https://vitejs.dev/) | Bundler, dev server |
| Vanilla JS / CSS | UI, accessibility |
| GitHub Actions | CI/CD deployment |
