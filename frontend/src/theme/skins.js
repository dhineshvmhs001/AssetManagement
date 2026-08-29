export const SKINS = [
  'default',
  'mhs',
  'nord',
  'catppuccin',
  'tokyo',
  'github',
  'linear',
  'dracula',
  'rosepine',
  'everforest',
  'gruvbox',
  'solarized',
  'vercel',
  'gold-sweet',
  'gold-rugged',
  'gold-jewel',
  'crm',
];

export function normalizeSkin(value) {
  const raw = String(value || '').trim().toLowerCase();
  return SKINS.includes(raw) ? raw : 'default';
}
