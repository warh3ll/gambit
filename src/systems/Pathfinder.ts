export interface Point {
  x: number;
  y: number;
}

/**
 * Tile-grid pathfinding for the world.
 * A* over tiles (8 directions, no cutting corners past obstacles), then the
 * tile path is smoothed into a few straight segments in world coordinates.
 */
export class Pathfinder {
  private readonly width: number;
  private readonly height: number;
  private readonly tileSize: number;
  private readonly walkableAt: (tx: number, ty: number) => boolean;

  /** Half-size of the box a walker occupies, used for line-of-sight checks. */
  clearance = 4;

  constructor(width: number, height: number, tileSize: number, walkableAt: (tx: number, ty: number) => boolean) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.walkableAt = walkableAt;
  }

  isWalkable(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height && this.walkableAt(tx, ty);
  }

  isWalkableWorld(x: number, y: number): boolean {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }

  tileCenter(tx: number, ty: number): Point {
    return { x: (tx + 0.5) * this.tileSize, y: (ty + 0.5) * this.tileSize };
  }

  /** Closest walkable tile to (tx, ty), searching outwards. Null if none within maxRadius. */
  nearestWalkableTile(tx: number, ty: number, maxRadius = 12): Point | null {
    if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
    let best: Point | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
          if (!this.isWalkable(tx + dx, ty + dy)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { x: tx + dx, y: ty + dy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Nearest walkable world point to `p` (p itself if already walkable). */
  nearestWalkablePoint(p: Point): Point | null {
    if (this.isWalkableWorld(p.x, p.y)) return { x: p.x, y: p.y };
    const t = this.nearestWalkableTile(Math.floor(p.x / this.tileSize), Math.floor(p.y / this.tileSize));
    return t ? this.tileCenter(t.x, t.y) : null;
  }

  /**
   * World-space path from `from` to `to` (excluding the start point).
   * If `to` is blocked, heads for the nearest walkable spot instead.
   * Returns null if there is no route.
   */
  findPath(from: Point, to: Point): Point[] | null {
    const goal = this.nearestWalkablePoint(to);
    if (!goal) return null;
    const ts = this.tileSize;
    const start = this.nearestWalkableTile(Math.floor(from.x / ts), Math.floor(from.y / ts));
    if (!start) return null;

    if (this.lineOfSight(from, goal)) return [goal];

    const tiles = this.findTilePath(start.x, start.y, Math.floor(goal.x / ts), Math.floor(goal.y / ts));
    if (!tiles) return null;

    const points = tiles.map((t) => this.tileCenter(t.x, t.y));
    points[0] = { x: from.x, y: from.y };
    points[points.length - 1] = goal;
    return this.smooth(points).slice(1);
  }

  /** True if a walker can move in a straight line from a to b. */
  lineOfSight(a: Point, b: Point): boolean {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 4));
    const c = this.clearance;
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      if (
        !this.isWalkableWorld(x - c, y - c) ||
        !this.isWalkableWorld(x + c, y - c) ||
        !this.isWalkableWorld(x - c, y + c) ||
        !this.isWalkableWorld(x + c, y + c)
      ) {
        return false;
      }
    }
    return true;
  }

  /** A* over the tile grid. Returns tiles from start to goal inclusive, or null. */
  findTilePath(sx: number, sy: number, gx: number, gy: number): Point[] | null {
    if (!this.isWalkable(sx, sy) || !this.isWalkable(gx, gy)) return null;
    const W = this.width;
    const N = W * this.height;
    const gScore = new Float64Array(N).fill(Infinity);
    const cameFrom = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();

    const h = (x: number, y: number) => {
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); // octile distance
    };

    const startIdx = sy * W + sx;
    const goalIdx = gy * W + gx;
    gScore[startIdx] = 0;
    heap.push(startIdx, h(sx, sy));

    while (heap.size > 0) {
      const idx = heap.pop();
      if (idx === goalIdx) return this.reconstruct(cameFrom, idx);
      if (closed[idx]) continue;
      closed[idx] = 1;
      const x = idx % W;
      const y = (idx - x) / W;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!this.isWalkable(nx, ny)) continue;
          // No squeezing diagonally between two blocked tiles / around corners.
          if (dx !== 0 && dy !== 0 && (!this.isWalkable(x + dx, y) || !this.isWalkable(x, y + dy))) continue;
          const nIdx = ny * W + nx;
          if (closed[nIdx]) continue;
          const g = gScore[idx] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
          if (g < gScore[nIdx]) {
            gScore[nIdx] = g;
            cameFrom[nIdx] = idx;
            heap.push(nIdx, g + h(nx, ny));
          }
        }
      }
    }
    return null;
  }

  private reconstruct(cameFrom: Int32Array, idx: number): Point[] {
    const W = this.width;
    const out: Point[] = [];
    for (let i = idx; i !== -1; i = cameFrom[i]) out.push({ x: i % W, y: Math.floor(i / W) });
    return out.reverse();
  }

  /** String-pulling: drop waypoints that can be skipped with a straight line. */
  private smooth(points: Point[]): Point[] {
    if (points.length <= 2) return points;
    const out = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !this.lineOfSight(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out;
  }
}

/** Minimal binary min-heap of (id, priority). */
class MinHeap {
  private ids: number[] = [];
  private pri: number[] = [];

  get size() {
    return this.ids.length;
  }

  push(id: number, p: number) {
    this.ids.push(id);
    this.pri.push(p);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pri[parent] <= this.pri[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastP = this.pri.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.pri[0] = lastP;
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.pri[l] < this.pri[m]) m = l;
        if (r < n && this.pri[r] < this.pri[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.pri[a], this.pri[b]] = [this.pri[b], this.pri[a]];
  }
}
