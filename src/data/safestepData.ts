import {
  AlertKind,
  BandEdition,
  BandEditionId,
  LatLngTuple,
  LiveAlert,
  LiveBandState,
} from '../types/safestep';

// Default real indoor mall/campus coordinate anchor (updated automatically when real GPS locks)
export const DEFAULT_ORIGIN: LatLngTuple = [30.0298, 31.4067];

export const ADMIN_UNLOCK_PIN = '1234';

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

export function isValidLatLng(value: unknown): value is LatLngTuple {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

// Offset geographic coordinate by North (meters) and East (meters)
export function offsetLatLng(
  origin: LatLngTuple | null | undefined,
  northMeters: number,
  eastMeters: number
): LatLngTuple {
  const safeOrigin = isValidLatLng(origin) ? origin : DEFAULT_ORIGIN;
  const [lat, lng] = safeOrigin;
  const dLat = northMeters / 111320;
  const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const dLng = eastMeters / (111320 * cosLat);
  return [
    Number((lat + dLat).toFixed(7)),
    Number((lng + dLng).toFixed(7)),
  ];
}

// Step dead-reckoning: move distanceM along compass heading (0 = North, 90 = East, 180 = South, 270 = West)
export function stepAlongHeading(
  pos: LatLngTuple | null | undefined,
  headingDeg: number,
  distanceM: number
): LatLngTuple {
  const safePos = isValidLatLng(pos) ? pos : DEFAULT_ORIGIN;
  const rad = (headingDeg * Math.PI) / 180;
  const north = Math.cos(rad) * distanceM;
  const east = Math.sin(rad) * distanceM;
  return offsetLatLng(safePos, north, east);
}

// Virtual Exit Gate geofence placed 12m North-East of origin
export function computeGateCoords(
  origin: LatLngTuple | null | undefined
): LatLngTuple {
  return offsetLatLng(origin, 8.5, 8.5);
}

// Exact Haversine distance in meters (1 decimal precision)
export function haversineMeters(
  a: LatLngTuple | null | undefined,
  b: LatLngTuple | null | undefined
): number {
  if (!isValidLatLng(a) || !isValidLatLng(b)) {
    return 0;
  }
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Math.round(R * c * 10) / 10;
}

export function deriveZoneLabel(
  childCoords: LatLngTuple | null | undefined,
  parentCoords: LatLngTuple | null | undefined,
  gateCoords: LatLngTuple | null | undefined,
  safeLimitM: number
): { label: string; nearGate: boolean; distParent: number; distGate: number } {
  const safeParent = isValidLatLng(parentCoords) ? parentCoords : DEFAULT_ORIGIN;
  const safeChild = isValidLatLng(childCoords)
    ? childCoords
    : offsetLatLng(safeParent, 1.5, 1.2);
  const safeGate = isValidLatLng(gateCoords)
    ? gateCoords
    : computeGateCoords(safeParent);
  const limit =
    typeof safeLimitM === 'number' && Number.isFinite(safeLimitM) && safeLimitM > 0
      ? safeLimitM
      : 15;

  const distParent = haversineMeters(safeParent, safeChild);
  const distGate = haversineMeters(safeGate, safeChild);

  if (distGate <= 3.5) {
    return {
      label: 'بوابة الخروج',
      nearGate: true,
      distParent,
      distGate,
    };
  }
  if (distParent <= limit * 0.5) {
    return {
      label: 'النطاق الآمن',
      nearGate: false,
      distParent,
      distGate,
    };
  }
  if (distParent <= limit) {
    return {
      label: 'حافة النطاق',
      nearGate: false,
      distParent,
      distGate,
    };
  }
  return {
    label: 'خارج النطاق',
    nearGate: false,
    distParent,
    distGate,
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

export function buildParentQrUrl(baseUrl: string, bandId: string): string {
  return `${normalizeBaseUrl(baseUrl)}?role=parent&b=${encodeURIComponent(bandId)}`;
}

export function buildBandQrUrl(baseUrl: string, bandId: string): string {
  return `${normalizeBaseUrl(baseUrl)}?role=band&b=${encodeURIComponent(bandId)}`;
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function generateBandId(editionId: BandEditionId): string {
  const ed = getEditionById(editionId);
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${ed.prefix}-${num}`;
}

export function createNewAlertId(): number {
  return Date.now() + Math.floor(Math.random() * 999);
}

export function createInitialBandState(params: {
  bandId: string;
  childName: string;
  editionId: BandEditionId;
  guardianPhone: string;
  pinCode: string;
  safeLimitM: number;
  origin: LatLngTuple;
  senderId: string;
}): LiveBandState {
  const now = Date.now();
  const childStart = offsetLatLng(params.origin, 1.5, 1.2);
  const gateCoords = computeGateCoords(params.origin);
  const dist = haversineMeters(params.origin, childStart);

  return {
    bandId: params.bandId,
    childName: params.childName,
    editionId: params.editionId,
    guardianPhone: params.guardianPhone,
    pinCode: params.pinCode,
    lockStatus: 'locked',
    isReturned: false,
    safeLimitM: params.safeLimitM,
    createdAt: now,
    lastUpdated: now,
    eventId: now,
    senderId: params.senderId,
    originCoords: params.origin,
    parentCoords: params.origin,
    childCoords: childStart,
    gateCoords,
    pathHistory: [params.origin, childStart],
    steps: 0,
    headingDeg: 45,
    distanceMeters: dist,
    gpsSource: 'fusion',
    currentZoneLabel: 'النطاق الآمن',
    activeAlert: null,
  };
}

export function createDemoBand(senderId: string): LiveBandState {
  return createInitialBandState({
    bandId: 'SKB-4092',
    childName: 'آدم',
    editionId: 'batman',
    guardianPhone: '',
    pinCode: '4821',
    safeLimitM: 15,
    origin: DEFAULT_ORIGIN,
    senderId,
  });
}

const VALID_EDITION_IDS = new Set<BandEditionId>([
  'batman',
  'spider',
  'astro',
  'frost',
]);

const VALID_ALERT_KINDS = new Set<AlertKind>([
  'TAMPER_ATTEMPT',
  'GATE_PROXIMITY',
  'DISTANCE_BREACH',
]);

function sanitizeAlert(raw: unknown): LiveAlert | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const type = obj.type as AlertKind;
  if (!VALID_ALERT_KINDS.has(type)) return null;
  const ts =
    typeof obj.ts === 'number' && Number.isFinite(obj.ts) ? obj.ts : Date.now();
  const alertId =
    typeof obj.alertId === 'number' && Number.isFinite(obj.alertId)
      ? obj.alertId
      : ts;

  return {
    alertId,
    type,
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title : 'تنبيه أمني',
    locationLabel:
      typeof obj.locationLabel === 'string' && obj.locationLabel.trim()
        ? obj.locationLabel
        : 'خارج النطاق',
    distanceM:
      typeof obj.distanceM === 'number' && Number.isFinite(obj.distanceM)
        ? obj.distanceM
        : 0,
    ts,
    acknowledged: Boolean(obj.acknowledged),
    securityNotified: Boolean(obj.securityNotified),
  };
}

// Validates and normalizes incoming MQTT / BroadcastChannel / localStorage payloads.
// Rejects legacy pre-Leaflet payloads missing valid geographic coordinate tuples.
export function sanitizeBandState(raw: unknown): LiveBandState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.bandId !== 'string' || !obj.bandId.trim()) return null;
  const bandId = obj.bandId.trim().toUpperCase();
  const isReturned = Boolean(obj.isReturned);

  const parentCoords: LatLngTuple | null = isValidLatLng(obj.parentCoords)
    ? [obj.parentCoords[0], obj.parentCoords[1]]
    : null;
  const childCoords: LatLngTuple | null = isValidLatLng(obj.childCoords)
    ? [obj.childCoords[0], obj.childCoords[1]]
    : null;

  // Drop stale pre-Leaflet active payloads so they never overwrite v2 Leaflet state
  if (!isReturned && (!childCoords || !parentCoords)) {
    return null;
  }

  const resolvedParent: LatLngTuple = parentCoords ?? DEFAULT_ORIGIN;
  const resolvedChild: LatLngTuple =
    childCoords ?? offsetLatLng(resolvedParent, 1.5, 1.2);
  const originCoords: LatLngTuple = isValidLatLng(obj.originCoords)
    ? [obj.originCoords[0], obj.originCoords[1]]
    : resolvedParent;
  const gateCoords: LatLngTuple = isValidLatLng(obj.gateCoords)
    ? [obj.gateCoords[0], obj.gateCoords[1]]
    : computeGateCoords(originCoords);

  const rawHistory = Array.isArray(obj.pathHistory)
    ? obj.pathHistory.filter((pt): pt is LatLngTuple => isValidLatLng(pt))
    : [];
  const pathHistory: LatLngTuple[] =
    rawHistory.length >= 2 ? rawHistory : [resolvedParent, resolvedChild];

  const editionCandidate = obj.editionId as BandEditionId;
  const editionId: BandEditionId = VALID_EDITION_IDS.has(editionCandidate)
    ? editionCandidate
    : 'batman';

  const safeLimitM =
    typeof obj.safeLimitM === 'number' &&
    Number.isFinite(obj.safeLimitM) &&
    obj.safeLimitM > 0
      ? obj.safeLimitM
      : 15;

  const now = Date.now();
  const createdAt =
    typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
      ? obj.createdAt
      : now;
  const lastUpdated =
    typeof obj.lastUpdated === 'number' && Number.isFinite(obj.lastUpdated)
      ? obj.lastUpdated
      : now;
  const eventId =
    typeof obj.eventId === 'number' && Number.isFinite(obj.eventId)
      ? obj.eventId
      : lastUpdated;

  const zoneInfo = deriveZoneLabel(
    resolvedChild,
    resolvedParent,
    gateCoords,
    safeLimitM
  );

  return {
    bandId,
    childName:
      typeof obj.childName === 'string' && obj.childName.trim()
        ? obj.childName.trim()
        : 'طفل',
    editionId,
    guardianPhone:
      typeof obj.guardianPhone === 'string' ? obj.guardianPhone : '',
    pinCode:
      typeof obj.pinCode === 'string' && obj.pinCode.trim()
        ? obj.pinCode.trim()
        : '4821',
    lockStatus: obj.lockStatus === 'unlocked' ? 'unlocked' : 'locked',
    isReturned,
    safeLimitM,
    createdAt,
    lastUpdated,
    eventId,
    senderId: typeof obj.senderId === 'string' ? obj.senderId : '',
    originCoords,
    parentCoords: resolvedParent,
    childCoords: resolvedChild,
    gateCoords,
    pathHistory,
    steps:
      typeof obj.steps === 'number' && Number.isFinite(obj.steps) && obj.steps >= 0
        ? Math.round(obj.steps)
        : 0,
    headingDeg:
      typeof obj.headingDeg === 'number' && Number.isFinite(obj.headingDeg)
        ? obj.headingDeg
        : 45,
    distanceMeters:
      typeof obj.distanceMeters === 'number' &&
      Number.isFinite(obj.distanceMeters) &&
      obj.distanceMeters >= 0
        ? obj.distanceMeters
        : zoneInfo.distParent,
    gpsSource: obj.gpsSource === 'gps' ? 'gps' : 'fusion',
    currentZoneLabel:
      typeof obj.currentZoneLabel === 'string' && obj.currentZoneLabel.trim()
        ? obj.currentZoneLabel.trim()
        : zoneInfo.label,
    activeAlert: isReturned ? null : sanitizeAlert(obj.activeAlert),
  };
}
