// Plate A: an AI agent breaking out of a glass sandbox and streaming data to infrastructure.
import * as THREE from 'three';
import { COLORS, curve, flow, rng, shieldShape, v3, type Kit, type Vec3 } from './kit';
import type { SceneBuild } from './types';

const FLOOR = -1.25;

export function buildA(scene: THREE.Scene, kit: Kit): SceneBuild {
  const r = rng(11);
  const T = <T extends { dispose: () => void }>(x: T): T => kit.d.track(x);

  // Lights and stage
  scene.add(new THREE.HemisphereLight(0x6fb6ff, 0x070d1c, 0.45));
  const key = new THREE.DirectionalLight(0xcfeaff, 1.2);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const streamLight = new THREE.PointLight(COLORS.cyan, 9, 9, 1.6);
  streamLight.position.set(1.2, 1.2, 1.6);
  scene.add(streamLight);
  const sandLight = new THREE.PointLight(COLORS.amber, 6, 6, 1.8);
  sandLight.position.set(-3.2, 0.4, 2.2);
  scene.add(sandLight);

  const floor = new THREE.Mesh(T(new THREE.PlaneGeometry(60, 60)), T(new THREE.MeshStandardMaterial({ color: 0x081022, metalness: 0.35, roughness: 0.72 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  scene.add(floor);
  const grid = new THREE.GridHelper(26, 26, COLORS.cyan, COLORS.cyan);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.055;
  T(grid.geometry); T(grid.material as THREE.Material);
  grid.position.y = FLOOR + 0.005;
  scene.add(grid);
  scene.add(kit.stars(500, 34, 3));

  // Distant light columns for depth
  for (let i = 0; i < 9; i++) {
    const col = new THREE.Mesh(T(new THREE.PlaneGeometry(0.08 + r() * 0.12, 9)), kit.basic(i % 3 ? 0x1f6fa8 : 0x2b4cff, 0.025 + r() * 0.03, true));
    col.position.set(-9 + i * 2.3 + r(), 2.4, -9 - r() * 3);
    scene.add(col);
  }

  // Glass sandbox
  const box = new THREE.Group();
  box.position.set(-3.4, FLOOR + 1.25, 0);
  scene.add(box);
  const boxGeo = T(new THREE.BoxGeometry(3, 2.5, 2.4));
  const glass = new THREE.Mesh(boxGeo, T(new THREE.MeshPhysicalMaterial({ color: 0x9be3ff, transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false })));
  box.add(glass, kit.edges(boxGeo, COLORS.cyanSoft, 0.95));

  // Sand dunes inside the box
  const dune = (x: number, z: number): number => -0.55 + 0.22 * Math.sin(x * 1.7 + z * 0.9) + 0.14 * Math.cos(z * 2.3 - x) + 0.38 * Math.max(0, (x + 2.6) / 1.1);
  const sandPos: number[] = [];
  const sandCol: number[] = [];
  const c1 = new THREE.Color(0xe0b06a);
  const c2 = new THREE.Color(0x9c6b35);
  const tmpC = new THREE.Color();
  for (let i = 0; i < 6500; i++) {
    const x = -4.85 + r() * 2.9;
    const z = -1.15 + r() * 2.3;
    const top = Math.min(FLOOR + 2.3, dune(x, z));
    const y = top - Math.pow(r(), 3) * (top - FLOOR - 0.02);
    sandPos.push(x, y, z);
    tmpC.copy(c1).lerp(c2, r() * 0.8);
    sandCol.push(tmpC.r, tmpC.g, tmpC.b);
  }
  // Pile outside the box where the sand has spilled
  for (let i = 0; i < 1400; i++) {
    const x = -1.9 + Math.pow(r(), 1.6) * 1.7;
    const z = -1 + r() * 2.2;
    const h = Math.max(0, 0.75 - (x + 1.9) * 0.45) * (0.6 + 0.4 * Math.cos(z * 1.4));
    sandPos.push(x, FLOOR + r() * h, z);
    tmpC.copy(c1).lerp(c2, r());
    sandCol.push(tmpC.r, tmpC.g, tmpC.b);
  }
  const sandGeo = T(new THREE.BufferGeometry());
  sandGeo.setAttribute('position', new THREE.Float32BufferAttribute(sandPos, 3));
  sandGeo.setAttribute('color', new THREE.Float32BufferAttribute(sandCol, 3));
  scene.add(new THREE.Points(sandGeo, T(new THREE.PointsMaterial({ size: 0.068, vertexColors: true, map: kit.dot, transparent: true, alphaTest: 0.25, depthWrite: true }))));

  // Spilling sand (simulated)
  const N_SPILL = 650;
  const sp = new Float32Array(N_SPILL * 3);
  const vel = new Float32Array(N_SPILL * 3);
  const spawn = (i: number, scatter: boolean): void => {
    sp[i * 3] = -1.95 + r() * 0.15;
    sp[i * 3 + 1] = FLOOR + 1.7 + r() * 0.75;
    sp[i * 3 + 2] = -1 + r() * 2;
    vel[i * 3] = 0.25 + r() * 0.85;
    vel[i * 3 + 1] = r() * 0.7;
    vel[i * 3 + 2] = (r() - 0.5) * 0.4;
    if (scatter) { const k = r() * 1.2; sp[i * 3] += vel[i * 3] * k; sp[i * 3 + 1] += vel[i * 3 + 1] * k - 1.6 * k * k; }
  };
  for (let i = 0; i < N_SPILL; i++) spawn(i, true);
  const spillGeo = T(new THREE.BufferGeometry());
  spillGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(spillGeo, T(new THREE.PointsMaterial({ color: 0xe8ba74, size: 0.05, map: kit.dot, transparent: true, alphaTest: 0.25 }))));

  // Shield emblem on the glass
  const shieldPts = shieldShape(0.9, 1.1, false).getPoints(40).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const emblem = new THREE.Group();
  emblem.position.set(-3.4, FLOOR + 1.6, 1.215);
  emblem.add(kit.line([...shieldPts, shieldPts[0]], COLORS.cyanSoft, 1));
  const emblemFill = new THREE.Mesh(T(new THREE.ShapeGeometry(shieldShape(0.9, 1.1, false))), kit.basic(COLORS.cyan, 0.18, true));
  emblem.add(emblemFill);
  const emblemCore = kit.sprite(kit.glow, COLORS.cyan, 0.55, 0.9);
  emblem.add(emblemCore);
  scene.add(emblem);

  // The agent: a wireframe core leaving the sandbox
  const agent = new THREE.Group();
  agent.position.set(-0.85, 0.55, 0.7);
  scene.add(agent);
  const core = new THREE.Mesh(T(new THREE.IcosahedronGeometry(0.3, 3)), T(new THREE.MeshStandardMaterial({ color: 0x0c2a44, emissive: COLORS.cyan, emissiveIntensity: 1.05, metalness: 0.3, roughness: 0.3 })));
  const shellGeo = T(new THREE.IcosahedronGeometry(0.62, 1));
  const shell = kit.edges(shellGeo, COLORS.cyanSoft, 0.8);
  const ringA = new THREE.Mesh(T(new THREE.TorusGeometry(0.85, 0.014, 8, 96)), kit.basic(COLORS.cyan, 0.9, true));
  const ringB = new THREE.Mesh(T(new THREE.TorusGeometry(0.98, 0.01, 8, 96)), kit.basic(COLORS.amber, 0.7, true));
  ringA.rotation.x = 1.2;
  ringB.rotation.y = 1.1;
  agent.add(core, shell, ringA, ringB, kit.sprite(kit.glow, COLORS.cyan, 2.2, 0.32));

  // Data stream from the agent to the racks
  const stream = curve([[-0.55, 0.55, 0.7], [0.5, 0.82, 0.62], [1.7, 0.66, 0.38], [2.7, 0.62, 0.15], [3.55, 0.5, 0.05]]);
  const flowA = flow(kit, stream, 520, COLORS.cyan, 0.055, 0.2, 0.16, 5);
  const flowB = flow(kit, stream, 60, COLORS.amber, 0.075, 0.28, 0.07, 6);
  const streamTube = new THREE.Mesh(T(new THREE.TubeGeometry(stream, 80, 0.012, 6, false)), kit.basic(COLORS.cyan, 0.35, true));
  scene.add(flowA.points, flowB.points, streamTube);

  // Server racks with blinking LEDs
  const leds: Array<{ m: THREE.MeshBasicMaterial; base: THREE.Color; ph: number; sp: number }> = [];
  const racks = new THREE.Group();
  racks.position.set(3.8, 0, -0.7);
  scene.add(racks);
  const rackGeo = T(new THREE.BoxGeometry(0.8, 2.9, 1));
  const rackMat = T(new THREE.MeshStandardMaterial({ color: 0x0f1a33, metalness: 0.7, roughness: 0.35 }));
  const ledGeo = T(new THREE.BoxGeometry(0.52, 0.035, 0.02));
  for (const [x, z] of [[3.35, -0.55], [4.25, -0.85]] as Array<[number, number]>) {
    const rack = new THREE.Group();
    rack.position.set(x - 3.8, FLOOR + 1.45, z + 0.7);
    rack.add(new THREE.Mesh(rackGeo, rackMat), kit.edges(rackGeo, COLORS.cyan, 0.35));
    for (let i = 0; i < 16; i++) {
      const base = new THREE.Color(r() < 0.2 ? COLORS.amber : COLORS.cyan);
      const m = kit.basic(base.getHex(), 1, true);
      const led = new THREE.Mesh(ledGeo, m);
      led.position.set(-0.05 + (r() - 0.5) * 0.05, -1.25 + i * 0.165, 0.51);
      led.scale.x = 0.4 + r() * 0.6;
      rack.add(led);
      leds.push({ m, base, ph: r() * 10, sp: 1 + r() * 5 });
    }
    racks.add(rack);
  }

  // Database: stacked discs with glowing rims
  const db = new THREE.Group();
  db.position.set(5.55, 0, 0.3);
  scene.add(db);
  const discGeo = T(new THREE.CylinderGeometry(0.75, 0.75, 0.42, 48));
  const discMat = T(new THREE.MeshStandardMaterial({ color: 0x0e1b36, metalness: 0.75, roughness: 0.28, emissive: 0x0a3a66, emissiveIntensity: 0.6 }));
  const rimGeo = T(new THREE.TorusGeometry(0.75, 0.018, 8, 96));
  for (let i = 0; i < 3; i++) {
    const y = FLOOR + 0.3 + i * 0.55;
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = y;
    db.add(disc);
    for (const dy of [-0.21, 0.21]) {
      const rim = new THREE.Mesh(rimGeo, kit.basic(COLORS.cyan, 0.95, true));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y + dy;
      db.add(rim);
    }
  }
  const dbGlow = kit.sprite(kit.glow, COLORS.cyan, 2.4, 0.35);
  dbGlow.position.set(0, 0, 0);
  db.add(dbGlow);

  // Floating data cards
  const cards: Array<{ g: THREE.Group; y: number; ph: number }> = [];
  const cardGeo = T(new THREE.PlaneGeometry(1.05, 0.64));
  const icons = ['user', 'doc', 'chip', 'eye', 'user', 'doc'] as const;
  const cardSpots: Vec3[] = [[2.5, 2.45, -1.4], [3.95, 2.95, -1.7], [5.4, 2.55, -1.3], [6.45, 1.35, -0.9], [2.3, -0.25, 1.55], [6.35, -0.15, 1.1]];
  cardSpots.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.copy(v3(p));
    g.add(new THREE.Mesh(cardGeo, kit.basic(COLORS.cyan, 0.08, true)), kit.edges(cardGeo, COLORS.cyanSoft, 0.85));
    const ic = kit.icon(icons[i]);
    ic.scale.setScalar(0.36);
    ic.position.set(-0.3, 0, 0.01);
    g.add(ic);
    const bars: number[] = [];
    for (let k = 0; k < 3; k++) bars.push(-0.05, 0.14 - k * 0.12, 0.01, 0.38 - k * 0.08, 0.14 - k * 0.12, 0.01);
    g.add(kit.segments(bars, COLORS.cyanSoft, 0.8));
    g.rotation.y = -0.25 + (p[0] - 4) * -0.05;
    scene.add(g);
    cards.push({ g, y: p[1], ph: i * 1.3 });
    const tether = kit.line([v3(p).add(new THREE.Vector3(0, -0.32, 0)), new THREE.Vector3(p[0], p[1] > 1 ? FLOOR + 2.9 : FLOOR, p[2])], COLORS.cyan, 0.18);
    scene.add(tether);
  });

  // Localised red fault line on the floor
  const crack: THREE.Vector3[] = [];
  let cxk = 2.1;
  for (let i = 0; i < 14; i++) { crack.push(new THREE.Vector3(cxk, FLOOR + 0.01, 1.55 + (i % 2 ? 0.12 : -0.08) + i * 0.05)); cxk += 0.2 + r() * 0.12; }
  scene.add(kit.line(crack, COLORS.red, 0.95));
  const crackGlow = kit.sprite(kit.glow, COLORS.red, 2.2, 0.35);
  crackGlow.position.set(3.4, FLOOR + 0.05, 1.9);
  scene.add(crackGlow);

  // Hotspot anchors and selection routes
  const O: Vec3 = [-0.85, 0.55, 0.7];
  const A1 = new THREE.Vector3(-3.4, FLOOR + 1.6, 1.24);
  const A2 = stream.getPointAt(0.3);
  const A3 = new THREE.Vector3(3.35, FLOOR + 2.95, -0.05);
  const A4 = new THREE.Vector3(5.55, FLOOR + 0.85, 1.08);
  const along = (u0: number, u1: number, n = 10): Vec3[] =>
    Array.from({ length: n }, (_, i) => stream.getPointAt(u0 + ((u1 - u0) * i) / (n - 1)).toArray() as Vec3);
  const routes = {
    a1: curve([O, [-1.7, 1.05, 1.25], [-2.6, 1.0, 1.32], A1.toArray() as Vec3]),
    a2: curve(along(0, 0.3)),
    a3: curve([...along(0, 0.62), [3.0, 1.2, 0.2], A3.toArray() as Vec3]),
    a4: curve([...along(0, 0.95), [4.6, 0.25, 0.9], A4.toArray() as Vec3]),
  };

  const focusOf: Record<string, THREE.Object3D> = { a1: emblem, a2: agent, a3: racks, a4: db };
  let focused: string | null = null;

  return {
    camera: { pos: [0.6, 1.95, 12.8], target: [0.6, 0.5, 0], fov: 36 },
    anchors: { a1: A1, a2: A2, a3: A3, a4: A4 },
    routes,
    bloom: { strength: 0.72, radius: 0.5, threshold: 0.3 },
    emphasise(pt) { focused = pt; },
    update(t, dt, motion) {
      core.rotation.y = t * 0.6;
      shell.rotation.y = -t * 0.35;
      shell.rotation.x = t * 0.2;
      ringA.rotation.z = t * 0.9;
      ringB.rotation.x = t * 0.7;
      agent.position.y = 0.55 + Math.sin(t * 1.4) * 0.06;
      flowA.update(t);
      flowB.update(t);
      db.rotation.y = t * 0.25;
      (emblemCore.material as THREE.SpriteMaterial).opacity = 0.65 + Math.sin(t * 2.2) * 0.25;
      for (const l of leds) {
        const on = Math.sin(t * l.sp + l.ph) > -0.2 ? 1 : 0.15;
        l.m.color.copy(l.base).multiplyScalar(on);
      }
      for (const c of cards) c.g.position.y = c.y + Math.sin(t * 0.8 + c.ph) * 0.08;
      if (motion && dt > 0) {
        for (let i = 0; i < N_SPILL; i++) {
          vel[i * 3 + 1] -= 3.2 * dt;
          sp[i * 3] += vel[i * 3] * dt;
          sp[i * 3 + 1] += vel[i * 3 + 1] * dt;
          sp[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (sp[i * 3 + 1] < FLOOR + 0.02) spawn(i, false);
        }
        spillGeo.attributes.position.needsUpdate = true;
      }
      for (const [pt, o] of Object.entries(focusOf)) {
        const want = focused === pt ? 1.06 : 1;
        o.scale.setScalar(o.scale.x + (want - o.scale.x) * (motion ? 0.12 : 1));
      }
    },
  };
}
