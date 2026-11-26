import {
  AlertKind,
  BandEdition,
  BandEditionId,
  LiveAlert,
  LiveBandState,
  MallPoint,
  RecoveryNotice,
} from '../types/safestep';

// Exact logical architectural mall floorplan dimensions (in meters; 1m = 10 SVG units)
export const MALL_WIDTH_M = 100;
export const MALL_HEIGHT_M = 64;

export const DEFAULT_PARENT_POS: MallPoint = { x: 52, y: 32 };
export const DEFAULT_CHILD_POS: MallPoint = { x: 55.5, y: 30.5 };

export interface MallZoneDef {
  id: string;
  nameAr: string;
  subtitleEn: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  labelColor: string;
}

export interface MallGateDef {
  id: number;
  nameAr: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  approachPoint: MallPoint;
}

export const MALL_ZONES: MallZoneDef[] = [
  {
    id: 'kids_arena',
    nameAr: 'منطقة ألعاب الأطفال',
    subtitleEn: 'Kids Arena',
    x: 61,
    y: 6,
    w: 32,
    h: 21,
    fill: 'rgba(224, 242, 254, 0.85)',
    stroke: 'rgba(14, 165, 233, 0.32)',
    labelColor: '#0369A1',
  },
  {
    id: 'food_court',
    nameAr: 'منطقة المطاعم والكافيهات',
    subtitleEn: 'Food Court',
    x: 7,
    y: 6,
    w: 32,
    h: 21,
    fill: 'rgba(254, 243, 199, 0.82)',
    stroke: 'rgba(217, 119, 6, 0.28)',
    labelColor: '#B45309',
  },
  {
    id: 'shops_east',
    nameAr: 'المتاجر والسينما',
    subtitleEn: 'Cinema & Retail',
    x: 61,
    y: 37,
    w: 32,
    h: 21,
    fill: 'rgba(236, 253, 245, 0.78)',
    stroke: 'rgba(16, 185, 129, 0.26)',
    labelColor: '#047857',
  },
  {
    id: 'shops_west',
    nameAr: 'المتاجر والسينما',
    subtitleEn: 'Retail Wing',
    x: 7,
    y: 37,
    w: 32,
    h: 21,
    fill: 'rgba(241, 245, 249, 0.88)',
    stroke: 'rgba(100, 116, 139, 0.28)',
    labelColor: '#334155',
  },
  {
    id: 'smart_booth',
    nameAr: 'البوث الذكي - نقطة الأمان',
    subtitleEn: 'SafeStep Atrium',
    x: 42,
    y: 25,
    w: 16,
    h: 14,
    fill: 'rgba(255, 255, 255, 0.92)',
    stroke: 'rgba(14, 165, 233, 0.42)',
    labelColor: '#0F172A',
  },
];

export const MALL_GATES: MallGateDef[] = [
  {
    id: 1,
    nameAr: 'بوابة 1',
    x1: 44,
    y1: 4.2,
    x2: 56,
    y2: 4.2,
    labelX: 50,
    labelY: 2.3,
    approachPoint: { x: 50, y: 6.2 },
  },
  {
    id: 2,
    nameAr: 'بوابة 2',
    x1: 95.8,
    y1: 26,
    x2: 95.8,
    y2: 38,
    labelX: 93.2,
    labelY: 24.4,
    approachPoint: { x: 93.6, y: 32 },
  },
  {
    id: 3,
    nameAr: 'بوابة 3',
    x1: 44,
    y1: 59.8,
    x2: 56,
    y2: 59.8,
    labelX: 50,
    labelY: 62.1,
    approachPoint: { x: 50, y: 57.6 },
  },
  {
    id: 4,
    nameAr: 'بوابة 4',
    x1: 4.2,
    y1: 26,
    x2: 4.2,
    y2: 38,
    labelX: 6.8,
    labelY: 24.4,
    approachPoint: { x: 6.4, y: 32 },
  },
];

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

export function isValidMallPoint(value: unknown): value is MallPoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y)
  );
}

export function clampMallPoint(p: MallPoint): MallPoint {
  return {
    x: Number(Math.max(4.8, Math.min(MALL_WIDTH_M - 4.8, p.x)).toFixed(2)),
    y: Number(Math.max(4.8, Math.min(MALL_HEIGHT_M - 4.8, p.y)).toFixed(2)),
  };
}

