/**
 * osm-route.ts — Overpass API fallback for client-side routing.
 *
 * When the local WFS graph doesn't have road coverage near the start or
 * end point, we fetch OpenStreetMap road data via Overpass API and build
 * a temporary graph to route on.
 */
import type { RoutingGraph, RoutePath } from './graph-utils';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_FALLBACK_URL = 'https://lz4.overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT = 20_000; // ms
const OSM_SEARCH_KM = 15; // km radius to find nearest OSM node
const MIN_OSM_NODES = 5; // minimum nodes for a usable graph

/**
 * Fetch OSM roads within a bounding box and build a routing graph.
 * The bbox is computed from the straight-line start→end path plus margin.
 */
export async function fetchOSMGraph(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): Promise<RoutingGraph | null> {
  const margin = 0.08; // ~8km padding
  const minLat = Math.min(fromLat, toLat) - margin;
  const maxLat = Math.max(fromLat, toLat) + margin;
  const minLon = Math.min(fromLon, toLon) - margin;
  const maxLon = Math.max(fromLon, toLon) + margin;
  const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;

  const query = `[out:json][timeout:15];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|path|footway|cycleway)$"](${bbox});
);
(._;>;);
out body;`;

  try {
    for (const url of [OVERPASS_URL, OVERPASS_FALLBACK_URL]) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT);

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TilgjengelighetApp/1.0 (route-planner)',
          },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!resp.ok) continue;

        const data: OverpassResponse = await resp.json();
        const graph = buildGraphFromOverpass(data, fromLat, fromLon, toLat, toLon);
        if (graph) return graph;
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

/**
 * Parse Overpass JSON into a RoutingGraph structure.
 * Nodes: all OSM nodes referenced by ways (deduplicated via nodeId→index mapping).
 * Edges: each consecutive pair of nodes in a way becomes an undirected edge.
 */
function buildGraphFromOverpass(
  data: OverpassResponse,
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): RoutingGraph | null {
  // Separate nodes and ways
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const wayRefs = new Set<number>();

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
    if (el.type === 'way' && el.nodes) {
      for (const nid of el.nodes) wayRefs.add(nid);
    }
  }

  // Only keep nodes referenced by ways
  const coords: { lat: number; lon: number }[] = [];
  const osmIdToIndex = new Map<number, number>();
  for (const id of wayRefs) {
    const c = nodeMap.get(id);
    if (c) {
      osmIdToIndex.set(id, coords.length);
      coords.push(c);
    }
  }

  if (coords.length < MIN_OSM_NODES) return null;

  // Build adjacency edges from ways
  const edges: number[][] = new Array(coords.length);
  for (let i = 0; i < coords.length; i++) edges[i] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const n = el.nodes;
    for (let i = 1; i < n.length; i++) {
      const u = osmIdToIndex.get(n[i - 1]);
      const v = osmIdToIndex.get(n[i]);
      if (u === undefined || v === undefined) continue;

      const d = haversine(coords[u].lat, coords[u].lon, coords[v].lat, coords[v].lon);
      if (d < 1 || d > 2000) continue; // filter noise & too-long jumps

      // Undirected edges
      edges[u].push(v, Math.round(d));
      edges[v].push(u, Math.round(d));
    }
  }

  return {
    nodes: coords.map((c) => ({ lat: c.lat, lon: c.lon })),
    edges: edges.map((flat) => {
      const result: { to: number; distance: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        result.push({ to: flat[i], distance: flat[i + 1] });
      }
      return result;
    }),
  };
}

/** Haversine distance in meters */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find nearest node index in an OSM-derived graph.
 */
export function findNearestNodeOSM(
  graph: RoutingGraph,
  lat: number,
  lon: number,
  maxKm = OSM_SEARCH_KM,
): number {
  const maxM = maxKm * 1000;
  let best = -1;
  let bestD = maxM;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversine(lat, lon, graph.nodes[i].lat, graph.nodes[i].lon);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Run Dijkstra on the OSM graph (same algorithm as the main graph-utils).
 */
export function routeOnOSM(
  graph: RoutingGraph,
  startIdx: number,
  endIdx: number,
): RoutePath | null {
  if (startIdx < 0 || endIdx < 0) return null;
  if (startIdx === endIdx) return null;

  const n = graph.edges.length;
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  const visited = new Uint8Array(n);
  dist.fill(Infinity);
  prev.fill(-1);
  dist[startIdx] = 0;

  // Binary heap
  const heap: [number, number][] = [[0, startIdx]];
  const heapPush = (d: number, node: number) => {
    let i = heap.length;
    heap.push([d, node]);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const heapPop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const nn = heap.length;
      while (true) {
        let smallest = i;
        const left = (i << 1) + 1;
        const right = left + 1;
        if (left < nn && heap[left][0] < heap[smallest][0]) smallest = left;
        if (right < nn && heap[right][0] < heap[smallest][0]) smallest = right;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top;
  };

  while (heap.length > 0) {
    const item = heapPop();
    if (!item) break;
    const d = item[0];
    const u = item[1];
    if (visited[u]) continue;
    visited[u] = 1;
    if (u === endIdx) break;

    const uEdges = graph.edges[u];
    for (let ei = 0; ei < uEdges.length; ei++) {
      const { to: v, distance: w } = uEdges[ei];
      if (visited[v]) continue;
      const nd = d + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        heapPush(nd, v);
      }
    }
  }

  if (dist[endIdx] === Infinity) return null;

  // Reconstruct path
  const pathIdx: number[] = [];
  let cur = endIdx;
  while (cur !== -1) {
    pathIdx.push(cur);
    cur = prev[cur];
  }
  pathIdx.reverse();

  const coordinates: [number, number][] = pathIdx.map(
    (i) => [graph.nodes[i].lon, graph.nodes[i].lat] as [number, number],
  );

  // Physical distance
  let physDist = 0;
  for (let i = 1; i < coordinates.length; i++) {
    physDist += haversine(
      coordinates[i - 1][1], coordinates[i - 1][0],
      coordinates[i][1], coordinates[i][0],
    );
  }

  return {
    coordinates,
    distance: dist[endIdx],
    duration: physDist / 1.3,
  };
}
