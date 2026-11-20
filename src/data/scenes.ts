// Scene map. Anchors are percentages of the uncropped image, measured from the top left.
// Traces are editorial topic associations drawn over the artwork, not measured data flow.
// Edit x / y / trace here, then rebuild. Publication ids refer to src/data/publications.json.

export interface ScenePoint {
  id: string;
  label: string;
  question?: string;
  x: number;
  y: number;
  trace: Array<[number, number]>;
  labelSide?: 'left' | 'right';
  /** Ring radius as a percentage of the longer image side. */
  ring?: number;
}

export interface SceneDef {
  id: 'a' | 'b' | 'c';
  heading: string;
  kicker: string;
  image: { src: string; srcset?: string; width: number; height: number; alt: string };
  caption: string;
  defaultPoint: string;
  points: ScenePoint[];
}

export const scenes: SceneDef[] = [
  {
    id: 'a',
    kicker: 'Plate A',
    heading: 'How can AI help defend critical infrastructure?',
    image: {
      src: 'images/scene-a.webp',
      srcset: 'images/scene-a-768.webp 768w, images/scene-a.webp 1536w',
      width: 1536,
      height: 1024,
      alt: 'Illustration of a small robot leaving a glass box of sand that carries a shield mark, with a stream of blue light reaching server racks, a database and data cards.',
    },
    caption: 'Illustration. Lines mark editorial topic associations, not measured data flow.',
    defaultPoint: 'a2',
    points: [
      { id: 'a1', label: 'Cloud data protection', x: 17, y: 43, trace: [[27, 30], [22, 37], [17, 43]] },
      { id: 'a2', label: 'Threat prediction', x: 52, y: 42, trace: [[49.5, 42.5], [52, 42], [58, 41.2]] },
      { id: 'a3', label: 'Infrastructure defense', x: 68, y: 30, trace: [[58, 41.2], [64, 38], [67, 34], [68, 30]] },
      { id: 'a4', label: 'Trusted data', x: 78, y: 38, trace: [[62, 40.5], [70, 39.2], [78, 38]] },
    ],
  },
  {
    id: 'b',
    kicker: 'Plate B',
    heading: 'Where can a network identify a threat?',
    image: {
      src: 'images/scene-b.webp',
      width: 640,
      height: 480,
      alt: 'Illustration of a robotic fingertip touching a glowing blue shield with a keyhole, surrounded by security and network icons.',
    },
    caption: 'Illustration. Lines mark editorial topic associations, not measured data flow.',
    defaultPoint: 'b1',
    points: [
      { id: 'b1', label: 'Security analytics', x: 48, y: 54, trace: [], ring: 4 },
      { id: 'b2', label: 'Collaborative cloud', x: 90, y: 73, trace: [[48, 54], [62, 66], [76, 70], [90, 73]], labelSide: 'left' },
      { id: 'b3', label: 'Industrial networks', x: 76, y: 81, trace: [[48, 54], [44, 68], [48, 82], [58, 90], [68, 88], [76, 81]], labelSide: 'left' },
      { id: 'b4', label: 'Edge AI and 6G', x: 65, y: 8, trace: [[48, 54], [43, 43], [47, 28], [53, 15], [65, 8]] },
    ],
  },
  {
    id: 'c',
    kicker: 'Plate C',
    heading: 'How does security evidence inform decisions?',
    image: {
      src: 'images/scene-c.webp',
      width: 576,
      height: 324,
      alt: 'Illustration of a glowing padlock inside a shield on a circuit board, flanked by two clouds labelled AI.',
    },
    caption: 'Illustration. Lines mark editorial topic associations, not measured data flow.',
    defaultPoint: 'c1',
    points: [
      { id: 'c1', label: 'Cyber resilience', x: 52, y: 51, trace: [], ring: 10 },
      { id: 'c2', label: 'Threat intelligence', x: 27, y: 20, trace: [[52, 51], [44, 51], [40, 36], [27, 26], [27, 20]] },
      { id: 'c3', label: 'Explainable decisions', x: 78, y: 20, trace: [[52, 51], [60, 42], [70, 30], [78, 24], [78, 20]], labelSide: 'left' },
      { id: 'c4', label: 'Data integrity', x: 75, y: 61, trace: [[52, 51], [64, 56], [75, 61]], labelSide: 'left' },
    ],
  },
];
