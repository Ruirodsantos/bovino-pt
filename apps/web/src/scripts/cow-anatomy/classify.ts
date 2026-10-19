// Atribui cada triângulo da pele do modelo a um corte, a partir de fronteiras anatómicas (rules.json).
// Determinístico e independente da ordem dos vértices (funciona com a geometria descodificada de Draco).
export type Rule = {
  id: string; part?: string; neutral?: boolean;
  poly?: [number, number][]; zMin?: number; zMax?: number; yMin?: number; yMax?: number;
  xCentre?: number; xHalf?: number; ellipse?: { z: number; x: number; rz: number; rx: number };
  facing?: "lateral" | "medial";
};
export const NONE = 255;

const inPoly = (poly: [number, number][], z: number, y: number) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [zi, yi] = poly[i], [zj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && z < ((zj - zi) * (y - yi)) / (yj - yi) + zi) inside = !inside;
  }
  return inside;
};

export function classifyTriangles(pos: ArrayLike<number>, index: ArrayLike<number> | null, rules: Rule[], xMid: number, smooth = 2) {
  const ids: string[] = []; rules.forEach((r) => { if (!ids.includes(r.id)) ids.push(r.id); });
  const nV = pos.length / 3; const nT = index ? index.length / 3 : nV / 3;
  const tri = (t: number, k: number) => (index ? index[t * 3 + k] : t * 3 + k);
  const labels = new Uint8Array(nT).fill(NONE);
  for (let t = 0; t < nT; t++) {
    const a = tri(t, 0) * 3, b = tri(t, 1) * 3, c = tri(t, 2) * 3;
    const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    // normal da face (x) para distinguir superfícies laterais e mediais
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy; const len = Math.hypot(nx, uz * vx - ux * vz, ux * vy - uy * vx) || 1;
    const outward = ((cx - xMid) * nx) / len; // >0: a face olha para fora do plano médio
    for (let r = 0; r < rules.length; r++) {
      const q = rules[r];
      if (q.zMin !== undefined && cz < q.zMin) continue; if (q.zMax !== undefined && cz > q.zMax) continue;
      if (q.yMin !== undefined && cy < q.yMin) continue; if (q.yMax !== undefined && cy > q.yMax) continue;
      if (q.xHalf !== undefined && Math.abs(cx - (q.xCentre ?? xMid)) > q.xHalf) continue;
      if (q.ellipse) { const e = q.ellipse; if (((cz - e.z) / e.rz) ** 2 + ((cx - e.x) / e.rx) ** 2 > 1) continue; }
      if (q.facing === "medial" && outward > -0.02) continue; if (q.facing === "lateral" && outward < 0.02) continue;
      if (q.poly && !inPoly(q.poly, cz, cy)) continue;
      labels[t] = ids.indexOf(q.id); break;
    }
  }
  if (smooth > 0) smoothLabels(pos, index, labels, smooth);
  return { labels, ids };
}

// Voto maioritário entre triângulos vizinhos (vértices soldados por posição, porque as costuras de UV duplicam vértices).
function smoothLabels(pos: ArrayLike<number>, index: ArrayLike<number> | null, labels: Uint8Array, iterations: number) {
  const nV = pos.length / 3, nT = labels.length; const key = new Map<string, number>(); const weld = new Int32Array(nV);
  for (let i = 0; i < nV; i++) { const k = `${Math.round(pos[i * 3] * 5e3)},${Math.round(pos[i * 3 + 1] * 5e3)},${Math.round(pos[i * 3 + 2] * 5e3)}`; let w = key.get(k); if (w === undefined) { w = key.size; key.set(k, w); } weld[i] = w; }
  const nW = key.size; const start = new Int32Array(nW + 1); const tw = (t: number, k: number) => weld[index ? index[t * 3 + k] : t * 3 + k];
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) start[tw(t, k) + 1]++;
  for (let i = 0; i < nW; i++) start[i + 1] += start[i];
  const fill = start.slice(0, nW), list = new Int32Array(nT * 3);
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) list[fill[tw(t, k)]++] = t;
  let cur = labels; let next = new Uint8Array(nT); const votes = new Int32Array(256);
  for (let it = 0; it < iterations; it++) {
    for (let t = 0; t < nT; t++) {
      const touched: number[] = [];
      for (let k = 0; k < 3; k++) { const w = tw(t, k); for (let p = start[w]; p < start[w + 1]; p++) { const l = cur[list[p]]; if (l === NONE) continue; if (votes[l] === 0) touched.push(l); votes[l]++; } }
      // triângulos sem corte (frestas entre fronteiras) são absorvidos pelos vizinhos; os restantes seguem a maioria
      let best = cur[t], bv = best === NONE ? 0 : votes[best]; for (const l of touched) { if (votes[l] > bv) { best = l; bv = votes[l]; } }
      for (const l of touched) votes[l] = 0;
      next[t] = best;
    }
    const tmp = cur; cur = next; next = tmp;
  }
  if (cur !== labels) labels.set(cur);
}
