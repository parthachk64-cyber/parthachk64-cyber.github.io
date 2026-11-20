import { matchesRow, parseFilters, serializeFilters, type Filters } from '../lib/catalogue';

export interface BibApi {
  reveal(id: string): boolean;
}

export function initBibliography(): BibApi | null {
  const form = document.querySelector<HTMLFormElement>('[data-filters]');
  const list = document.querySelector<HTMLElement>('[data-list]');
  const status = document.querySelector<HTMLElement>('[data-status]');
  const empty = document.querySelector<HTMLElement>('[data-empty]');
  if (!form || !list || !status || !empty) return null;

  const rows = Array.from(list.querySelectorAll<HTMLLIElement>('li.pub'));
  const q = form.elements.namedItem('q') as HTMLInputElement;
  const topic = form.elements.namedItem('topic') as HTMLSelectElement;
  const year = form.elements.namedItem('year') as HTMLSelectElement;

  const read = (): Filters => ({ q: q.value, topic: topic.value, year: year.value });
  const write = (f: Filters): void => { q.value = f.q; topic.value = f.topic; year.value = f.year; };
  const url = (f: Filters): string => {
    const s = serializeFilters(f);
    return `${location.pathname}${s ? `?${s}` : ''}${location.hash}`;
  };

  function apply(f: Filters): number {
    let shown = 0;
    for (const li of rows) {
      const ok = matchesRow(
        { text: li.dataset.text ?? '', year: li.dataset.year ?? '', tags: (li.dataset.tags ?? '').split(' ') },
        f,
      );
      li.hidden = !ok;
      if (ok) shown += 1;
    }
    empty!.hidden = shown !== 0;
    list!.hidden = shown === 0;
    const active = f.q.trim() || f.topic || f.year;
    status!.textContent = `Showing ${shown} of ${rows.length} records, newest first.${active ? ' Filters applied.' : ''}`;
    return shown;
  }

  const clear = (push: boolean): void => {
    const f: Filters = { q: '', topic: '', year: '' };
    write(f);
    apply(f);
    if (push) history.pushState(null, '', url(f));
    else history.replaceState(null, '', url(f));
  };

  q.addEventListener('input', () => { const f = read(); apply(f); history.replaceState(null, '', url(f)); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  [topic, year].forEach((s) => s.addEventListener('change', () => { const f = read(); apply(f); history.pushState(null, '', url(f)); }));
  document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => clear(true)));

  const fromUrl = (): void => { const f = parseFilters(location.search); write(f); apply(f); };
  window.addEventListener('popstate', fromUrl);
  fromUrl();

  return {
    reveal(id: string): boolean {
      const li = rows.find((r) => r.dataset.id === id);
      if (!li) return false;
      if (li.hidden) clear(false);
      li.tabIndex = -1;
      li.scrollIntoView({ block: 'start' });
      li.focus({ preventScroll: true });
      return true;
    },
  };
}
