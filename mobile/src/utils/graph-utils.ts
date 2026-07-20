/**
 * graph-utils.ts — Client-side routing graph engine.
 *
 * Loads a pre-built road graph from a compact JSON bundle and runs
 * Dijkstra's shortest-path algorithm in pure TypeScript (zero deps).
 *
 * Graph format (compact integers):
 *   { la: number[],  // lat × 10000
 *     lo: number[],  // lon × 10000
 *     e: number[] }  // flat [from, to, dist_m, from, to, dist_m, ...]
 *
 * The graph is loaded as a runtime asset (not inlined in the JS bundle)
 * to keep the bundle size manageable (~14MB raw, 4.8MB gzipped).
 */

import { Asset } from 'expo-asset';

interface RawGraph {
  la: number[];
  lo: number[];
  e: number[];
}

export interface GraphNode {
  lat: number;
  lon: number;
}

export interface GraphEdge {
  to: number;
  distance: number;
}

export interface RoutingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[][];
  /** OSM highway tag lookup: "u,v" sorted key → highway tag (e.g. "residential"). Only set for OSM graphs. */
  highwayTagLookup?: Record<string, string>;
}

let _graph: RoutingGraph | null = null;
let _loadPromise: Promise<RoutingGraph | null> | null = null;

/** Haversine distance in meters */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Load and parse the routing graph from the bundled JSON asset.
 * Returns null if the graph JSON is malformed.
 * Can be called multiple times — subsequent calls return the cached graph.
 */
export async function loadRouteGraph(): Promise<RoutingGraph | null> {
  if (_graph) return _graph;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      // Load as a runtime asset (prevents Metro from inlining into JS bundle)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const [asset] = await Asset.loadAsync(require('../../assets/norge-routing-graph.dat'));
      if (!asset.localUri) throw new Error('Asset has no local URI');
      const response = await fetch(asset.localUri);
      const d: RawGraph = await response.json();

      if (!d.la || !d.lo || !d.e) {
        console.warn('Invalid graph data — missing expected keys');
        return null;
      }

      const nodeCount = d.la.length;
      const nodes: GraphNode[] = new Array(nodeCount);
      const edges: GraphEdge[][] = new Array(nodeCount);

      for (let i = 0; i < nodeCount; i++) {
        nodes[i] = { lat: d.la[i] / 10000, lon: d.lo[i] / 10000 };
        edges[i] = [];
      }

      for (let i = 0; i < d.e.length; i += 3) {
        const from = d.e[i];
        const to = d.e[i + 1];
        const dist = d.e[i + 2];
        if (from >= 0 && from < nodeCount && to >= 0 && to < nodeCount) {
          edges[from].push({ to, distance: dist });
        }
      }

      _graph = { nodes, edges };
      return _graph;
    } catch (err) {
      console.warn('Failed to load routing graph', err);
      return null;
    }
  })();

  return _loadPromise;
}

/**
 * Find the graph node index nearest to given coordinates.
 * Returns -1 if no node found within maxKm.
 */
export function findNearestNode(
  graph: RoutingGraph,
  lat: number,
  lon: number,
  maxKm = 20,
): number {
  const maxMeters = maxKm * 1000;
  let bestIdx = -1;
  let bestDist = maxMeters;

  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversine(lat, lon, graph.nodes[i].lat, graph.nodes[i].lon);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export interface RoutePath {
  /** Path coordinates as [lng, lat][] pairs (GeoJSON-friendly) */
  coordinates: [number, number][];
  /**
   * Route cost — weighted distance (physical meters × accessibility factor 1.0–2.0).
   * For the true physical distance in meters, recompute via haversine along coordinates.
   */
  distance: number;
  /** Estimated walking duration in seconds (at 1.3 m/s) based on physical distance */
  duration: number;
  /**
   * OSM highway tag for each segment between consecutive coordinates.
   * Only set when the route was built from OSM data (Overpass API).
   * Used as accessibility fallback when WMS t_vei_r has no local data.
   * length = coordinates.length - 1
   */
  highwayTags?: string[];
}

/**
 * Compute shortest walking route between two points using the graph.
 * Returns null if either point is outside the graph or no path exists.
 */
export async function computeRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): Promise<RoutePath | null> {
  const graph = await loadRouteGraph();
  if (!graph) return null;

  const start = findNearestNode(graph, fromLat, fromLon);
  const end = findNearestNode(graph, toLat, toLon);
  if (start === -1 || end === -1) return null;

  // If start and end are the same node, return direct line
  if (start === end) {
    const d = haversine(fromLat, fromLon, toLat, toLon);
    return {
      coordinates: [
        [fromLon, fromLat],
        [toLon, toLat],
      ],
      distance: d,
      duration: d / 1.3,
    };
  }

  // Dijkstra
  const n = graph.edges.length;
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  const visited = new Uint8Array(n);

  dist.fill(Infinity);
  prev.fill(-1);
  dist[start] = 0;

  // Binary heap priority queue
  const heap: [number, number][] = [[0, start]];

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

    if (u === end) break;

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

  if (dist[end] === Infinity) return null;

  // Reconstruct path
  const pathIdx: number[] = [];
  let cur = end;
  while (cur !== -1) {
    pathIdx.push(cur);
    cur = prev[cur];
  }
  pathIdx.reverse();

  // Convert to GeoJSON-friendly coordinates
  const coordinates: [number, number][] = [];
  for (let i = 0; i < pathIdx.length; i++) {
    const node = graph.nodes[pathIdx[i]];
    coordinates.push([node.lon, node.lat] as [number, number]);
  }

  // Compute true physical distance along the path (haversine)
  let physDist = 0;
  for (let i = 1; i < coordinates.length; i++) {
    physDist += haversine(coordinates[i-1][1], coordinates[i-1][0], coordinates[i][1], coordinates[i][0]);
  }

  return {
    coordinates,
    distance: dist[end],
    duration: physDist / 1.3,
  };
}

