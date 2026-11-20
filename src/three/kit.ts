// Shared 3D building blocks. Everything is procedural: no external models or textures.
import * as THREE from 'three';

export const COLORS = {
  bg: 0x070d1c,
  cyan: 0x38d6ff,
  cyanSoft: 0x7fe3ff,
  amber: 0xf2a33a,
  red: 0xff3b2f,
  steel: 0x1b2742,
  white: 0xe8eef7,
} as const;

export type Vec3 = [number, number, number];
export const v3 = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p[0], p[1], p[2]);

/** Deterministic PRNG so every visit renders the same composition. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Disposer {
  track<T extends { dispose: () => void }>(x: T): T;
  dispose(): void;
}
export function disposer(): Disposer {
  const items: Array<{ dispose: () => void }> = [];
  return {
    track(x) { items.push(x); return x; },
    dispose() { items.splice(0).forEach((i) => { try { i.dispose(); } catch { /* already disposed */ } }); },
  };
}

export interface Kit {
  d: Disposer;
  glow: THREE.Texture;
  ring: THREE.Texture;
  dot: THREE.Texture;
  sprite(tex: THREE.Texture, color: number, size: number, opacity?: number): THREE.Sprite;
  basic(color: number, opacity?: number, additive?: boolean): THREE.MeshBasicMaterial;
  line(points: THREE.Vector3[], color: number, opacity?: number): THREE.Line;
  segments(positions: number[], color: number, opacity?: number): THREE.LineSegments;
  edges(geo: THREE.BufferGeometry, color: number, opacity?: number): THREE.LineSegments;
  text(label: string, color?: string): THREE.Sprite;
  icon(kind: IconKind, color?: string): THREE.Sprite;
  stars(count: number, radius: number, seed: number): THREE.Points;
}

export type IconKind = 'lock' | 'wifi' | 'doc' | 'user' | 'chip' | 'shield' | 'camera' | 'eye' | 'key' | 'bolt';

