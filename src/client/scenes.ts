// Scene interaction: selection, previews, pulses, compact mode, and the WebGL stage lifecycle.
import type { Engine } from '../three/engine';

const MAX_TILT_DEG = 3;
const MAX_LIVE_GL = 2;

interface LiveStage { distance(): number; release(): void }
const liveStages = new Set<LiveStage>();
function makeRoom(self: LiveStage): void {
  while (liveStages.size >= MAX_LIVE_GL) {
    const far = [...liveStages].filter((s) => s !== self).sort((a, b) => b.distance() - a.distance())[0];
    if (!far) return;
    far.release();
  }
}
const TRACE_SHIFT_PX = 3;
const COMPACT_BELOW_PX = 480;
const EASE = 0.14;

const motionOn = (): boolean => document.documentElement.getAttribute('data-motion') !== 'off';
const qs = <T extends Element>(root: ParentNode, sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));

export interface SceneApi {
  id: string;
  has(pt: string): boolean;
  open(pt: string, opts?: { push?: boolean; scroll?: boolean }): void;
  close(opts?: { restoreFocus?: boolean }): void;
  isOpen(): boolean;
}

export function initScene(el: HTMLElement): SceneApi {
  const id = el.dataset.scene ?? '';
  const stage = el.querySelector<HTMLElement>('[data-stage]');
  const hotspots = qs<HTMLButtonElement>(el, '.hotspot');
  const items = qs<HTMLAnchorElement>(el, '.index__item');
  const panels = qs<HTMLElement>(el, '.panel');
  const traces = qs<SVGGElement>(el, 'g.trace[data-pt]');
  const ambient = el.querySelector<SVGGElement>('g.trace--ambient');
  const defaultPt = items.find((i) => i.classList.contains('is-default'))?.dataset.pt ?? items[0]?.dataset.pt ?? '';
  let current = defaultPt;
  let open = false;
  let activator: HTMLElement | null = null;

  const closeBtns = qs<HTMLButtonElement>(el, '.panel__close');
  const trace = (pt: string) => traces.find((t) => t.dataset.pt === pt);

  items.forEach((i) => {
    i.setAttribute('role', 'button');
    i.setAttribute('aria-pressed', 'false');
  });

  function showPanel(pt: string): void {
    current = pt;
    panels.forEach((p) => { p.hidden = p.dataset.pt !== pt; });
  }

  function paint(): void {
    hotspots.forEach((h) => h.setAttribute('aria-pressed', String(open && h.dataset.pt === current)));
    items.forEach((i) => i.setAttribute('aria-pressed', String(open && i.dataset.pt === current)));
    traces.forEach((t) => t.classList.toggle('is-active', open && t.dataset.pt === current));
    closeBtns.forEach((b) => { b.hidden = !open; });
    engine?.setSelected(open ? current : null);
    if (open) el.dataset.committed = '1'; else delete el.dataset.committed;
  }

  let engine: Engine | null = null;

  function pulse(pt: string): void {
    if (!motionOn()) return;
    engine?.pulse(pt);
    const t = trace(pt);
    if (!t) return;
    t.classList.remove('is-pulsing');
    void (t as unknown as HTMLElement).getBoundingClientRect();
    t.classList.add('is-pulsing');
    window.setTimeout(() => t.classList.remove('is-pulsing'), 1500);
  }

  function preview(pt: string | null): void {
    traces.forEach((t) => t.classList.toggle('is-preview', pt !== null && t.dataset.pt === pt));
    items.forEach((i) => i.classList.toggle('is-preview', pt !== null && i.dataset.pt === pt));
    engine?.setPreview(pt);
  }

  function ensureTitleVisible(): void {
    const title = el.querySelector<HTMLElement>('.panel:not([hidden]) .panel__title');
    if (!title) return;
    const r = title.getBoundingClientRect();
    if (r.top < 64 || r.bottom > window.innerHeight - 16) {
      title.scrollIntoView({ block: 'nearest', behavior: motionOn() ? 'smooth' : 'auto' });
    }
  }

  function openPt(pt: string, opts: { push?: boolean; scroll?: boolean } = {}): void {
    if (!panels.some((p) => p.dataset.pt === pt)) return;
    showPanel(pt);
    open = true;
    paint();
    pulse(pt);
    if (opts.push) {
      const next = `${location.pathname}${location.search}#featured-${pt}`;
      if (location.hash !== `#featured-${pt}`) history.pushState(null, '', next);
    }
    if (opts.scroll) stage?.scrollIntoView({ block: 'center', behavior: 'auto' });
    else ensureTitleVisible();
  }

  function closeScene(opts: { restoreFocus?: boolean } = {}): void {
    if (!open) return;
    open = false;
    paint();
    if (location.hash.startsWith('#featured-')) history.replaceState(null, '', `${location.pathname}${location.search}`);
    if (opts.restoreFocus && activator) {
      const target = activator.isConnected && activator.getAttribute('aria-hidden') !== 'true' ? activator : items.find((i) => i.dataset.pt === current);
      target?.focus();
    }
  }

  hotspots.forEach((h) => {
    const pt = h.dataset.pt ?? '';
    h.addEventListener('click', () => { activator = h; openPt(pt, { push: true }); });
    h.addEventListener('pointerenter', () => preview(pt));
    h.addEventListener('pointerleave', () => preview(null));
    h.addEventListener('focus', () => preview(pt));
    h.addEventListener('blur', () => preview(null));
  });
  items.forEach((i) => {
    const pt = i.dataset.pt ?? '';
    i.addEventListener('click', (e) => { e.preventDefault(); activator = i; openPt(pt, { push: true }); });
    i.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); i.click(); } });
    i.addEventListener('pointerenter', () => preview(pt));
    i.addEventListener('pointerleave', () => preview(null));
    i.addEventListener('focus', () => preview(pt));
    i.addEventListener('blur', () => preview(null));
  });
  closeBtns.forEach((b) => b.addEventListener('click', () => closeScene({ restoreFocus: true })));
  qs<HTMLAnchorElement>(el, '[data-share]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const pt = a.getAttribute('href')?.replace('#featured-', '') ?? '';
      activator = a;
      openPt(pt, { push: true });
    });
  });

  // Visibility: pause offscreen, play an entrance pulse the first time the plate is seen.
  let entered = false;
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        visible = en.isIntersecting;
        el.classList.toggle('is-visible', en.isIntersecting);
        engine?.setActive(en.isIntersecting);
        if (en.isIntersecting && !entered) {
          entered = true;
          window.setTimeout(() => { pulse(defaultPt); if (!trace(defaultPt)?.querySelector('.trace__pulse')) trace(defaultPt)?.classList.add('is-pulsing'); }, 250);
          window.setTimeout(() => trace(defaultPt)?.classList.remove('is-pulsing'), 1800);
        }
      }
    },
    { threshold: 0.3 },
  );
  io.observe(stage ?? el);
  void ambient;

  if (stage) {
    initCompact(el, stage, hotspots);
    initTilt(stage);
    // WebGL lifecycle: build the 3D stage when the plate comes near, dispose it when it leaves,
    // so at most two contexts exist at once. The poster image stays underneath as the fallback.
    const host = el.querySelector<HTMLElement>('[data-plane]');
    let near = false;
    let loading = false;
    const mount = async (): Promise<void> => {
      if (engine || loading || !host) return;
      loading = true;
      try {
        const mod = await import('../three/engine');
        if (!mod.supportsWebGL()) { stage.dataset.gl = 'unsupported'; return; }
        if (!near || engine) return;
        makeRoom(live);
        engine = mod.createEngine({ sceneId: id, stage, host, hotspots, motion: motionOn });
        liveStages.add(live);
        engine.setSelected(open ? current : null);
        engine.setActive(visible);
        if (visible && !open) engine.pulse(current);
      } catch {
        stage.dataset.gl = 'failed';
        engine = null;
      } finally {
        loading = false;
      }
    };
    const release = (): void => {
      liveStages.delete(live);
      if (engine) { engine.dispose(); engine = null; }
    };
    const live: LiveStage = {
      distance: () => { const r = stage.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - window.innerHeight / 2); },
      release: () => { near = false; release(); },
    };
    // Hysteresis: build within 450px of the viewport, release only beyond 1400px.
    const nearIo = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { near = true; void mount(); }
    }, { rootMargin: '450px 0px' });
    const farIo = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) continue;
        near = false;
        release();
      }
    }, { rootMargin: '1400px 0px' });
    nearIo.observe(stage);
    farIo.observe(stage);
    window.addEventListener('motionchange', () => engine?.refresh());
  }

  return {
    id,
    has: (pt) => panels.some((p) => p.dataset.pt === pt),
    open: openPt,
    close: closeScene,
    isOpen: () => open,
  };
}

