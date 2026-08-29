export const SKINS = [
  'default',
  'minimal',
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

export const SKIN_META = [
  { id: 'default', label: 'Default', from: '#7c3aed', to: '#ec4899' },
  { id: 'minimal', label: 'Minimal', from: '#171717', to: '#a3a3a3' },
  { id: 'mhs', label: 'MHS', from: '#0f6268', to: '#1e4063' },
  { id: 'nord', label: 'Nord', from: '#88c0d0', to: '#5e81ac' },
  { id: 'catppuccin', label: 'Catppuccin', from: '#cba6f7', to: '#f38ba8' },
  { id: 'tokyo', label: 'Tokyo', from: '#7aa2f7', to: '#bb9af7' },
  { id: 'github', label: 'GitHub', from: '#0969da', to: '#1f6feb' },
  { id: 'linear', label: 'Linear', from: '#5e6ad2', to: '#8b87ff' },
  { id: 'dracula', label: 'Dracula', from: '#bd93f9', to: '#ff79c6' },
  { id: 'rosepine', label: 'Rosé Pine', from: '#c4a7e7', to: '#ebbcba' },
  { id: 'everforest', label: 'Everforest', from: '#a7c080', to: '#7fbbb3' },
  { id: 'gruvbox', label: 'Gruvbox', from: '#fabd2f', to: '#fe8019' },
  { id: 'solarized', label: 'Solarized', from: '#268bd2', to: '#2aa198' },
  { id: 'vercel', label: 'Vercel', from: '#0070f3', to: '#7928ca' },
  { id: 'gold-sweet', label: 'Gold Sweet', from: '#f0b429', to: '#c98912' },
  { id: 'gold-rugged', label: 'Gold Rugged', from: '#c98912', to: '#7a5a12' },
  { id: 'gold-jewel', label: 'Gold Jewel', from: '#ffd56a', to: '#f0b429' },
  { id: 'crm', label: 'CRM', from: '#2563eb', to: '#0ea5e9' },
];

export function normalizeSkin(value) {
  const raw = String(value || '').trim().toLowerCase();
  return SKINS.includes(raw) ? raw : 'default';
}
