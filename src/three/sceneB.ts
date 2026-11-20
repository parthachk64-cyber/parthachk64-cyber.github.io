// Plate B: a robotic fingertip touching a lattice shield inside an orbit of network nodes.
import * as THREE from 'three';
import { COLORS, cloudPoints, curve, rng, shieldShape, type IconKind, type Kit, type Vec3 } from './kit';
import type { SceneBuild } from './types';

const CENTER = new THREE.Vector3(0.65, 0.3, 0);
const RING_R = 3.15;

function inside(poly: THREE.Vector2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function buildB(scene: THREE.Scene, kit: Kit): SceneBuild {
  const r = rng(23);
  const T = <T extends { dispose: () => void }>(x: T): T => kit.d.track(x);

  scene.add(new THREE.HemisphereLight(0x7fc4ff, 0x050a16, 0.5));
  const key = new THREE.DirectionalLight(0xe2f1ff, 0.95);
  key.position.set(-5, 4, 7);
  scene.add(key);
  const rim = new THREE.PointLight(COLORS.cyan, 10, 12, 1.4);
  rim.position.set(2.4, 1.5, 2.6);
  scene.add(rim);
  scene.add(kit.stars(420, 28, 9));
  const backGlow = kit.sprite(kit.glow, 0x1e7dff, 9, 0.12);
  backGlow.position.set(0.8, 0.3, -3.5);
  scene.add(backGlow);

  // Shield with keyhole
  const W = 2.6, H = 3.2, DEPTH = 0.28;
  const shape = shieldShape(W, H, true);
  const shield = new THREE.Group();
  shield.position.copy(CENTER);
  scene.add(shield);
  const geo = T(new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 36 }));
  geo.translate(0, 0, -DEPTH / 2);
  const body = new THREE.Mesh(geo, T(new THREE.MeshPhysicalMaterial({ color: 0x1a6aa0, emissive: 0x0b5a92, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.22, transparent: true, opacity: 0.62, clearcoat: 1 })));
  shield.add(body);
  const outline = shape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, DEPTH / 2 + 0.06));
  shield.add(kit.line([...outline, outline[0]], COLORS.cyanSoft, 1));
  const holePts = shape.holes[0].getPoints(32).map((p) => new THREE.Vector3(p.x, p.y, DEPTH / 2 + 0.06));
  shield.add(kit.line([...holePts, holePts[0]], COLORS.cyanSoft, 1));
  const keyGlow = kit.sprite(kit.glow, COLORS.cyan, 1.6, 0.7);
  keyGlow.position.set(0, 0, -0.3);
  shield.add(keyGlow);

  // Lattice skin on the shield face
  const poly = shape.getPoints(64);
  const hole = shape.holes[0].getPoints(32);
  const nodes: THREE.Vector3[] = [];
  let guard = 0;
  while (nodes.length < 120 && guard++ < 5000) {
    const x = (r() - 0.5) * W * 0.98;
    const y = (r() - 0.5) * H * 0.98;
    if (inside(poly, x, y) && !inside(hole, x, y)) nodes.push(new THREE.Vector3(x, y, DEPTH / 2 + 0.065));
  }
  const seg: number[] = [];
  nodes.forEach((a, i) => {
    let links = 0;
    for (let j = i + 1; j < nodes.length && links < 3; j++) {
      if (a.distanceTo(nodes[j]) < 0.48) { seg.push(a.x, a.y, a.z, nodes[j].x, nodes[j].y, nodes[j].z); links++; }
    }
  });
  shield.add(kit.segments(seg, COLORS.cyanSoft, 0.55));
  const nodeGeo = T(new THREE.BufferGeometry().setFromPoints(nodes));
  const nodePts = new THREE.Points(nodeGeo, T(new THREE.PointsMaterial({ color: 0xbff3ff, size: 0.075, map: kit.dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  shield.add(nodePts);

  // Orbit ring of nodes
  const frame = new THREE.Object3D();
  frame.position.copy(CENTER);
  frame.rotation.set(0.42, -0.38, 0.05);
  scene.add(frame);
  frame.updateMatrixWorld(true);
  const ringMesh = new THREE.Mesh(T(new THREE.TorusGeometry(RING_R, 0.012, 8, 220)), kit.basic(COLORS.cyan, 0.55, true));
  frame.add(ringMesh);
  const at = (theta: number): THREE.Vector3 => frame.localToWorld(new THREE.Vector3(Math.cos(theta) * RING_R, Math.sin(theta) * RING_R, 0));

  const decor: Array<[number, IconKind]> = [[2.2, 'lock'], [2.65, 'shield'], [3.75, 'doc'], [4.25, 'user'], [4.75, 'key'], [0.75, 'camera'], [0.25, 'wifi'], [5.65, 'chip'], [1.75, 'eye']];
  const breathers: Array<{ s: THREE.Sprite; ph: number }> = [];
  const spoke: number[] = [];
  const addBadge = (p: THREE.Vector3, kind: IconKind | null, size = 0.62): void => {
    const ring = kit.sprite(kit.ring, COLORS.cyan, size, 0.95);
    ring.position.copy(p);
    const g = kit.sprite(kit.glow, COLORS.cyan, size * 1.3, 0.2);
    g.position.copy(p);
    scene.add(ring, g);
    breathers.push({ s: g, ph: r() * 6 });
    if (kind) { const ic = kit.icon(kind); ic.scale.setScalar(size * 0.75); ic.position.copy(p); scene.add(ic); }
    const toward = p.clone().lerp(CENTER, 0.55);
    spoke.push(p.x, p.y, p.z, toward.x, toward.y, toward.z);
  };
  decor.forEach(([th, k]) => addBadge(at(th), k));

  // Featured nodes
  const thB2 = -0.42, thB3 = -0.98, thB4 = 1.25;
  const pB2 = at(thB2), pB3 = at(thB3), pB4 = at(thB4);
  addBadge(pB2, null, 0.8);
  addBadge(pB3, null, 0.8);
  addBadge(pB4, null, 0.8);
  scene.add(kit.segments(spoke, COLORS.cyan, 0.16));

  const cloud = cloudPoints(kit, [[0, 0, 0, 0.3], [-0.3, -0.08, 0, 0.22], [0.3, -0.08, 0, 0.22], [0.12, 0.15, 0.05, 0.22]], 420, 0xbdf2ff, 31, 0.04);
  cloud.position.copy(pB2);
  scene.add(cloud);

  const cluster = new THREE.Group();
  cluster.position.copy(pB3);
  const cubeGeo = T(new THREE.BoxGeometry(0.075, 0.075, 0.075));
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(cubeGeo, kit.basic(i % 5 === 0 ? COLORS.amber : COLORS.cyanSoft, 0.95, true));
    m.position.set((r() - 0.5) * 0.46, (r() - 0.5) * 0.46, (r() - 0.5) * 0.46);
    m.rotation.set(r() * 3, r() * 3, 0);
    cluster.add(m);
  }
  scene.add(cluster);

  const antenna = new THREE.Group();
  antenna.position.copy(pB4);
  const cone = new THREE.Mesh(T(new THREE.ConeGeometry(0.09, 0.32, 16)), T(new THREE.MeshStandardMaterial({ color: 0x9fe9ff, emissive: COLORS.cyan, emissiveIntensity: 1.4 })));
  antenna.add(cone);
  const waves: THREE.Sprite[] = [];
  for (let i = 0; i < 3; i++) { const w = kit.sprite(kit.ring, COLORS.cyan, 0.3, 0); antenna.add(w); waves.push(w); }
  scene.add(antenna);

  // Pulses travelling around the ring
  const ringPulses = Array.from({ length: 7 }, (_, i) => {
    const s = kit.sprite(kit.glow, i % 3 ? COLORS.cyan : COLORS.amber, 0.32, 0.95);
    scene.add(s);
    return { s, th: (i / 7) * Math.PI * 2, sp: 0.18 + r() * 0.12 };
  });

  // Robotic finger touching the shield edge
  const CONTACT = new THREE.Vector3(CENTER.x - W / 2 + 0.02, CENTER.y - 0.2, 0.32);
  const metal = T(new THREE.MeshStandardMaterial({ color: 0xa9b6c8, metalness: 0.7, roughness: 0.38 }));
  const dark = T(new THREE.MeshStandardMaterial({ color: 0x1b2742, metalness: 0.8, roughness: 0.4, emissive: 0x0a2a44, emissiveIntensity: 0.5 }));
  const hand = new THREE.Group();
  scene.add(hand);
  const joints: Vec3[] = [[-5.4, -2.75, 1.35], [-3.25, -1.45, 1.05], [-2.2, -0.86, 0.78], [-1.35, -0.42, 0.56], [CONTACT.x - 0.06, CONTACT.y - 0.03, CONTACT.z + 0.02]];
  const radii = [0.38, 0.21, 0.17, 0.14];
  for (let i = 0; i < joints.length - 1; i++) {
    const a = new THREE.Vector3(...joints[i]);
    const b = new THREE.Vector3(...joints[i + 1]);
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(T(new THREE.CapsuleGeometry(radii[i], Math.max(0.01, len - radii[i] * 1.4), 6, 18)), metal);
    seg.position.copy(a).lerp(b, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    hand.add(seg);
    if (i > 0) {
      const j = new THREE.Mesh(T(new THREE.SphereGeometry(radii[i] * 1.08, 18, 14)), dark);
      j.position.copy(a);
      hand.add(j);
      const led = kit.sprite(kit.glow, COLORS.cyan, 0.22, 0.9);
      led.position.copy(a).add(new THREE.Vector3(0, 0, radii[i] + 0.02));
      hand.add(led);
    }
  }
  // Curled lower fingers
  for (const [ox, oy] of [[0.1, -0.42], [0.35, -0.6]] as Array<[number, number]>) {
    const f = new THREE.Mesh(T(new THREE.CapsuleGeometry(0.13, 0.55, 6, 14)), metal);
    f.position.set(-3.0 + ox, -1.55 + oy, 1.1);
    f.rotation.z = 0.35;
    f.rotation.x = 0.9;
    hand.add(f);
  }
  const tipGlow = kit.sprite(kit.glow, COLORS.cyan, 0.9, 0.95);
  tipGlow.position.copy(CONTACT);
  scene.add(tipGlow);
  const ripples = Array.from({ length: 3 }, () => { const s = kit.sprite(kit.ring, COLORS.cyan, 0.2, 0); s.position.copy(CONTACT); scene.add(s); return s; });

  // Routes: from the fingertip onto the ring, then around it to the chosen node
  const arc = (th0: number, th1: number, n = 14): Vec3[] =>
    Array.from({ length: n }, (_, i) => at(th0 + ((th1 - th0) * i) / (n - 1)).toArray() as Vec3);
  const C: Vec3 = CONTACT.toArray() as Vec3;
  const routes = {
    b2: curve([C, ...arc(Math.PI + 0.75, 2 * Math.PI + thB2 - 0.02)]),
    b3: curve([C, ...arc(Math.PI + 0.75, 2 * Math.PI + thB3 - 0.02, 10)]),
    b4: curve([C, ...arc(Math.PI - 0.55, thB4 + 0.02, 10)]),
  };

  const focusOf: Record<string, THREE.Object3D> = { b1: shield, b2: cloud, b3: cluster, b4: antenna };
  let focused: string | null = null;

  return {
    camera: { pos: [0.2, 0.4, 10.9], target: [0.25, 0.2, 0], fov: 40 },
    anchors: { b1: CONTACT.clone(), b2: pB2, b3: pB3, b4: pB4 },
    routes,
    bloom: { strength: 0.72, radius: 0.5, threshold: 0.3 },
    emphasise(pt) { focused = pt; },
    update(t, _dt, motion) {
      shield.rotation.y = Math.sin(t * 0.45) * 0.1;
      shield.rotation.x = Math.sin(t * 0.3) * 0.035;
      (keyGlow.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(t * 1.8) * 0.2;
      cloud.rotation.y = t * 0.4;
      cluster.rotation.set(t * 0.5, t * 0.7, 0);
      waves.forEach((w, i) => {
        const k = (t * 0.6 + i / 3) % 1;
        w.scale.setScalar(0.25 + k * 0.9);
        (w.material as THREE.SpriteMaterial).opacity = motion ? (1 - k) * 0.9 : 0;
      });
      ringPulses.forEach((p) => p.s.position.copy(at(p.th + t * p.sp)));
      breathers.forEach((b) => { (b.s.material as THREE.SpriteMaterial).opacity = 0.16 + Math.sin(t * 1.5 + b.ph) * 0.08; });
      ripples.forEach((s, i) => {
        const k = (t * 0.5 + i / 3) % 1;
        s.scale.setScalar(0.2 + k * 1.4);
        (s.material as THREE.SpriteMaterial).opacity = motion ? (1 - k) * 0.85 : 0;
      });
      (tipGlow.material as THREE.SpriteMaterial).opacity = 0.75 + Math.sin(t * 3) * 0.2;
      for (const [pt, o] of Object.entries(focusOf)) {
        const want = focused === pt ? (pt === 'b1' ? 1.03 : 1.25) : 1;
        o.scale.setScalar(o.scale.x + (want - o.scale.x) * (motion ? 0.12 : 1));
      }
    },
  };
}