export function mallDistanceMeters(
  a: MallPoint | null | undefined,
  b: MallPoint | null | undefined
): number {
  if (!isValidMallPoint(a) || !isValidMallPoint(b)) return 0;
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10;
}

function pointToSegmentDistance(
  p: MallPoint,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - x1, p.y - y1);
  let t = ((p.x - x1) * dx + (p.y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function detectMallZone(pos: MallPoint): string {
  for (const z of MALL_ZONES) {
    if (
      pos.x >= z.x &&
      pos.x <= z.x + z.w &&
      pos.y >= z.y &&
      pos.y <= z.y + z.h
    ) {
      return z.nameAr;
    }
  }
  return 'الممر الرئيسي للمول';
}

export function evaluateMallPosition(
  childPos: MallPoint | null | undefined,
  parentPos: MallPoint | null | undefined,
  safeLimitM: number
): {
  zoneName: string;
  distParent: number;
  nearestGate: MallGateDef | null;
  nearestGateDist: number;
  nearGate: boolean;
  outsideSafe: boolean;
} {
  const safeParent = isValidMallPoint(parentPos)
    ? parentPos
    : DEFAULT_PARENT_POS;
  const safeChild = isValidMallPoint(childPos) ? childPos : DEFAULT_CHILD_POS;
  const limit =
    typeof safeLimitM === 'number' && Number.isFinite(safeLimitM) && safeLimitM > 0
      ? safeLimitM
      : 15;

  const distParent = mallDistanceMeters(safeParent, safeChild);

  let nearestGate: MallGateDef | null = null;
  let nearestGateDist = Infinity;
  for (const gate of MALL_GATES) {
    const d = pointToSegmentDistance(
      safeChild,
      gate.x1,
      gate.y1,
      gate.x2,
      gate.y2
    );
    if (d < nearestGateDist) {
      nearestGateDist = d;
      nearestGate = gate;
    }
  }

  const nearGate = nearestGateDist <= 4.8;
  const zoneName =
    nearGate && nearestGate
      ? `بوابة الخروج ${nearestGate.id}`
      : detectMallZone(safeChild);

  return {
    zoneName,
    distParent,
    nearestGate,
    nearestGateDist: Math.round(nearestGateDist * 10) / 10,
    nearGate,
    outsideSafe: distParent > limit,
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
  return `${normalizeBaseUrl(baseUrl)}?p=${encodeURIComponent(bandId)}`;
}

export function buildBandQrUrl(baseUrl: string, bandId: string): string {
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

export function createNewAlertId(): number {
  return Date.now() + Math.floor(Math.random() * 999);
}

export function formatArabicTime(ts?: number): string {
  const d = new Date(ts ?? Date.now());
  try {
    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return d.toTimeString().slice(0, 8);
  }
}

export function createInitialBandState(params: {
  bandId: string;
  childName: string;
  editionId: BandEditionId;
  guardianPhone: string;
  pinCode: string;
  safeLimitM: number;
  senderId: string;
}): LiveBandState {
  const now = Date.now();
  const parentPos: MallPoint = { ...DEFAULT_PARENT_POS };
  const childPos: MallPoint = { ...DEFAULT_CHILD_POS };
  const evalInfo = evaluateMallPosition(childPos, parentPos, params.safeLimitM);

  return {
    bandId: params.bandId,
    childName: params.childName,
    editionId: params.editionId,
    guardianPhone: params.guardianPhone,
    pinCode: params.pinCode,
    lockStatus: 'locked',
    batteryPct: 98,
    isReturned: false,
    safeLimitM: params.safeLimitM,
    createdAt: now,
    lastUpdated: now,
    eventId: now,
    senderId: params.senderId,
    parentPos,
    childPos,
    pathHistory: [parentPos, childPos],
    steps: 0,
    headingDeg: 45,
    distanceMeters: evalInfo.distParent,
    currentZoneLabel: evalInfo.zoneName,
    nearGateNumber: null,
    activeAlert: null,
    recoveryNotice: null,
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
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : 'تنبيه أمني',
    locationLabel:
      typeof obj.locationLabel === 'string' && obj.locationLabel.trim()
        ? obj.locationLabel.trim()
        : 'خارج النطاق',
    gateNumber:
      typeof obj.gateNumber === 'number' && Number.isFinite(obj.gateNumber)
        ? obj.gateNumber
        : undefined,
    distanceM:
      typeof obj.distanceM === 'number' && Number.isFinite(obj.distanceM)
        ? obj.distanceM
        : 0,
    ts,
    acknowledged: Boolean(obj.acknowledged),
    securityNotified: Boolean(obj.securityNotified),
  };
}

function sanitizeRecoveryNotice(raw: unknown): RecoveryNotice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  if (kind !== 'distance' && kind !== 'gate' && kind !== 'tamper') return null;
  if (typeof obj.text !== 'string' || !obj.text.trim()) return null;
  const ts =
    typeof obj.ts === 'number' && Number.isFinite(obj.ts) ? obj.ts : Date.now();
  const id =
    typeof obj.id === 'number' && Number.isFinite(obj.id) ? obj.id : ts;
  return { id, kind, text: obj.text.trim(), ts };
}

export function sanitizeBandState(raw: unknown): LiveBandState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.bandId !== 'string' || !obj.bandId.trim()) return null;

  const bandId = obj.bandId.trim().toUpperCase();
  const isReturned = Boolean(obj.isReturned);

  const validParent = isValidMallPoint(obj.parentPos)
    ? clampMallPoint(obj.parentPos)
    : null;
  const validChild = isValidMallPoint(obj.childPos)
    ? clampMallPoint(obj.childPos)
    : null;

  // Reject stale payloads from incompatible schemas
  if (!isReturned && (!validParent || !validChild)) {
    return null;
  }

  const parentPos = validParent ?? { ...DEFAULT_PARENT_POS };
  const childPos = validChild ?? { ...DEFAULT_CHILD_POS };

  const rawHistory = Array.isArray(obj.pathHistory)
    ? obj.pathHistory
        .filter((pt): pt is MallPoint => isValidMallPoint(pt))
        .map(clampMallPoint)
    : [];
  const pathHistory =
    rawHistory.length >= 2 ? rawHistory : [parentPos, childPos];

  const editionCandidate = obj.editionId as BandEditionId;
  const editionId: BandEditionId = VALID_EDITION_IDS.has(editionCandidate)
    ? editionCandidate
    : 'batman';

  const safeLimitM =
    typeof obj.safeLimitM === 'number' &&
    Number.isFinite(obj.safeLimitM) &&
    obj.safeLimitM >= 10 &&
    obj.safeLimitM <= 35
      ? Math.round(obj.safeLimitM)
      : 15;

  const batteryPct =
    typeof obj.batteryPct === 'number' && Number.isFinite(obj.batteryPct)
      ? Math.max(5, Math.min(100, Math.round(obj.batteryPct)))
      : 98;

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

  const evalInfo = evaluateMallPosition(childPos, parentPos, safeLimitM);

  const lockStatus: LiveBandState['lockStatus'] =
    obj.lockStatus === 'unlocked'
      ? 'unlocked'
      : obj.lockStatus === 'tampered'
      ? 'tampered'
      : 'locked';

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
    lockStatus,
    batteryPct,
    isReturned,
    returnedAt:
      typeof obj.returnedAt === 'number' && Number.isFinite(obj.returnedAt)
        ? obj.returnedAt
        : isReturned
        ? lastUpdated
        : undefined,
    safeLimitM,
    createdAt,
    lastUpdated,
    eventId,
    senderId: typeof obj.senderId === 'string' ? obj.senderId : '',
    parentPos,
    childPos,
    pathHistory,
    steps:
      typeof obj.steps === 'number' && Number.isFinite(obj.steps) && obj.steps >= 0
        ? Math.round(obj.steps)
        : 0,
    headingDeg:
      typeof obj.headingDeg === 'number' && Number.isFinite(obj.headingDeg)
        ? obj.headingDeg
        : 45,
    distanceMeters: evalInfo.distParent,
    currentZoneLabel:
      typeof obj.currentZoneLabel === 'string' && obj.currentZoneLabel.trim()
        ? obj.currentZoneLabel.trim()
        : evalInfo.zoneName,
    nearGateNumber: evalInfo.nearGate && evalInfo.nearestGate ? evalInfo.nearestGate.id : null,
    activeAlert: isReturned ? null : sanitizeAlert(obj.activeAlert),
    recoveryNotice: isReturned ? null : sanitizeRecoveryNotice(obj.recoveryNotice),
  };
}
