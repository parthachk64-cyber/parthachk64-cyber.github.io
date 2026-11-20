import type { Publication } from './catalogue';
import type { SceneDef, ScenePoint } from '../data/scenes';

export interface ResolvedPoint extends ScenePoint {
  pub: Publication;
}
export interface ResolvedScene extends Omit<SceneDef, 'points'> {
  points: ResolvedPoint[];
}

export function validateScenes(scenes: readonly SceneDef[], pubs: readonly Publication[]): string[] {
  const errors: string[] = [];
  if (scenes.length !== 3) errors.push(`Expected three scenes, found ${scenes.length}`);
  const used = new Set<string>();
  for (const s of scenes) {
    if (s.points.length !== 4) errors.push(`Scene ${s.id} must have four points`);
    for (const p of s.points) {
      if (!pubs.some((x) => x.id === p.id)) errors.push(`Scene ${s.id}: unknown publication ${p.id}`);
      if (used.has(p.id)) errors.push(`Publication ${p.id} is used more than once; featured papers must be distinct`);
      used.add(p.id);
    }
  }
  return errors;
}

export function resolveScenes(scenes: readonly SceneDef[], pubs: readonly Publication[]): ResolvedScene[] {
  const errors = validateScenes(scenes, pubs);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return scenes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p, pub: pubs.find((x) => x.id === p.id) as Publication })),
  }));
}
