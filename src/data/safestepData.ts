import {
  BandEdition,
  BandEditionId,
  GpsPoint,
  LiveBandState,
  MallZone,
  Point2D,
} from '../types/safestep';

export const BAND_EDITIONS: BandEdition[] = [
  {
    id: 'batman',
    shortName: 'باتمان',
    englishName: 'Batman',
    swatch: '#1E293B',
    imageUrl: '/src/assets/images/band_batman_edition_1795653233076.jpg',
    prefix: 'SKB',
  },
  {
    id: 'spider',
    shortName: 'سبايدرمان',
    englishName: 'Spider',
    swatch: '#B91C1C',
    imageUrl: '/src/assets/images/band_spider_edition_1795653234115.jpg',
    prefix: 'SKS',
  },
  {
    id: 'astro',
    shortName: 'الفضاء',
    englishName: 'Astro',
    swatch: '#334155',
    imageUrl: '/src/assets/images/band_astro_edition_1795653234540.jpg',
    prefix: 'SKA',
  },
  {
    id: 'frost',
    shortName: 'الجليد',
    englishName: 'Frost',
    swatch: '#64748B',
    imageUrl: '/src/assets/images/band_frost_edition_1795653236167.jpg',
    prefix: 'SKF',
  },
];

export function getEditionById(id: BandEditionId): BandEdition {
  return BAND_EDITIONS.find((e) => e.id === id) ?? BAND_EDITIONS[0];
}

export const MALL_MAP_WIDTH = 800;
export const MALL_MAP_HEIGHT = 500;
export const PARENT_DEFAULT_POS: Point2D = { x: 400, y: 260 };

export const MALL_ZONES: MallZone[] = [
  {
    id: 'exit_1',
    nameAr: 'بوابة 1',
    type: 'exit',
    bounds: { x: 310, y: 12, width: 180, height: 54 },
    center: { x: 400, y: 39 },
  },
  {
    id: 'exit_2',
    nameAr: 'بوابة 2',
    type: 'exit',
    bounds: { x: 716, y: 175, width: 72, height: 150 },
    center: { x: 752, y: 250 },
  },
  {
    id: 'exit_3',
    nameAr: 'بوابة 3',
    type: 'exit',
    bounds: { x: 310, y: 434, width: 180, height: 54 },
    center: { x: 400, y: 461 },
  },
  {
    id: 'exit_4',
    nameAr: 'بوابة 4',
    type: 'exit',
    bounds: { x: 12, y: 175, width: 72, height: 150 },
    center: { x: 48, y: 250 },
  },
  {
    id: 'kids_arena',
    nameAr: 'الألعاب',
    type: 'interior',
    bounds: { x: 492, y: 80, width: 210, height: 164 },
    center: { x: 597, y: 162 },
  },
  {
    id: 'food_court',
    nameAr: 'المطاعم',
    type: 'interior',
    bounds: { x: 98, y: 80, width: 210, height: 164 },
    center: { x: 203, y: 162 },
  },
  {
    id: 'atrium',
    nameAr: 'الممر الرئيسي',
    type: 'interior',
    bounds: { x: 320, y: 80, width: 160, height: 210 },
    center: { x: 400, y: 185 },
  },
  {
    id: 'anchor_stores',
    nameAr: 'المتاجر',
    type: 'interior',
    bounds: { x: 98, y: 304, width: 604, height: 116 },
    center: { x: 400, y: 362 },
  },
];

export function detectZone(pos: Point2D): MallZone {
  for (const z of MALL_ZONES) {
    if (z.type !== 'exit') continue;
    const pad = 10;
    if (
      pos.x >= z.bounds.x - pad &&
      pos.x <= z.bounds.x + z.bounds.width + pad &&
      pos.y >= z.bounds.y - pad &&
      pos.y <= z.bounds.y + z.bounds.height + pad
    ) {
      return z;
    }
  }
  for (const z of MALL_ZONES) {
    if (z.type !== 'interior') continue;
    if (
      pos.x >= z.bounds.x &&
      pos.x <= z.bounds.x + z.bounds.width &&
      pos.y >= z.bounds.y &&
      pos.y <= z.bounds.y + z.bounds.height
    ) {
      return z;
    }
  }
  return MALL_ZONES[6];
}

export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

export function computeEffectiveDistance(band: LiveBandState): {
  meters: number;
  source: 'gps' | 'indoor';
} {
  const now = Date.now();
  const FRESH_MS = 120_000;
  if (
    band.coords.band &&
    band.coords.parent &&
    now - band.coords.band.ts < FRESH_MS &&
    now - band.coords.parent.ts < FRESH_MS
  ) {
    return {
      meters: haversineMeters(band.coords.band, band.coords.parent),
      source: 'gps',
    };
  }
  return {
    meters: Math.max(0, Math.round(band.distanceMeters)),
    source: 'indoor',
  };
}

export function distanceToMapPosition(distanceM: number): Point2D {
  const clamped = Math.max(0, Math.min(35, distanceM));
  const t = clamped / 35;
  if (t <= 0.65) {
    const k = t / 0.65;
    return {
      x: Math.round(415 + k * 215),
      y: Math.round(235 - k * 65),
    };
  }
  const k = (t - 0.65) / 0.35;
  return {
    x: Math.round(630 + k * 90),
    y: Math.round(170 + k * 75),
  };
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://safestep.app/';
  }
  return trimmed.split('?')[0].split('#')[0];
}

export function buildParentBandUrl(baseUrl: string, bandId: string): string {
  return `${normalizeBaseUrl(baseUrl)}?b=${encodeURIComponent(bandId)}`;
}

export function buildWristbandUrl(baseUrl: string, bandId: string): string {
  return `${normalizeBaseUrl(baseUrl)}?w=${encodeURIComponent(bandId)}`;
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function generateBandId(editionId: BandEditionId): string {
  const ed = getEditionById(editionId);
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${ed.prefix}-${num}`;
}

export function createDemoBand(senderId: string): LiveBandState {
  const now = Date.now();
  return {
    bandId: 'SKB-4092',
    childName: 'آدم',
    editionId: 'batman',
    guardianPhone: '',
    pinCode: '4821',
    lockStatus: 'locked',
    isReturned: false,
    safeLimitM: 15,
    createdAt: now - 12 * 60 * 1000,
    lastUpdated: now,
    senderId,
    currentZone: 'atrium',
    mapPos: { x: 435, y: 225 },
    parentMapPos: PARENT_DEFAULT_POS,
    pathHistory: [
      { x: 400, y: 255 },
      { x: 418, y: 240 },
      { x: 435, y: 225 },
    ],
    steps: 24,
    distanceMeters: 4,
    coords: { band: null, parent: null },
    activeAlert: null,
  };
}
