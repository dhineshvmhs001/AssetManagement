export const LOADERS = [
  { id: 0, name: 'No loading', kind: 'none' },
  { id: 26, name: 'Minimal', kind: 'minimal' },
  { id: 1, name: 'Pulse', kind: 'pulse' },
  { id: 2, name: 'Ring', kind: 'ring' },
  { id: 3, name: 'Bounce', kind: 'bounce' },
  { id: 4, name: 'Shine', kind: 'shine' },
  { id: 5, name: 'Orbit', kind: 'orbit' },
  { id: 6, name: 'Aurora', kind: 'aurora' },
  { id: 7, name: 'Sonar', kind: 'sonar' },
  { id: 8, name: 'Arc Trace', kind: 'arc' },
  { id: 9, name: 'Morph', kind: 'morph' },
  { id: 10, name: 'Sweep', kind: 'sweep' },
  { id: 11, name: 'Prism', kind: 'prism' },
  { id: 12, name: 'Constellation', kind: 'constellation' },
  { id: 13, name: 'Equalizer', kind: 'equalizer' },
  { id: 14, name: 'Flip', kind: 'flip' },
  { id: 15, name: 'Butterfly', kind: 'butterfly' },
  { id: 16, name: 'Comet', kind: 'comet' },
  { id: 17, name: 'Radar', kind: 'radar' },
  { id: 18, name: 'Liquid', kind: 'liquid' },
  { id: 19, name: 'Fireflies', kind: 'fireflies' },
  { id: 20, name: 'Bloom', kind: 'bloom' },
  { id: 21, name: 'Helix', kind: 'helix' },
  { id: 22, name: 'Vinyl', kind: 'vinyl' },
  { id: 23, name: 'Butterfly Roam', kind: 'roam' },
  { id: 24, name: 'Butterfly Hover', kind: 'hover' },
  { id: 25, name: 'Catch Butterfly', kind: 'catch' },
];

export const LOADER_KINDS = LOADERS.map((item) => item.kind);
export const DEFAULT_LOADER = 'pulse';

export function normalizeLoader(kind) {
  return LOADER_KINDS.includes(kind) ? kind : DEFAULT_LOADER;
}
