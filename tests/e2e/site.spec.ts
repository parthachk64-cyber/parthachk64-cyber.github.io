import { expect, test, type Page } from '@playwright/test';
import publications from '../../src/data/publications.json' with { type: 'json' };
import { scenes } from '../../src/data/scenes';

const points = scenes.flatMap((s) => s.points.map((p) => ({ ...p, scene: s.id })));
const pub = (id: string) => publications.find((p) => p.id === id)!;
const TOTAL = publications.length;

function watchConsole(page: Page): string[] {
  const bad: string[] = [];
  page.on('console', (m) => {
    // Driver notice caused by the test harness reading pixels back for screenshots, not by the page.
    if (/GPU stall due to ReadPixels/.test(m.text())) return;
    // Intended: a plate that scrolls far away releases its GPU context explicitly (Firefox logs this).
    if (/WebGL context was lost/.test(m.text())) return;
    if (m.type() === 'error' || m.type() === 'warning') bad.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`));
  return bad;
}

const hotspot = (page: Page, id: string) => page.locator(`.hotspot[data-pt="${id}"]`);
const panel = (page: Page, sceneId: string) => page.locator(`#scene-${sceneId} .panel:not([hidden])`);

test.describe('structure and content', () => {
  test('renders three scenes, 12 featured points and every record, with no console noise', async ({ page }) => {
    const bad = watchConsole(page);
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(3);
    await expect(page.locator('.hotspot')).toHaveCount(12);
    await expect(page.locator('li.pub')).toHaveCount(TOTAL);
    await expect(page.locator('[data-total]')).toHaveText(String(TOTAL));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Partha Chakraborty');
    await expect(page.getByRole('link', { name: 'Explore the research' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse publications' })).toBeVisible();
    const ids = await page.locator('[id]').evaluateAll((els) => els.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(bad).toEqual([]);
  });

  test('uses only safe external links and never publishes the personal email', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => ({ h: (a as HTMLAnchorElement).getAttribute('href')!, t: a.getAttribute('target'), r: a.getAttribute('rel') })));
    for (const l of hrefs) {
      expect(l.h.toLowerCase().startsWith('javascript:')).toBe(false);
      if (/^https?:/.test(l.h)) {
        expect(l.h.startsWith('https://')).toBe(true);
        if (l.t === '_blank') expect(l.r).toContain('noopener');
      }
    }
    const html = await page.content();
    expect(html).not.toMatch(/gmail\.com/i);
    expect(html).toContain('parthachakraborty@ieee.org');
  });

  test('loads the hero image eagerly and declares the lower scenes lazy', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const early = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    expect(early.some((n) => /scene-a/.test(n))).toBe(true);
    // How far ahead an engine pre-fetches lazy images varies by engine and layout, so assert the declaration, not the timing.
    await expect(page.locator('#scene-a img')).toHaveAttribute('loading', 'eager');
    await expect(page.locator('#scene-b img')).toHaveAttribute('loading', 'lazy');
    await expect(page.locator('#scene-c img')).toHaveAttribute('loading', 'lazy');
    await page.locator('#scene-c').scrollIntoViewIfNeeded();
    await expect.poll(async () => page.evaluate(() => performance.getEntriesByType('resource').some((r) => /scene-c/.test(r.name)))).toBe(true);
  });
});

test.describe('hotspot selection', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer hotspots are covered on desktop; touch has its own tests');

  for (const p of points) {
    test(`mouse: ${p.id} opens "${p.label}" with the right paper and DOI link`, async ({ page }) => {
      const bad = watchConsole(page);
      await page.goto('/');
      const hs = hotspot(page, p.id);
      await hs.scrollIntoViewIfNeeded();
      await hs.click();
      const pn = panel(page, p.scene);
      await expect(pn.getByRole('heading', { level: 3 })).toHaveText(pub(p.id).title);
      await expect(hs).toHaveAttribute('aria-pressed', 'true');
      const link = pn.getByRole('link', { name: /^Open (DOI|the ORCID)/ });
      const expected = pub(p.id).doi ? `https://doi.org/${pub(p.id).doi}` : (pub(p.id) as { sourceUrl?: string }).sourceUrl;
      await expect(link).toHaveAttribute('href', expected!);
      await expect(page).toHaveURL(new RegExp(`#featured-${p.id}$`));
      expect(bad).toEqual([]);
    });
  }

  test('hover previews a topic without navigating or committing', async ({ page }) => {
    await page.goto('/');
    const hs = hotspot(page, 'a4');
    await hs.scrollIntoViewIfNeeded();
    await hs.hover();
    await expect(page.locator('.trace[data-pt="a4"]')).toHaveClass(/is-preview/);
    await expect(page.locator('.hotspot__tip', { hasText: 'Trusted data' })).toBeVisible();
    await expect(page.locator('#scene-a')).not.toHaveAttribute('data-committed', '1');
    await expect(page).not.toHaveURL(/featured/);
  });

  test('keyboard: focus, Enter opens, Escape closes and returns focus', async ({ page }) => {
    await page.goto('/');
    const hs = hotspot(page, 'a3');
    await hs.focus();
    const outline = await hs.locator('.hotspot__dot').evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth));
    expect(outline).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    await expect(panel(page, 'a').getByRole('heading', { level: 3 })).toHaveText(pub('a3').title);
    await page.keyboard.press('Escape');
    await expect(page.locator('#scene-a')).not.toHaveAttribute('data-committed', '1');
    await expect(hs).toBeFocused();
    await expect(hs).toHaveAttribute('aria-pressed', 'false');
  });

  test('keyboard: Tab reaches hotspots and the close button works', async ({ page }) => {
    await page.goto('/');
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.classList.contains('hotspot') ?? false);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Space');
    const close = page.locator('#scene-a .panel:not([hidden]) .panel__close');
    await expect(close).toBeVisible();
    await close.click();
    await expect(close).toBeHidden();
    await expect(page.locator('.hotspot:focus')).toHaveCount(1);
  });

  for (const p of points) {
    test(`text index: ${p.id} selects the same paper`, async ({ page }) => {
      await page.goto('/');
      const item = page.locator(`.index__item[data-pt="${p.id}"]`);
      await item.scrollIntoViewIfNeeded();
      await item.click();
      await expect(panel(page, p.scene).getByRole('heading', { level: 3 })).toHaveText(pub(p.id).title);
      await expect(item).toHaveAttribute('aria-pressed', 'true');
    });
  }
});

