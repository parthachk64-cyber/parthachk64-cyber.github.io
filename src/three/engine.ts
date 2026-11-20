// One WebGL stage: renderer, bloom, pointer-driven camera orbit, projected hotspot buttons,
// selection routes and pulses. Created when a plate nears the viewport, disposed when it leaves.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { COLORS, makeKit, v3 } from './kit';
import type { BuildFn } from './types';
import { buildA } from './sceneA';
import { buildB } from './sceneB';
import { buildC } from './sceneC';

const BUILDS: Record<string, BuildFn> = { a: buildA, b: buildB, c: buildC };

const MAX_YAW = 0.22; // radians of camera orbit at the artwork edge
const MAX_PITCH = 0.1;
const EASE = 0.08;
const PULSE_S = 1.15;

export interface Engine {
  setActive(on: boolean): void;
  setSelected(pt: string | null): void;
  setPreview(pt: string | null): void;
  pulse(pt: string): void;
  refresh(): void;
  dispose(): void;
}

export interface EngineOptions {
  sceneId: string;
  stage: HTMLElement;
  host: HTMLElement;
  hotspots: HTMLButtonElement[];
  motion: () => boolean;
}

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

interface Route { line: THREE.Mesh; mat: THREE.MeshBasicMaterial; curve: THREE.Curve<THREE.Vector3> }

