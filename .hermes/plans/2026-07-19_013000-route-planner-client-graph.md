# Client-Side Route Planner Implementation Plan

> **Goal:** Replace OSRM/ORS server-based routing with a client-side Dijkstra/A* engine running on a pre-built road graph extracted from OpenStreetMap data. Zero network dependencies during routing.

**Architecture:** OSM extract (Oslo) → Python osmium filter → JSON road graph → bundled in app → pure TypeScript Dijkstra. After routing, WMS `t_vei_r` layer is sampled along the route for wheelchair accessibility coloring.

**No external deps at runtime:** Only `@maplibre/maplibre-react-native` + vanilla TypeScript. Graph is a JSON asset.

---

## Data Preparation (one-time)

### Task 1: Extract walking road graph from OSM

**Objective:** Parse `Oslo.osm.pbf`, extract all ways with `highway=*` suitable for walking, build a graph adjacency list, and export compact JSON.

**Approach:**
1. Parse OSM nodes (lat/lon) and ways (ordered node refs + tags)
2. For each way with `highway=footway|pedestrian|path|steps|living_street|residential|service|tertiary|secondary|primary` (plus any with `foot=yes|designated` or `sidewalk=*`)
3. Split ways into edge segments where two ways share a node (intersections)
4. Build adjacency list: `{nodeId: [{to: nodeId, distance, highwayType}, ...]}`
5. Save as compact JSON: `{n: [[lat,lon],...], e: [[fromIdx,toIdx,dist],...]}` (using indexed arrays, not objects — much smaller)

**Files:**
- Create: `/tmp/build-graph.py`
- Create: `/tmp/oslo-routing-graph.json` (output)

**Verification:** Output graph has nodes and edges count, and can run a test Dijkstra between two known coordinates.

### Task 2: Bundle graph with mobile app

**Objective:** Place the graph JSON in the mobile app as a bundled asset.

**Files:**
- Create: `mobile/src/assets/oslo-routing-graph.json` (copy from /tmp)

**Verification:** File exists and < 5MB.

---

## App Implementation

### Task 3: Create graph-utils.ts — in-memory graph + Dijkstra

**Objective:** Pure TypeScript module that loads the graph JSON, implements adjacency list lookup, and runs Dijkstra/A*.

**Interface:**
```typescript
interface GraphNode { lat: number; lon: number; }
interface GraphEdge { to: number; distance: number; }
interface RoutingGraph { nodes: GraphNode[]; edges: GraphEdge[][]; }

function loadRouteGraph(data: any): RoutingGraph;
function findNearestNode(graph: RoutingGraph, lat: number, lon: number, maxKm?: number): number | null;
function computeRoute(graph: RoutingGraph, fromLat: number, fromLon: number, toLat: number, toLon: number): { path: number[][]; distance: number; duration: number } | null;
```

**Files:**
- Create: `mobile/src/utils/graph-utils.ts`

**Verification:** `npx tsc --noEmit` passes (only pre-existing CSS errors).

### Task 4: Update fetchRoute() to use local graph

**Objective:** Replace `fetchRoute()` in `map-api.ts` to use the local graph instead of OSRM. Also modify to accept coordinates, not API key. Keep WMS accessibility sampling.

**Changes:**
- Modify: `mobile/src/utils/map-api.ts` — change `fetchRoute()` to load graph and call `computeRoute()`, then sample accessibility along result
- Remove: `OSRM_API_URL` from `map-config.ts` (no longer needed)

**Verification:** TypeScript passes.

### Task 5: Add coverage check and user feedback

**Objective:** Handle out-of-coverage areas (outside Oslo) gracefully.

**Changes:**
- Modify: `mobile/src/components/route-planner-modal.tsx` — show message if either point is outside graph coverage

**Verification:** TypeScript passes.

### Task 6: Final verification

**Checklist:**
- `npx tsc --noEmit` — only pre-existing CSS errors
- `npx expo lint` — 0 warnings
- `npm test` — 5/5 web tests pass
- `npx expo export --platform android` — success

---

## Risks & Tradeoffs

- **Coverage limited to Oslo** — the graph is built from the Oslo OSM extract. Routes outside Oslo won't work initially. Future: download multiple city extracts or national OSM extract (~600MB for Norway).
- **Graph size** — OSM roads for Oslo with 1m precision might be 2-5MB compressed. Acceptable for a bundled asset.
- **Startup load time** — loading and parsing the JSON takes some milliseconds. Acceptable.
- **Intersection detection** — OSM ways at intersections share nodes but sometimes crossings don't connect. Some manual cleanup may be needed.
- **No turn restrictions** — the graph is undirected, suitable for walking. Turn restrictions (one-way streets) matter for driving only.