test.describe('depth and hit testing', () => {
  test.skip(({ isMobile }) => isMobile, 'fine pointer only');

  test('the 3D camera orbits only while the pointer is inside the artwork and settles back', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('#scene-a [data-stage]');
    await expect(stage).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
    const yaw = async () => Number(await stage.getAttribute('data-yaw'));
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x - 40, box.y + 20);
    await page.waitForTimeout(300);
    expect(Math.abs(await yaw())).toBeLessThan(0.005);
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 8 });
    await expect.poll(async () => Math.abs(await yaw()), { timeout: 8000 }).toBeGreaterThan(0.08);
    expect(Math.abs(await yaw())).toBeLessThanOrEqual(0.221);
    await page.mouse.move(box.x - 60, box.y - 60, { steps: 4 });
    await expect.poll(async () => Math.abs(await yaw()), { timeout: 10000 }).toBeLessThan(0.005);
  });

  test('a point still receives the click while the plane is tilted', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('#scene-a [data-stage]');
    await stage.scrollIntoViewIfNeeded();
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1, { steps: 6 });
    await page.waitForTimeout(700);
    const c = (await hotspot(page, 'a4').boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.hotspot')?.getAttribute('data-pt'), [c.x + c.width / 2, c.y + c.height / 2] as [number, number]);
    expect(hit).toBe('a4');
    await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
    await expect(panel(page, 'a').getByRole('heading', { level: 3 })).toHaveText(pub('a4').title);
  });

  test('has no layout shift worth noting', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift API is Chromium-only');
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/', { waitUntil: 'load' });
    for (const id of ['b', 'c']) await page.locator(`#scene-${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`CLS measured (desktop Chromium, local preview): ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.1);
  });
});