export function createEngine(o: EngineOptions): Engine {
  const build = BUILDS[o.sceneId];
  if (!build) throw new Error(`No 3D scene for ${o.sceneId}`);

  const kit = makeKit();
  const original = o.hotspots.map((b) => [b.style.left, b.style.top] as const);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.FogExp2(COLORS.bg, 0.035);
  const def = build(scene, kit);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'gl';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  o.host.prepend(canvas);

  const camera = new THREE.PerspectiveCamera(def.camera.fov, 1, 0.1, 200);
  const target = v3(def.camera.target);
  const base = new THREE.Spherical().setFromVector3(v3(def.camera.pos).sub(target));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bl = def.bloom ?? { strength: 0.9, radius: 0.55, threshold: 0.18 };
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), bl.strength, bl.radius, bl.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Selection visuals shared by every scene.
  const routes = new Map<string, Route>();
  for (const [pt, c] of Object.entries(def.routes)) {
    const mat = kit.basic(COLORS.cyan, 0, true);
    const line = new THREE.Mesh(kit.d.track(new THREE.TubeGeometry(c, 64, 0.022, 6, false)), mat);
    scene.add(line);
    routes.set(pt, { line, mat, curve: c });
  }
  const halo = kit.sprite(kit.glow, COLORS.cyan, 1.1, 0);
  const haloRing = kit.sprite(kit.ring, COLORS.amber, 0.7, 0);
  const burst = kit.sprite(kit.ring, COLORS.cyan, 0.4, 0);
  const head = kit.sprite(kit.glow, COLORS.cyan, 0.75, 0);
  const lead = kit.sprite(kit.glow, COLORS.amber, 0.38, 0);
  scene.add(halo, haloRing, burst, head, lead);

  let selected: string | null = null;
  let preview: string | null = null;
  let pulsing: { pt: string; t0: number } | null = null;
  let active = false;
  let raf = 0;
  let lastTick = 0;
  let disposed = false;
  let frames = 0;
  const clock = new THREE.Clock();
  let tAnim = 1.7; // ambient time; a fixed pose is used when motion is off

  // Pointer orbit (fine pointers only, only inside the artwork).
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let tx = 0, ty = 0, cx = 0, cy = 0;
  let frozen = false;
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || !fine.matches || frozen || !o.motion()) return;
    // Hold the view still while the pointer is on a point, so the point never slides away from it.
    if ((e.target as Element).closest?.('.hotspot')) { tx = cx; ty = cy; return; }
    const r = o.stage.getBoundingClientRect(); // stationary wrapper
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    kick();
  };
  const onLeave = (): void => { tx = 0; ty = 0; frozen = false; kick(); };
  const onDocMove = (e: PointerEvent): void => { if ((tx || ty) && !o.stage.contains(e.target as Node)) onLeave(); };
  const onDown = (e: PointerEvent): void => { if ((e.target as Element).closest('.hotspot')) frozen = true; };
  const onUp = (): void => { window.setTimeout(() => { frozen = false; }, 350); };
  o.stage.addEventListener('pointermove', onMove);
  o.stage.addEventListener('pointerleave', onLeave);
  o.stage.addEventListener('pointerdown', onDown);
  o.stage.addEventListener('pointerup', onUp);
  document.addEventListener('pointermove', onDocMove, { passive: true });

  const sph = new THREE.Spherical();
  const placeCamera = (): void => {
    sph.set(base.radius, base.phi + cy * MAX_PITCH, base.theta + cx * MAX_YAW);
    camera.position.setFromSpherical(sph).add(target);
    camera.lookAt(target);
    o.stage.dataset.yaw = (cx * MAX_YAW).toFixed(4);
  };

  // Project anchors to CSS pixels and move the buttons; skip sub-pixel changes so they read as stable.
  const last = new Map<string, [number, number]>();
  const tmp = new THREE.Vector3();
  const projectHotspots = (w: number, h: number): void => {
    for (const b of o.hotspots) {
      const a = def.anchors[b.dataset.pt ?? ''];
      if (!a) continue;
      tmp.copy(a).project(camera);
      const x = Math.round(((tmp.x + 1) / 2) * w * 2) / 2;
      const y = Math.round(((1 - tmp.y) / 2) * h * 2) / 2;
      const prev = last.get(b.dataset.pt ?? '');
      if (prev && Math.abs(prev[0] - x) < 0.5 && Math.abs(prev[1] - y) < 0.5) continue;
      last.set(b.dataset.pt ?? '', [x, y]);
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.dataset.side = x > w * 0.6 ? 'left' : 'right';
    }
  };

  let size: [number, number] = [0, 0];
  const resize = (): void => {
    const r = o.stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === size[0] && h === size[1]) return;
    size = [w, h];
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    last.clear();
  };
  const ro = new ResizeObserver(() => { resize(); kick(); });
  ro.observe(o.stage);

  const ease = (x: number): number => 1 - Math.pow(1 - x, 3);

  const updateSelection = (now: number, motion: boolean): void => {
    const focus = preview ?? selected;
    routes.forEach((r, pt) => {
      const want = pt === selected ? 0.85 : pt === preview ? 0.45 : 0;
      r.mat.opacity += (want - r.mat.opacity) * (motion ? 0.15 : 1);
    });
    if (focus && def.anchors[focus]) {
      halo.position.copy(def.anchors[focus]);
      haloRing.position.copy(def.anchors[focus]);
      const breathe = motion ? 0.85 + Math.sin(now * 3) * 0.15 : 1;
      halo.material.opacity = (focus === selected ? 0.9 : 0.55) * breathe;
      haloRing.material.opacity = focus === selected ? 0.95 : 0.4;
      haloRing.scale.setScalar(0.62 + (motion ? Math.sin(now * 2) * 0.05 : 0));
    } else {
      halo.material.opacity = 0;
      haloRing.material.opacity = 0;
    }
    def.emphasise?.(focus);

    if (pulsing && motion) {
      const k = (now - pulsing.t0) / PULSE_S;
      const r = routes.get(pulsing.pt);
      const anchor = def.anchors[pulsing.pt];
      if (k >= 1.35 || !anchor) {
        pulsing = null;
        head.material.opacity = lead.material.opacity = burst.material.opacity = 0;
        delete o.stage.dataset.pulse;
      } else {
        if (r && k <= 1) {
          const u = ease(Math.min(1, k));
          r.curve.getPointAt(u, head.position);
          r.curve.getPointAt(Math.min(1, u + 0.03), lead.position);
          head.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.4 + 0.6;
          lead.material.opacity = head.material.opacity;
        } else {
          head.material.opacity = lead.material.opacity = 0;
        }
        const kb = r ? (k - 0.85) / 0.5 : k / 0.9;
        if (kb > 0) {
          burst.position.copy(anchor);
          burst.scale.setScalar(0.3 + kb * 1.6);
          burst.material.opacity = Math.max(0, 1 - kb);
        }
      }
    } else if (!motion) {
      head.material.opacity = lead.material.opacity = burst.material.opacity = 0;
    }
  };

  // Adaptive quality: if the frame interval stays long (under ~30 fps), drop the pixel ratio, then bloom.
  let cost = 0;
  let tier = 0;
  let sampled = 0;
  let prevFrame = 0;
  const adapt = (now: number): void => {
    const gap = prevFrame ? now - prevFrame : 0;
    prevFrame = now;
    if (!o.motion() || gap <= 0 || gap > 500) return;
    cost = sampled === 0 ? gap : cost * 0.9 + gap * 0.1;
    sampled += 1;
    if (sampled < 40 || tier >= 2 || cost < 34) return;
    tier += 1;
    sampled = 0;
    if (tier === 1) renderer.setPixelRatio(0.85);
    if (tier === 2) { renderer.setPixelRatio(0.7); bloom.enabled = false; }
    size = [0, 0];
    resize();
    o.stage.dataset.quality = String(tier);
  };

  const render = (): void => {
    if (disposed) return;
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const motion = o.motion();
    if (motion) tAnim += dt;
    else { tx = ty = 0; cx = cy = 0; }
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    placeCamera();
    def.update(tAnim, motion ? dt : 0, motion);
    updateSelection(tAnim, motion);
    composer.render();
    adapt(performance.now());
    projectHotspots(size[0], size[1]);
    frames += 1;
    if (frames % 15 === 0) o.stage.dataset.frames = String(frames);
  };

  const loop = (): void => {
    raf = 0;
    lastTick = performance.now();
    render();
    const settling = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001;
    if (active && !document.hidden && (o.motion() || settling)) raf = requestAnimationFrame(loop);
  };
  function kick(): void {
    if (disposed) return;
    if (raf && performance.now() - lastTick > 200) { cancelAnimationFrame(raf); raf = 0; }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  const onVis = (): void => { if (!document.hidden) { clock.getDelta(); kick(); } };
  // Watchdog: some engines occasionally drop an animation-frame callback; restart a stalled loop.
  const watchdog = window.setInterval(() => {
    if (active && !document.hidden && o.motion() && performance.now() - lastTick > 600) kick();
  }, 1000);
  document.addEventListener('visibilitychange', onVis);

  resize();
  render();
  o.stage.dataset.gl = 'ready';

  return {
    setActive(on) { active = on; if (on) { clock.getDelta(); kick(); } },
    setSelected(pt) { selected = pt; kick(); },
    setPreview(pt) { preview = pt; kick(); },
    pulse(pt) {
      if (!o.motion()) { kick(); return; }
      pulsing = { pt, t0: tAnim };
      o.stage.dataset.pulse = pt;
      kick();
    },
    refresh() { clock.getDelta(); kick(); },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(watchdog);
      ro.disconnect();
      o.stage.removeEventListener('pointermove', onMove);
      o.stage.removeEventListener('pointerleave', onLeave);
      o.stage.removeEventListener('pointerdown', onDown);
      o.stage.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointermove', onDocMove);
      document.removeEventListener('visibilitychange', onVis);
      composer.dispose();
      bloom.dispose();
      kit.d.dispose();
      scene.traverse((ob) => {
        const m = ob as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      o.hotspots.forEach((b, i) => { b.style.left = original[i][0]; b.style.top = original[i][1]; });
      delete o.stage.dataset.gl;
      delete o.stage.dataset.yaw;
      delete o.stage.dataset.pulse;
    },
  };
}
