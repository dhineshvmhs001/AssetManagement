const STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  PENDING_PRECHECK: 'PENDING_PRECHECK',
  MAINTENANCE: 'MAINTENANCE',
  DAMAGED: 'DAMAGED',
  LOST: 'LOST',
  RETIRED: 'RETIRED',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  PENDING_PRECHECK: 'Pending Pre-Check',
  MAINTENANCE: 'Under Maintenance',
  DAMAGED: 'Damaged',
  LOST: 'Lost',
  RETIRED: 'Retired',
};

const CONDITIONS = ['New', 'Good', 'Fair', 'Damaged'];
const ASSET_TYPES = ['Own', 'Rental'];
const CATEGORIES = ['Laptop', 'Monitor', 'Mouse', 'Keyboard', 'Phone'];

const CATEGORY_ABBREV = {
  Laptop: 'LP',
  Monitor: 'MN',
  Mouse: 'MS',
  Keyboard: 'KB',
  Phone: 'PH',
};

// Every value here must be distinct, or two brands share a code namespace.
// Logitech was 'LG', which collided with LG.
const BRAND_ABBREV = {
  Dell: 'DL',
  HP: 'HP',
  LG: 'LG',
  Logitech: 'LT',
  Samsung: 'SM',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function abbrev(text, mapped) {
  if (mapped && mapped[text]) {
    return mapped[text];
  }
  const clean = String(text || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return (clean.slice(0, 2) || 'XX').padEnd(2, 'X');
}

function prefixFor(category, brand) {
  return `${abbrev(category, CATEGORY_ABBREV)}-${abbrev(brand, BRAND_ABBREV)}`;
}

module.exports = {
  ...STATUS,
  STATUS,
  STATUS_LABELS,
  CONDITIONS,
  ASSET_TYPES,
  CATEGORIES,
  statusLabel,
  abbrev,
  prefixFor,
};