test.describe('webgl scenes', () => {
  test('each plate renders a live, non-blank 3D scene', async ({ page }) => {
    const bad = watchConsole(page);
    await page.goto('/');
    for (const s of scenes) {
      const stage = page.locator(`#scene-${s.id} [data-stage]`);
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
      await expect(stage.locator('canvas.gl')).toHaveCount(1);
      await expect.poll(async () => Number(await stage.getAttribute('data-frames')), { timeout: 10000 }).toBeGreaterThan(15);
      const f1 = Number(await stage.getAttribute('data-frames'));
      await expect.poll(async () => Number(await stage.getAttribute('data-frames')), { timeout: 10000 }).toBeGreaterThan(f1);
      const png = await stage.locator('canvas.gl').screenshot();
      expect(png.byteLength).toBeGreaterThan(30000);
    }
    expect(bad).toEqual([]);
  });

  test('keeps at most two WebGL contexts and releases them away from the plates', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scene-a [data-stage]')).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
    expect(await page.locator('canvas.gl').count()).toBeLessThanOrEqual(2);
    await page.locator('#scene-c [data-stage]').scrollIntoViewIfNeeded();
    await expect(page.locator('#scene-c [data-stage]')).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
    expect(await page.locator('canvas.gl').count()).toBeLessThanOrEqual(2);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('canvas.gl').count(), { timeout: 8000 }).toBe(0);
  });

  test('selecting a point runs a 3D pulse along its route', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop');
    await page.goto('/');
    const stage = page.locator('#scene-b [data-stage]');
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
    await page.waitForTimeout(1600);
    await hotspot(page, 'b4').click();
    await expect(stage).toHaveAttribute('data-pulse', 'b4');
    await expect(stage).not.toHaveAttribute('data-pulse', /.+/, { timeout: 6000 });
  });
});

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch projects only');

  test('each scene shows its own entrance pulse when it scrolls into view', async ({ page }) => {
    await page.addInitScript(() => {
      const seen = new Set<string>();
      (window as unknown as { __pulsed: Set<string> }).__pulsed = seen;
      new MutationObserver((ms) => {
        for (const m of ms) {
          const t = m.target as Element;
          if (t.classList?.contains('is-pulsing')) seen.add(`${t.closest('[data-scene]')?.getAttribute('data-scene')}:${t.getAttribute('data-pt')}`);
          const p3 = t.getAttribute?.('data-pulse');
          if (p3) seen.add(`3d:${t.closest('[data-scene]')?.getAttribute('data-scene')}:${p3}`);
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class', 'data-pulse'] });
    });
    await page.goto('/');
    for (const s of scenes) {
      await page.locator(`#scene-${s.id} [data-stage]`).scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate((k) => (window as unknown as { __pulsed: Set<string> }).__pulsed.has(k), `${s.id}:${s.defaultPoint}`), { timeout: 6000 }).toBe(true);
      await expect.poll(() => page.evaluate((k) => (window as unknown as { __pulsed: Set<string> }).__pulsed.has(k), `3d:${s.id}:${s.defaultPoint}`), { timeout: 20000 }).toBe(true);
    }
  });

  test('taps on the index select a paper and keep the title in view', async ({ page }) => {
    await page.goto('/');
    const item = page.locator('.index__item[data-pt="b3"]');
    await item.scrollIntoViewIfNeeded();
    await item.tap();
    const title = panel(page, 'b').getByRole('heading', { level: 3 });
    await expect(title).toHaveText(pub('b3').title);
    await expect(title).toBeInViewport();
    await expect(page.locator('g.trace[data-pt="b3"]')).toHaveClass(/is-active/);
  });

  test('small screens switch activation to the index and keep numbered markers as keys', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scene-a')).toHaveAttribute('data-compact', '');
    await expect(hotspot(page, 'a1')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#scene-a .hotspot__num').first()).toBeVisible();
  });

  test('artwork does not capture vertical scrolling', async ({ page }) => {
    await page.goto('/');
    const ta = await page.locator('#scene-a [data-stage]').evaluate((e) => getComputedStyle(e).touchAction);
    expect(['auto', 'manipulation', 'pan-y']).toContain(ta);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 400));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
  });
});