function initCompact(el: HTMLElement, stage: HTMLElement, hotspots: HTMLButtonElement[]): void {
  const apply = (w: number): void => {
    const compact = w < COMPACT_BELOW_PX;
    el.toggleAttribute('data-compact', compact);
    hotspots.forEach((h) => {
      h.tabIndex = compact ? -1 : 0;
      if (compact) h.setAttribute('aria-hidden', 'true'); else h.removeAttribute('aria-hidden');
    });
  };
  apply(stage.getBoundingClientRect().width);
  new ResizeObserver((e) => apply(e[0]?.contentRect.width ?? stage.clientWidth)).observe(stage);
}

function initTilt(stage: HTMLElement): void {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, lastTick = 0, frozen = false;

  const apply = (): void => {
    stage.style.setProperty('--nx', cx.toFixed(4));
    stage.style.setProperty('--ny', cy.toFixed(4));
    stage.style.setProperty('--rx', `${(-cy * MAX_TILT_DEG).toFixed(3)}deg`);
    stage.style.setProperty('--ry', `${(cx * MAX_TILT_DEG).toFixed(3)}deg`);
    stage.style.setProperty('--shift', `${TRACE_SHIFT_PX}px`);
  };
  const tick = (): void => {
    lastTick = performance.now();
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    apply();
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(tick);
    else { cx = tx; cy = ty; apply(); raf = 0; }
  };
  const run = (): void => {
    // A dropped frame callback would leave a stale handle that blocks restarts, so recover from it.
    if (raf && performance.now() - lastTick > 150) { cancelAnimationFrame(raf); raf = 0; }
    if (!raf) { lastTick = performance.now(); raf = requestAnimationFrame(tick); }
  };
  const reset = (): void => { tx = 0; ty = 0; run(); };

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !fine.matches || frozen) return;
    if (!motionOn() || stage.dataset.gl === 'ready') { reset(); return; }
    const r = stage.getBoundingClientRect(); // stationary wrapper: never transformed
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    run();
  });
  stage.addEventListener('pointerleave', () => { frozen = false; reset(); });
  // Some engines skip pointerleave when a fixed header covers the exit point.
  document.addEventListener('pointermove', (e) => {
    if ((tx !== 0 || ty !== 0) && !stage.contains(e.target as Node)) { frozen = false; reset(); }
  }, { passive: true });
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.hotspot')) frozen = true;
  });
  const unfreeze = (): void => { window.setTimeout(() => { frozen = false; }, 350); };
  stage.addEventListener('pointerup', unfreeze);
  stage.addEventListener('pointercancel', unfreeze);
  window.addEventListener('motionchange', () => { if (!motionOn()) reset(); });
}
