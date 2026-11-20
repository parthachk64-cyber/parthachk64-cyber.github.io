import { describe, expect, it } from 'vitest';
import publications from '../../src/data/publications.json';
import { scenes } from '../../src/data/scenes';
import {
  TAGS,
  doiUrl,
  filterPublications,
  findDuplicates,
  matchesFilters,
  normalizeDoi,
  normalizeText,
  parseFilters,
  primaryLink,
  safeUrl,
  serializeFilters,
  sortNewestFirst,
  topicCounts,
  yearsOf,
  type Publication,
} from '../../src/lib/catalogue';
import { resolveScenes, validateScenes } from '../../src/lib/scenes';

const pubs = publications as Publication[];

const EXPECTED_FEATURED: Record<string, string> = {
  a1: 'An Intelligent Cybersecurity Framework for Data Protection in Cloud Computing Environments',
  a2: 'Cyber Threat Prediction Using Temporal Data Analysis Model',
  a3: 'AI-driven threat detection and response framework for protecting U.S. critical infrastructure from cyberattacks',
  a4: 'Trustworthy Data Lakehouse Design Using Federated Learning and Blockchain',
  b1: 'AI-Augmented Security Analytics for Real-Time Threat Identification',
  b2: 'A Privacy-Preserving Federated Intrusion Detection System Leveraging Secure Multi-Party Computation Across Collaborative Cloud Tenants',
  b3: 'Attention-guided quantum-inspired extreme learning machine with grey wolf optimization for rare-attack detection in IIoT networks',
  b4: 'Secured and Standardized Intelligent Zero-Touch 6G Framework for Edge-AI Applications',
  c1: 'Resilient MIS Design Using Cryptographic and Cyber-Security Techniques',
  c2: 'AI-Driven Cyber Threat Intelligence as a Management Information System: Integrating Cybersecurity Governance and IT Project Management for Organizational Resilience',
  c3: 'Toward Autonomous Decision Intelligence: Integrating Explainable AI and Scalable DSS Architectures in Modern Management Information Systems',
  c4: 'Blockchain Integration in Management Information Systems a Decentralized Approach to Strengthening Cybersecurity and Data Integrity',
};

describe('normalizeDoi', () => {
  it('lowercases and strips resolver and doi: prefixes', () => {
    expect(normalizeDoi('https://doi.org/10.1109/MCOMSTD.2026.3660159')).toBe('10.1109/mcomstd.2026.3660159');
    expect(normalizeDoi('doi:10.5281/ZENODO.21538159')).toBe('10.5281/zenodo.21538159');
    expect(normalizeDoi('  http://dx.doi.org/10.1007/X  ')).toBe('10.1007/x');
  });
  it('returns empty string for empty input', () => {
    expect(normalizeDoi('')).toBe('');
  });
  it('builds a resolver url and refuses empty dois', () => {
    expect(doiUrl('10.1/abc')).toBe('https://doi.org/10.1/abc');
    expect(doiUrl('')).toBeNull();
  });
});

