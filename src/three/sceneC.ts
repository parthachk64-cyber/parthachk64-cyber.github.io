// Plate C: a padlock on a live circuit board, with two AI clouds drawing evidence up from it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, cloudPoints, path, rng, shieldShape, type Kit, type Vec3 } from './kit';
import type { SceneBuild } from './types';

const Y = 0.04; // trace height above the board

export function buildC(scene: THREE.Scene, kit: Kit): SceneBuild {
  const r = rng(47);
  const T = <T extends { dispose: () => void }>(x: T): T => kit.d.track(x);

  scene.add(new THREE.HemisphereLight(0x8fcfff, 0x050a16, 0.5));
  const key = new THREE.DirectionalLight(0xdff0ff, 1.1);
  key.position.set(3, 8, 6);
  scene.add(key);
  const lockLight = new THREE.PointLight(COLORS.cyan, 18, 7, 1.5);
  lockLight.position.set(0, 1.6, 1.6);
  scene.add(lockLight);
  const warm = new THREE.PointLight(COLORS.amber, 8, 9, 1.6);
  warm.position.set(-2.5, 1.2, 1.5);
  scene.add(warm);

  // Board
  const board = new THREE.Mesh(T(new THREE.PlaneGeometry(18, 11)), T(new THREE.MeshStandardMaterial({ color: 0x0a1630, metalness: 0.55, roughness: 0.5 })));
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  // Procedural Manhattan traces
  const traces: THREE.Vector3[][] = [];
  const seg: number[] = [];
  const vias: number[] = [];
  const viasAmber: number[] = [];
  for (let i = 0; i < 110; i++) {
    const ang = r() * Math.PI * 2;
    let x = Math.cos(ang) * (1.4 + r() * 1.2);
    let z = Math.sin(ang) * (1.0 + r() * 0.9);
    const pts = [new THREE.Vector3(x, Y, z)];
    let horizontal = r() < 0.5;
    const steps = 3 + Math.floor(r() * 4);
    for (let s = 0; s < steps; s++) {
      const len = 0.35 + r() * 1.3;
      if (horizontal) x += Math.sign(x || 1) * len; else z += Math.sign(z || 1) * len * 0.7;
      x = Math.max(-8.5, Math.min(8.5, x));
      z = Math.max(-5, Math.min(5, z));
      pts.push(new THREE.Vector3(x, Y, z));
      horizontal = !horizontal;
    }
    traces.push(pts);
    for (let k = 1; k < pts.length; k++) seg.push(pts[k - 1].x, Y, pts[k - 1].z, pts[k].x, Y, pts[k].z);
    const end = pts[pts.length - 1];
    (r() < 0.3 ? viasAmber : vias).push(end.x, Y + 0.01, end.z);
  }
  scene.add(kit.segments(seg, COLORS.cyan, 0.38));
  const viaPts = (arr: number[], color: number, size: number): THREE.Points => {
    const g = T(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.Points(g, T(new THREE.PointsMaterial({ color, size, map: kit.dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  };
  scene.add(viaPts(vias, COLORS.cyanSoft, 0.16), viaPts(viasAmber, COLORS.amber, 0.2));

  // Dot-matrix banks on either side
  const bank: number[] = [];
  for (const side of [-1, 1]) for (let ix = 0; ix < 14; ix++) for (let iz = 0; iz < 10; iz++) if (r() < 0.7) bank.push(side * (4.6 + ix * 0.22), Y, -2.4 + iz * 0.42);
  scene.add(viaPts(bank, 0x3f8fd6, 0.07));

  // Signals travelling the traces
  const N = 70;
  const sigPos = new Float32Array(N * 3);
  const sigs = Array.from({ length: N }, () => ({ path: Math.floor(r() * traces.length), ph: r(), sp: 0.12 + r() * 0.25 }));
  const sigGeo = T(new THREE.BufferGeometry());
  sigGeo.setAttribute('position', new THREE.BufferAttribute(sigPos, 3));
  const sigCols = new Float32Array(N * 3);
  sigs.forEach((_, i) => { const c = new THREE.Color(i % 4 === 0 ? COLORS.amber : COLORS.cyanSoft); sigCols.set([c.r, c.g, c.b], i * 3); });
  sigGeo.setAttribute('color', new THREE.BufferAttribute(sigCols, 3));
  scene.add(new THREE.Points(sigGeo, T(new THREE.PointsMaterial({ size: 0.2, vertexColors: true, map: kit.dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
  const lens = traces.map((p) => p.slice(1).reduce((a, q, i) => a + q.distanceTo(p[i]), 0));
  const pointOn = (pi: number, u: number, out: THREE.Vector3): void => {
    const p = traces[pi];
    let d = u * lens[pi];
    for (let k = 1; k < p.length; k++) {
      const l = p[k].distanceTo(p[k - 1]);
      if (d <= l) { out.copy(p[k - 1]).lerp(p[k], l ? d / l : 0); return; }
      d -= l;
    }
    out.copy(p[p.length - 1]);
  };

  // Chips
  const chipGeo = T(new THREE.BoxGeometry(1, 0.14, 0.7));
  const chipMat = T(new THREE.MeshStandardMaterial({ color: 0x0b0f1a, metalness: 0.6, roughness: 0.35 }));
  for (const [x, z] of [[-2.6, 1.9], [2.2, -1.9], [-4.2, -1.2], [4.0, 1.7], [-1.6, -2.6]] as Array<[number, number]>) {
    const c = new THREE.Mesh(chipGeo, chipMat);
    c.position.set(x, 0.07, z);
    scene.add(c, kit.edges(chipGeo, COLORS.cyan, 0.35).translateX(x).translateY(0.07).translateZ(z));
    const pins: number[] = [];
    for (let k = -4; k <= 4; k++) pins.push(x + k * 0.1, Y, z - 0.35, x + k * 0.1, Y, z - 0.55, x + k * 0.1, Y, z + 0.35, x + k * 0.1, Y, z + 0.55);
    scene.add(kit.segments(pins, 0x9fb6cf, 0.55));
  }

  // Shield and padlock
  const shieldGeo = T(new THREE.ExtrudeGeometry(shieldShape(2.3, 2.8, false), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 36 }));
  const shield = new THREE.Mesh(shieldGeo, T(new THREE.MeshStandardMaterial({ color: 0x111a2e, metalness: 0.85, roughness: 0.3 })));
  shield.position.set(0, 1.45, -0.35);
  scene.add(shield);
  const outline = shieldShape(2.3, 2.8, false).getPoints(64).map((p) => new THREE.Vector3(p.x, p.y + 1.45, -0.35 + 0.3));
  scene.add(kit.line([...outline, outline[0]], COLORS.cyanSoft, 1));
  const inner = shieldShape(1.9, 2.35, false).getPoints(64).map((p) => new THREE.Vector3(p.x, p.y + 1.45, -0.35 + 0.31));
  scene.add(kit.line([...inner, inner[0]], COLORS.amber, 0.7));
  const shieldGlow = kit.sprite(kit.glow, COLORS.cyan, 3.2, 0.45);
  shieldGlow.position.set(0, 1.4, -0.1);
  scene.add(shieldGlow);

  const lock = new THREE.Group();
  lock.position.set(0, 1.12, 0.32);
  scene.add(lock);
  const lockMat = T(new THREE.MeshStandardMaterial({ color: 0x2a9fd6, emissive: 0x1aa8e0, emissiveIntensity: 1.25, metalness: 0.45, roughness: 0.25 }));
  const bodyGeo = T(new RoundedBoxGeometry(0.92, 0.76, 0.34, 4, 0.1));
  lock.add(new THREE.Mesh(bodyGeo, lockMat));
  const shackle = new THREE.Mesh(T(new THREE.TorusGeometry(0.29, 0.07, 14, 40, Math.PI)), T(new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: COLORS.cyan, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.2 })));
  shackle.position.y = 0.4;
  lock.add(shackle);
  for (const sx of [-0.29, 0.29]) {
    const leg = new THREE.Mesh(T(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 14)), shackle.material);
    leg.position.set(sx, 0.36, 0);
    lock.add(leg);
  }
  const keyhole = new THREE.Mesh(T(new THREE.CircleGeometry(0.075, 24)), kit.basic(0x02060e));
  keyhole.position.set(0, 0.06, 0.172);
  const slot = new THREE.Mesh(T(new THREE.PlaneGeometry(0.06, 0.18)), kit.basic(0x02060e));
  slot.position.set(0, -0.06, 0.172);
  lock.add(keyhole, slot);
  const lockHalo = kit.sprite(kit.glow, COLORS.cyan, 1.8, 0.5);
  lockHalo.position.z = -0.25;
  lock.add(lockHalo);

  // AI clouds on light beams
  const clouds: Array<{ g: THREE.Group; y: number; ph: number }> = [];
  const beamGeo = T(new THREE.CylinderGeometry(0.05, 0.32, 2.1, 24, 1, true));
  const padGeo = T(new THREE.RingGeometry(0.42, 0.5, 48));
  const cloudAt = (x: number): THREE.Vector3 => {
    const g = new THREE.Group();
    g.position.set(x, 2.35, -0.9);
    g.add(cloudPoints(kit, [[0, 0, 0, 0.5], [-0.5, -0.12, 0, 0.38], [0.5, -0.12, 0, 0.38], [0.2, 0.22, 0.05, 0.36], [-0.22, 0.2, -0.05, 0.32]], 900, 0xbdf2ff, x > 0 ? 71 : 72, 0.04));
    const label = kit.text('AI');
    label.scale.setScalar(0.95);
    label.position.y = -0.04;
    g.add(label, kit.sprite(kit.glow, COLORS.cyan, 2.2, 0.32));
    scene.add(g);
    clouds.push({ g, y: 2.35, ph: x });
    const beam = new THREE.Mesh(beamGeo, kit.basic(COLORS.cyan, 0.12, true));
    beam.position.set(x, 1.1, -0.9);
    scene.add(beam);
    const pad = new THREE.Mesh(padGeo, kit.basic(COLORS.cyan, 0.7, true));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, Y + 0.01, -0.9);
    scene.add(pad);
    return new THREE.Vector3(x, 2.35, -0.9);
  };
  const pC2 = cloudAt(-3.5);
  const pC3 = cloudAt(3.5);

  // Junction chip for data integrity
  const pC4 = new THREE.Vector3(2.75, 0.16, 1.45);
  const jGeo = T(new THREE.BoxGeometry(0.5, 0.12, 0.5));
  const junction = new THREE.Group();
  junction.position.copy(pC4).setY(0.06);
  junction.add(new THREE.Mesh(jGeo, chipMat), kit.edges(jGeo, COLORS.amber, 0.9));
  const jGlow = kit.sprite(kit.glow, COLORS.amber, 0.9, 0.7);
  jGlow.position.y = 0.12;
  junction.add(jGlow);
  scene.add(junction);

  // Fixed circuit routes from the lock
  const L: Vec3 = [0, Y, 0.62];
  const routes = {
    c1: path([[0, Y, 1.7], [0, Y, 0.62], [0, 0.6, 0.5], [0, 1.12, 0.5]]),
    c2: path([L, [-0.9, Y, 0.62], [-0.9, Y, -0.2], [-2.6, Y, -0.2], [-2.6, Y, -0.9], [-3.5, Y, -0.9], [-3.5, 1.8, -0.9], [-3.5, 2.3, -0.9]]),
    c3: path([L, [0.9, Y, 0.62], [0.9, Y, -0.2], [2.6, Y, -0.2], [2.6, Y, -0.9], [3.5, Y, -0.9], [3.5, 1.8, -0.9], [3.5, 2.3, -0.9]]),
    c4: path([L, [1.4, Y, 0.62], [1.4, Y, 1.45], [2.75, Y, 1.45], [2.75, 0.16, 1.45]]),
  };
  // Permanent faint guides along the same routes
  Object.values(routes).forEach((c) => scene.add(kit.line(c.getPoints(24), COLORS.cyan, 0.28)));

  const focusOf: Record<string, THREE.Object3D> = { c1: lock, c2: clouds[0].g, c3: clouds[1].g, c4: junction };
  let focused: string | null = null;
  const tmp = new THREE.Vector3();

  return {
    camera: { pos: [0, 5.1, 7.7], target: [0, 0.75, 0], fov: 38 },
    anchors: { c1: new THREE.Vector3(0, 1.12, 0.5), c2: pC2, c3: pC3, c4: pC4 },
    routes,
    bloom: { strength: 0.78, radius: 0.5, threshold: 0.26 },
    emphasise(pt) { focused = pt; },
    update(t, _dt, motion) {
      sigs.forEach((s, i) => {
        pointOn(s.path, (s.ph + t * s.sp) % 1, tmp);
        sigPos.set([tmp.x, Y + 0.02, tmp.z], i * 3);
      });
      sigGeo.attributes.position.needsUpdate = true;
      clouds.forEach((c) => { c.g.position.y = c.y + Math.sin(t * 0.9 + c.ph) * 0.07; c.g.rotation.y = Math.sin(t * 0.4 + c.ph) * 0.35; });
      lockMat.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.25;
      (shieldGlow.material as THREE.SpriteMaterial).opacity = 0.38 + Math.sin(t * 1.3) * 0.1;
      (jGlow.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(t * 2.6) * 0.25;
      for (const [pt, o] of Object.entries(focusOf)) {
        const want = focused === pt ? 1.12 : 1;
        o.scale.setScalar(o.scale.x + (want - o.scale.x) * (motion ? 0.12 : 1));
      }
    },
  };
}