export function makeKit(): Kit {
  const d = disposer();
  const glow = d.track(canvasTexture(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }));
  const ring = d.track(canvasTexture(128, (g, s) => {
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
    g.stroke();
  }));
  const dot = d.track(canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }));

  const sprite: Kit['sprite'] = (tex, color, size, opacity = 1) => {
    const m = d.track(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  };
  const basic: Kit['basic'] = (color, opacity = 1, additive = false) =>
    d.track(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive }));
  const lineMat = (color: number, opacity: number) => d.track(new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  const line: Kit['line'] = (points, color, opacity = 1) => new THREE.Line(d.track(new THREE.BufferGeometry().setFromPoints(points)), lineMat(color, opacity));
  const segments: Kit['segments'] = (positions, color, opacity = 1) => {
    const g = d.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(g, lineMat(color, opacity));
  };
  const edges: Kit['edges'] = (geo, color, opacity = 1) => new THREE.LineSegments(d.track(new THREE.EdgesGeometry(geo, 20)), lineMat(color, opacity));

  const text: Kit['text'] = (label, color = '#7fe3ff') => {
    const t = d.track(canvasTexture(256, (g, s) => {
      g.font = `700 ${s * 0.42}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = color;
      g.shadowBlur = s * 0.08;
      g.fillStyle = color;
      g.fillText(label, s / 2, s / 2);
    }));
    const m = d.track(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    return new THREE.Sprite(m);
  };

  const icon: Kit['icon'] = (kind, color = '#9be9ff') => {
    const t = d.track(canvasTexture(128, (g, s) => drawIcon(g, s, kind, color)));
    const m = d.track(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    return new THREE.Sprite(m);
  };

  const stars: Kit['stars'] = (count, radius, seed) => {
    const r = rng(seed);
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      const rad = radius * (0.6 + r() * 0.4);
      pos.push(rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph) * 0.6, -Math.abs(rad * Math.sin(ph) * Math.sin(th)) - 2);
    }
    const g = d.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = d.track(new THREE.PointsMaterial({ color: 0x6fa8d6, size: 0.05, map: dot, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    return new THREE.Points(g, m);
  };

  return { d, glow, ring, dot, sprite, basic, line, segments, edges, text, icon, stars };
}

function drawIcon(g: CanvasRenderingContext2D, s: number, kind: IconKind, color: string): void {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = s * 0.06;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = s * 0.05;
  const c = s / 2;
  const u = s / 10;
  g.beginPath();
  switch (kind) {
    case 'lock':
      g.strokeRect(c - 2 * u, c - 0.5 * u, 4 * u, 3 * u);
      g.moveTo(c - 1.3 * u, c - 0.5 * u);
      g.arc(c, c - 1.4 * u, 1.3 * u, Math.PI, 0);
      g.lineTo(c + 1.3 * u, c - 0.5 * u);
      break;
    case 'wifi':
      for (const r of [1, 2, 3]) { g.moveTo(c + Math.cos(-2.4) * r * u, c + 1.5 * u + Math.sin(-2.4) * r * u); g.arc(c, c + 1.5 * u, r * u, -2.4, -0.74); }
      break;
    case 'doc':
      g.strokeRect(c - 1.6 * u, c - 2.2 * u, 3.2 * u, 4.4 * u);
      for (const y of [-1, 0, 1]) { g.moveTo(c - 0.9 * u, c + y * u); g.lineTo(c + 0.9 * u, c + y * u); }
      break;
    case 'user':
      g.arc(c, c - 1 * u, 1.1 * u, 0, Math.PI * 2);
      g.moveTo(c - 2 * u, c + 2.2 * u);
      g.quadraticCurveTo(c, c - 0.6 * u, c + 2 * u, c + 2.2 * u);
      break;
    case 'chip':
      g.strokeRect(c - 1.5 * u, c - 1.5 * u, 3 * u, 3 * u);
      for (const k of [-0.8, 0, 0.8]) {
        g.moveTo(c + k * u, c - 1.5 * u); g.lineTo(c + k * u, c - 2.4 * u);
        g.moveTo(c + k * u, c + 1.5 * u); g.lineTo(c + k * u, c + 2.4 * u);
        g.moveTo(c - 1.5 * u, c + k * u); g.lineTo(c - 2.4 * u, c + k * u);
        g.moveTo(c + 1.5 * u, c + k * u); g.lineTo(c + 2.4 * u, c + k * u);
      }
      break;
    case 'shield':
      g.moveTo(c, c - 2.3 * u);
      g.lineTo(c + 1.9 * u, c - 1.5 * u);
      g.quadraticCurveTo(c + 1.8 * u, c + 1.4 * u, c, c + 2.4 * u);
      g.quadraticCurveTo(c - 1.8 * u, c + 1.4 * u, c - 1.9 * u, c - 1.5 * u);
      g.closePath();
      break;
    case 'camera':
      g.strokeRect(c - 2.2 * u, c - 1.2 * u, 4.4 * u, 3 * u);
      g.moveTo(c + 1 * u, c + 0.3 * u);
      g.arc(c, c + 0.3 * u, 1 * u, 0, Math.PI * 2);
      break;
    case 'eye':
      g.moveTo(c - 2.4 * u, c);
      g.quadraticCurveTo(c, c - 2.2 * u, c + 2.4 * u, c);
      g.quadraticCurveTo(c, c + 2.2 * u, c - 2.4 * u, c);
      g.moveTo(c + 0.8 * u, c);
      g.arc(c, c, 0.8 * u, 0, Math.PI * 2);
      break;
    case 'key':
      g.arc(c - 1.2 * u, c, 1 * u, 0, Math.PI * 2);
      g.moveTo(c - 0.2 * u, c); g.lineTo(c + 2.3 * u, c);
      g.moveTo(c + 1.6 * u, c); g.lineTo(c + 1.6 * u, c + 1 * u);
      break;
    case 'bolt':
      g.moveTo(c + 0.5 * u, c - 2.5 * u); g.lineTo(c - 1.2 * u, c + 0.3 * u); g.lineTo(c + 0.2 * u, c + 0.3 * u); g.lineTo(c - 0.5 * u, c + 2.5 * u); g.lineTo(c + 1.2 * u, c - 0.4 * u); g.lineTo(c - 0.2 * u, c - 0.4 * u); g.closePath();
      break;
  }
  g.stroke();
}

/** Classic heater shield outline, optionally with a keyhole cut out. Centred on the origin. */
export function shieldShape(w: number, h: number, keyhole: boolean): THREE.Shape {
  const hw = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0.34 * h);
  s.quadraticCurveTo(-hw * 0.45, 0.42 * h, 0, 0.5 * h);
  s.quadraticCurveTo(hw * 0.45, 0.42 * h, hw, 0.34 * h);
  s.lineTo(hw, 0.02 * h);
  s.quadraticCurveTo(hw * 0.92, -0.3 * h, 0, -0.5 * h);
  s.quadraticCurveTo(-hw * 0.92, -0.3 * h, -hw, 0.02 * h);
  s.lineTo(-hw, 0.34 * h);
  if (keyhole) {
    const r = 0.13 * w;
    const cy = 0.07 * h;
    const k = 0.42;
    const hole = new THREE.Path();
    hole.moveTo(-r * Math.sin(k), cy - r * Math.cos(k));
    hole.lineTo(-0.1 * w, -0.24 * h);
    hole.lineTo(0.1 * w, -0.24 * h);
    hole.lineTo(r * Math.sin(k), cy - r * Math.cos(k));
    hole.absarc(0, cy, r, -Math.PI / 2 + k, (3 * Math.PI) / 2 - k, false);
    s.holes.push(hole);
  }
  return s;
}

/** Points sampled on the outer surface of a union of spheres: a holographic cloud. */
export function cloudPoints(kit: Kit, spheres: Array<[number, number, number, number]>, count: number, color: number, seed: number, size = 0.05): THREE.Points {
  const r = rng(seed);
  const pos: number[] = [];
  let guard = 0;
  while (pos.length / 3 < count && guard++ < count * 20) {
    const [cx, cy, cz, rad] = spheres[Math.floor(r() * spheres.length)];
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    const p = new THREE.Vector3(cx + rad * Math.sin(ph) * Math.cos(th), cy + rad * Math.cos(ph), cz + rad * Math.sin(ph) * Math.sin(th));
    if (p.y < cy - rad * 0.55) continue;
    const inside = spheres.some(([x, y, z, rr]) => (x !== cx || y !== cy || z !== cz) && p.distanceTo(new THREE.Vector3(x, y, z)) < rr * 0.97);
    if (!inside) pos.push(p.x, p.y, p.z);
  }
  const g = kit.d.track(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = kit.d.track(new THREE.PointsMaterial({ color, size, map: kit.dot, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  return new THREE.Points(g, m);
}

/** Particles that stream along a curve. */
export function flow(kit: Kit, curve: THREE.Curve<THREE.Vector3>, count: number, color: number, size: number, speed: number, jitter: number, seed: number): { points: THREE.Points; update: (t: number) => void } {
  const r = rng(seed);
  const offs = Array.from({ length: count }, () => r());
  const jit = Array.from({ length: count * 3 }, () => (r() - 0.5) * 2 * jitter);
  const pos = new Float32Array(count * 3);
  const g = kit.d.track(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = kit.d.track(new THREE.PointsMaterial({ color, size, map: kit.dot, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  const points = new THREE.Points(g, m);
  const tmp = new THREE.Vector3();
  const update = (t: number): void => {
    for (let i = 0; i < count; i++) {
      const u = (offs[i] + t * speed) % 1;
      curve.getPointAt(u, tmp);
      const spread = Math.sin(u * Math.PI);
      pos[i * 3] = tmp.x + jit[i * 3] * spread;
      pos[i * 3 + 1] = tmp.y + jit[i * 3 + 1] * spread;
      pos[i * 3 + 2] = tmp.z + jit[i * 3 + 2] * spread;
    }
    g.attributes.position.needsUpdate = true;
  };
  update(0);
  return { points, update };
}

export const curve = (pts: Vec3[]): THREE.CatmullRomCurve3 => new THREE.CatmullRomCurve3(pts.map(v3), false, 'centripetal');
export const path = (pts: Vec3[]): THREE.CurvePath<THREE.Vector3> => {
  const c = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < pts.length; i++) c.add(new THREE.LineCurve3(v3(pts[i - 1]), v3(pts[i])));
  return c;
};
