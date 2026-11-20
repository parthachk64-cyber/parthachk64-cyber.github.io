import type * as THREE from 'three';
import type { Kit, Vec3 } from './kit';

export interface SceneBuild {
  /** Camera position, look-at target and vertical field of view. */
  camera: { pos: Vec3; target: Vec3; fov: number };
  /** World-space anchor for each hotspot id. Anchors are static so buttons stay put. */
  anchors: Record<string, THREE.Vector3>;
  /** Route a selection pulse travels for each hotspot id (editorial association, not data flow). */
  routes: Record<string, THREE.Curve<THREE.Vector3>>;
  /** Advance ambient animation. `motion` false means hold a still pose. */
  update(t: number, dt: number, motion: boolean): void;
  /** Optional emphasis of the object under a hotspot. */
  emphasise?(pt: string | null): void;
  bloom?: { strength: number; radius: number; threshold: number };
}

export type BuildFn = (scene: THREE.Scene, kit: Kit) => SceneBuild;
