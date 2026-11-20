import { initScene, type SceneApi } from './scenes';
import { initBibliography } from './bibliography';

function initMotion(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const label = document.querySelector<HTMLElement>('[data-motion-state]');
  const root = document.documentElement;
  const paint = (): void => {
    const on = root.getAttribute('data-motion') !== 'off';
    btn?.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? 'on' : 'off';
  };
  btn?.addEventListener('click', () => {
    const next = root.getAttribute('data-motion') === 'off' ? 'on' : 'off';
    root.setAttribute('data-motion', next);
    try { localStorage.setItem('motion', next); } catch { /* storage unavailable: choice lasts for this visit */ }
    paint();
    window.dispatchEvent(new Event('motionchange'));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) root.setAttribute('data-hidden', ''); else root.removeAttribute('data-hidden');
  });
  paint();
}

function initMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu]');
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!btn || !nav) return;
  const set = (open: boolean): void => {
    btn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
}

function main(): void {
  initMotion();
  initMenu();
  const scenes: SceneApi[] = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]')).map(initScene);
  const bib = initBibliography();

  const route = (first: boolean): void => {
    const h = location.hash;
    const f = /^#featured-([a-z0-9-]+)$/.exec(h);
    if (f) {
      const s = scenes.find((x) => x.has(f[1]));
      if (s) s.open(f[1], { scroll: true });
      return;
    }
    scenes.forEach((s) => s.close());
    const p = /^#pub-([a-z0-9-]+)$/.exec(h);
    if (p && bib && !first) bib.reveal(p[1]);
    else if (p && bib) window.setTimeout(() => bib.reveal(p[1]), 0);
  };
  window.addEventListener('hashchange', () => route(false));
  window.addEventListener('popstate', () => route(false));
  route(true);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = scenes.find((s) => s.isOpen());
    if (open) { e.preventDefault(); open.close({ restoreFocus: true }); }
  });
}

main();