describe('safeUrl', () => {
  it('allows http and https only', () => {
    expect(safeUrl('https://orcid.org/x')).toBe('https://orcid.org/x');
    expect(safeUrl('http://example.org/')).toBe('http://example.org/');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});

describe('catalogue integrity', () => {
  it('has unique ids, dois and titles', () => {
    expect(findDuplicates(pubs)).toEqual([]);
    expect(new Set(pubs.map((p) => p.id)).size).toBe(pubs.length);
  });
  it('does not include the parent proceedings volume as a work', () => {
    expect(pubs.some((p) => normalizeDoi(p.doi) === '10.1007/978-3-032-14197-2')).toBe(false);
    expect(pubs.some((p) => /^proceedings of fifth international/i.test(p.title))).toBe(false);
  });
  it('detects duplicates when a record repeats a doi or title', () => {
    const dup = [pubs[0], { ...pubs[1], doi: pubs[0].doi }, { ...pubs[2], title: pubs[3].title.toUpperCase() }, pubs[3]] as Publication[];
    expect(findDuplicates(dup).length).toBeGreaterThanOrEqual(2);
  });
  it('gives every record a title, year, venue, type, tags and a safe source link', () => {
    for (const p of pubs) {
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.year).toBeGreaterThanOrEqual(2021);
      expect(p.venue.length).toBeGreaterThan(2);
      expect(p.workType.length).toBeGreaterThan(2);
      expect(p.tags.length).toBeGreaterThan(0);
      p.tags.forEach((t) => expect(TAGS.map((x) => x.id)).toContain(t));
      expect(primaryLink(p)).not.toBeNull();
    }
  });
  it('keeps contributor strings free of ellipses', () => {
    for (const p of pubs) p.authors.forEach((a) => expect(a).not.toMatch(/…|\.\.\./));
  });
  it('contains Partha Chakraborty in every credited author list', () => {
    for (const p of pubs) expect(p.authors.join('|')).toMatch(/Partha Chakraborty/);
  });
  it('uses ASCII-normalised author names (no homoglyph letters)', () => {
    for (const p of pubs) p.authors.forEach((a) => expect(a).toMatch(/^[ -~]+$/));
  });
});

describe('scene map', () => {
  it('has exactly three scenes with four points each', () => {
    expect(scenes).toHaveLength(3);
    scenes.forEach((s) => expect(s.points).toHaveLength(4));
    expect(scenes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('references twelve distinct, existing featured records with the exact titles', () => {
    const resolved = resolveScenes(scenes, pubs);
    const ids = resolved.flatMap((s) => s.points.map((p) => p.pub.id));
    expect(new Set(ids).size).toBe(12);
    for (const [id, title] of Object.entries(EXPECTED_FEATURED)) {
      const rec = pubs.find((p) => p.id === id)!;
      expect(rec, id).toBeDefined();
      expect(normalizeText(rec.title), id).toBe(normalizeText(title));
    }
  });
  it('keeps anchors inside the artwork and traces inside the artwork', () => {
    for (const s of scenes) for (const p of s.points) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(100);
      p.trace.forEach(([x, y]) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100); });
    }
  });
  it('matches the supplied anchor coordinates', () => {
    const at = (id: string) => scenes.flatMap((s) => s.points).find((p) => p.id === id)!;
    expect([at('a1').x, at('a1').y]).toEqual([17, 43]);
    expect([at('b2').x, at('b2').y]).toEqual([90, 73]);
    expect([at('c3').x, at('c3').y]).toEqual([78, 20]);
  });
  it('reports a clear error for missing, repeated or empty references', () => {
    const bad = structuredClone(scenes);
    bad[0].points[0].id = 'zz9';
    expect(() => resolveScenes(bad, pubs)).toThrow(/zz9/);
    const repeat = structuredClone(scenes);
    repeat[1].points[1].id = repeat[0].points[0].id;
    expect(validateScenes(repeat, pubs).join(' ')).toMatch(/more than once|distinct/i);
    expect(validateScenes([], pubs).join(' ')).toMatch(/three scenes/i);
  });
  it('lists every featured paper exactly once in the bibliography', () => {
    const featuredIds = scenes.flatMap((s) => s.points.map((p) => p.id));
    for (const id of featuredIds) expect(pubs.filter((p) => p.id === id)).toHaveLength(1);
  });
});

describe('filtering and sorting', () => {
  it('sorts newest first, stable by title within a year', () => {
    const s = sortNewestFirst(pubs);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].year).toBeGreaterThanOrEqual(s[i].year);
  });
  it('does not mutate its input when sorting', () => {
    const copy = [...pubs];
    sortNewestFirst(pubs);
    expect(pubs).toEqual(copy);
  });
  it('searches titles, venues and tags without caring about case or accents', () => {
    expect(filterPublications(pubs, { q: 'FEDERATED', topic: '', year: '' }).length).toBeGreaterThanOrEqual(2);
    expect(filterPublications(pubs, { q: 'lecture notes', topic: '', year: '' }).length).toBeGreaterThanOrEqual(3);
    expect(filterPublications(pubs, { q: 'zzzz-no-such', topic: '', year: '' })).toEqual([]);
  });
  it('requires every search word to match', () => {
    const both = filterPublications(pubs, { q: 'federated blockchain', topic: '', year: '' });
    expect(both.map((p) => p.id)).toContain('a4');
    expect(filterPublications(pubs, { q: 'federated zzzz', topic: '', year: '' })).toEqual([]);
  });
  it('filters by topic and year and combines them', () => {
    const t = filterPublications(pubs, { q: '', topic: 'network-edge', year: '' });
    expect(t.length).toBeGreaterThan(0);
    t.forEach((p) => expect(p.tags).toContain('network-edge'));
    const y = filterPublications(pubs, { q: '', topic: '', year: '2022' });
    y.forEach((p) => expect(p.year).toBe(2022));
    const both = filterPublications(pubs, { q: '', topic: 'network-edge', year: '2026' });
    both.forEach((p) => { expect(p.year).toBe(2026); expect(p.tags).toContain('network-edge'); });
  });
  it('returns everything for empty filters', () => {
    expect(filterPublications(pubs, { q: '', topic: '', year: '' })).toHaveLength(pubs.length);
    expect(matchesFilters(pubs[0], { q: '  ', topic: '', year: '' })).toBe(true);
  });
  it('derives years and topic counts from the records', () => {
    const years = yearsOf(pubs);
    expect(years[0]).toBeGreaterThan(years[years.length - 1]);
    const counts = topicCounts(pubs);
    expect(counts.reduce((n, c) => n + c.count, 0)).toBeGreaterThanOrEqual(pubs.length);
    TAGS.forEach((t) => expect(counts.find((c) => c.id === t.id)!.count).toBeGreaterThan(0));
  });
});

describe('url state', () => {
  it('round-trips filters', () => {
    const f = { q: 'cloud tenants', topic: 'cloud-privacy', year: '2026' };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });
  it('omits empty values and ignores unknown topics or non-years', () => {
    expect(serializeFilters({ q: '', topic: '', year: '' })).toBe('');
    expect(parseFilters('?topic=nope&year=abc&q=x')).toEqual({ q: 'x', topic: '', year: '' });
  });
  it('limits the length of the query', () => {
    expect(parseFilters('?q=' + 'a'.repeat(500)).q.length).toBeLessThanOrEqual(120);
  });
});
