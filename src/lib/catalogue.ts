export type TagId =
  | 'threat-intel'
  | 'cloud-privacy'
  | 'ai-ml'
  | 'network-edge'
  | 'is-governance'
  | 'interdisciplinary';

export type Verification = 'crossref' | 'datacite' | 'orcid-only';

export interface AltVersion {
  label: string;
  doi: string;
}

export interface Publication {
  id: string;
  title: string;
  year: number;
  venue: string;
  workType: string;
  authors: string[];
  authorsSource: string;
  doi: string;
  sourceUrl?: string;
  sourceName: string;
  verification: Verification;
  tags: TagId[];
  altVersions: AltVersion[];
  note: string;
  featuredLabel?: string;
  why?: string;
}

export interface Filters {
  q: string;
  topic: string;
  year: string;
}

export const TAGS: ReadonlyArray<{ id: TagId; label: string }> = [
  { id: 'threat-intel', label: 'Threat intelligence' },
  { id: 'cloud-privacy', label: 'Cloud and privacy' },
  { id: 'ai-ml', label: 'AI / ML' },
  { id: 'network-edge', label: 'Network and edge security' },
  { id: 'is-governance', label: 'Information systems and governance' },
  { id: 'interdisciplinary', label: 'Interdisciplinary applications' },
];

const MAX_QUERY = 120;

export function normalizeDoi(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .toLowerCase();
}

export function doiUrl(doi: string): string | null {
  const n = doi.trim();
  return n ? `https://doi.org/${n}` : null;
}

export function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? raw : null;
  } catch {
    return null;
  }
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Link {
  href: string;
  label: string;
}

export function primaryLink(p: Publication): Link | null {
  const d = doiUrl(p.doi);
  if (d && safeUrl(d)) return { href: d, label: `DOI ${p.doi}` };
  if (p.sourceUrl && safeUrl(p.sourceUrl)) return { href: p.sourceUrl, label: 'ORCID record' };
  return null;
}

export function findDuplicates(list: readonly Publication[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  const check = (key: string, id: string, kind: string) => {
    if (!key) return;
    const k = `${kind}:${key}`;
    const prev = seen.get(k);
    if (prev !== undefined) out.push(`${kind} ${key}: ${prev} and ${id}`);
    else seen.set(k, id);
  };
  for (const p of list) {
    check(p.id, p.id, 'id');
    check(normalizeDoi(p.doi), p.id, 'doi');
    check(normalizeText(p.title), p.id, 'title');
  }
  return out;
}

export function sortNewestFirst(list: readonly Publication[]): Publication[] {
  return [...list].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

export function searchText(p: Publication): string {
  const tags = p.tags.map((t) => TAGS.find((x) => x.id === t)?.label ?? t).join(' ');
  return normalizeText([p.title, p.venue, p.workType, String(p.year), tags, p.authors.join(' ')].join(' '));
}

export interface FilterRow {
  text: string;
  year: string;
  tags: readonly string[];
}

export function matchesRow(row: FilterRow, f: Filters): boolean {
  if (f.topic && !row.tags.includes(f.topic)) return false;
  if (f.year && row.year !== f.year) return false;
  const words = normalizeText(f.q).split(' ').filter(Boolean);
  return words.every((w) => row.text.includes(w));
}

export function matchesFilters(p: Publication, f: Filters): boolean {
  return matchesRow({ text: searchText(p), year: String(p.year), tags: p.tags }, f);
}

export function filterPublications(list: readonly Publication[], f: Filters): Publication[] {
  return list.filter((p) => matchesFilters(p, f));
}

export function yearsOf(list: readonly Publication[]): number[] {
  return [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);
}

export function topicCounts(list: readonly Publication[]): Array<{ id: TagId; label: string; count: number }> {
  return TAGS.map((t) => ({ ...t, count: list.filter((p) => p.tags.includes(t.id)).length }));
}

export function parseFilters(search: string): Filters {
  const sp = new URLSearchParams(search);
  const topic = sp.get('topic') ?? '';
  const year = sp.get('year') ?? '';
  return {
    q: (sp.get('q') ?? '').slice(0, MAX_QUERY),
    topic: TAGS.some((t) => t.id === topic) ? topic : '',
    year: /^\d{4}$/.test(year) ? year : '',
  };
}

export function serializeFilters(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set('q', f.q.trim());
  if (f.topic) sp.set('topic', f.topic);
  if (f.year) sp.set('year', f.year);
  return sp.toString();
}