test.describe('bibliography', () => {
  test('search, topic and year filters, count, clear and empty state', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('li.pub:not([hidden])');
    await page.locator('#publications').scrollIntoViewIfNeeded();
    await page.getByRole('searchbox').fill('federated');
    await expect(page).toHaveURL(/q=federated/);
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThan(TOTAL);
    await expect(page.locator('[data-status]')).toContainText(`Showing ${n} of ${TOTAL}`);
    await page.locator('select[name="year"]').selectOption('2026');
    await expect(page).toHaveURL(/year=2026/);
    for (const y of await rows.evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.year))) expect(y).toBe('2026');
    await page.getByRole('searchbox').fill('zzzz-nothing');
    await expect(page.locator('[data-empty]')).toBeVisible();
    await expect(page.locator('li.pub:not([hidden])')).toHaveCount(0);
    await page.locator('[data-empty] [data-clear]').click();
    await expect(page.locator('[data-empty]')).toBeHidden();
    await expect(page.locator('li.pub:not([hidden])')).toHaveCount(TOTAL);
    await page.locator('select[name="topic"]').selectOption('network-edge');
    const topicRows = await page.locator('li.pub:not([hidden])').evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.tags));
    expect(topicRows.length).toBeGreaterThan(0);
    for (const t of topicRows) expect(t).toContain('network-edge');
    await page.locator('[data-filters] [data-clear]').click();
    await expect(page.locator('li.pub:not([hidden])')).toHaveCount(TOTAL);
  });

  test('is newest first', async ({ page }) => {
    await page.goto('/');
    const years = (await page.locator('li.pub').evaluateAll((l) => l.map((e) => Number((e as HTMLElement).dataset.year))));
    for (let i = 1; i < years.length; i++) expect(years[i - 1]).toBeGreaterThanOrEqual(years[i]);
  });

  test('filters survive reload and the Back button restores the previous state', async ({ page }) => {
    await page.goto('/?q=blockchain');
    await expect(page.getByRole('searchbox')).toHaveValue('blockchain');
    const before = await page.locator('li.pub:not([hidden])').count();
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(TOTAL);
    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue('blockchain');
    await expect(page.locator('li.pub:not([hidden])')).toHaveCount(before);
    await page.locator('select[name="year"]').selectOption('2025');
    const after = await page.locator('li.pub:not([hidden])').count();
    expect(after).toBeLessThanOrEqual(before);
    await page.goBack();
    await expect(page.locator('select[name="year"]')).toHaveValue('');
    await expect(page.locator('li.pub:not([hidden])')).toHaveCount(before);
  });

  test('deep links reach a record, even one hidden by the current filters', async ({ page }) => {
    await page.goto('/#pub-b3');
    await expect(page.locator('#pub-b3')).toBeInViewport();
    await page.goto('/?q=zzzz-nothing#pub-a4');
    await expect(page.locator('#pub-a4')).toBeVisible();
    await expect(page.locator('#pub-a4')).toBeInViewport();
  });

  test('a shared featured link opens the right paper on load', async ({ page }) => {
    await page.goto('/#featured-c3');
    await expect(panel(page, 'c').getByRole('heading', { level: 3 })).toHaveText(pub('c3').title);
    await expect(page.locator('#scene-c')).toHaveAttribute('data-committed', '1');
  });

  test('each featured paper appears exactly once in the bibliography', async ({ page }) => {
    await page.goto('/');
    for (const p of points) await expect(page.locator(`li.pub#pub-${p.id}`)).toHaveCount(1);
  });
});

test.describe('motion and resilience', () => {
  test.describe('reduced-motion preference is ignored by design', () => {
    test.use({ reducedMotion: 'reduce' });
    test('motion stays on, there is no toggle, and the scene keeps rendering frames', async ({ page, isMobile }) => {
      test.skip(isMobile, 'desktop');
      await page.addInitScript(() => localStorage.setItem('motion', 'off'));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
      await expect(page.getByRole('button', { name: /Motion/ })).toHaveCount(0);
      const stage = page.locator('#scene-a [data-stage]');
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toHaveAttribute('data-gl', 'ready', { timeout: 20000 });
      const f1 = Number(await stage.getAttribute('data-frames'));
      await page.waitForTimeout(1200);
      expect(Number(await stage.getAttribute('data-frames'))).toBeGreaterThan(f1);
      const anim = await page.locator('#scene-a .trace--ambient .trace__pulse').evaluate((e) => getComputedStyle(e).animationName);
      expect(anim).not.toBe('none');
    });
  });

  test('motion is on by default with no toggle and survives reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await expect(page.getByRole('button', { name: /Motion/ })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  });

  test('offscreen scenes are paused', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scene-c')).not.toHaveClass(/is-visible/);
    const state = await page.locator('#scene-c .trace[data-pt="c1"] .ring').evaluate((e) => getComputedStyle(e).animationPlayState);
    expect(state).toBe('paused');
  });

  test('failed artwork never hides the controls or the bibliography', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop');
    await page.route('**/images/*.webp', (r) => r.abort());
    await page.goto('/');
    await expect(hotspot(page, 'b2')).toBeVisible();
    await hotspot(page, 'b2').scrollIntoViewIfNeeded();
    await hotspot(page, 'b2').click();
    await expect(panel(page, 'b').getByRole('heading', { level: 3 })).toHaveText(pub('b2').title);
    await expect(page.locator('li.pub')).toHaveCount(TOTAL);
  });

  test('mobile menu opens, navigates and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile');
    await page.goto('/');
    const btn = page.getByRole('button', { name: 'Menu' });
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Publications' }).click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#publications')).toBeInViewport();
  });
});

test.describe('responsive layout', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport sweep runs on desktop engines');
  for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
    test(`no horizontal overflow and in-order hero at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await page.waitForLoadState('load');
      // Stress test: a wide fallback font exposes min-content overflow that Linux system fonts would otherwise trigger.
      await page.addStyleTag({ content: 'body,button,input,select{font-family:Verdana,"DejaVu Sans",sans-serif!important}' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      const tops = await page.evaluate(() => ['h1', '.statement', '.actions', '#scene-a [data-stage]'].map((s) => document.querySelector(s)!.getBoundingClientRect().top));
      if (w < 960) expect([...tops].sort((a, b) => a - b)).toEqual(tops);
      for (const id of ['a', 'b', 'c']) {
        const s = await page.locator(`#scene-${id} [data-stage]`).boundingBox();
        expect(s!.width).toBeLessThanOrEqual(w);
      }
    });
  }
});

test.describe('javascript disabled', () => {
  test.use({ javaScriptEnabled: false });
  test('keeps the bibliography, default papers, nav and index links usable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('li.pub')).toHaveCount(TOTAL);
    await expect(page.locator('li.pub').first()).toBeVisible();
    for (const s of scenes) {
      const def = s.defaultPoint;
      await expect(page.locator(`#scene-${s.id} .panel:not([hidden])`)).toHaveAttribute('data-pt', def);
      await expect(page.locator(`#scene-${s.id} .panel:not([hidden]) a[href^="https://doi.org/"]`)).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.locator('.index__item[data-pt="a3"]')).toHaveAttribute('href', '#pub-a3');
    await expect(page.locator('[data-filters]')).toBeHidden();
    await expect(page.locator('.hotspot').first()).toBeHidden();
  });
});
