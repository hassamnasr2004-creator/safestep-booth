export type BandEditionId = 'batman' | 'spider' | 'astro' | 'frost';

export type MainTabId = 'booth' | 'parent' | 'band' | 'print';

export interface MallPoint {
  x: number; // 0..100 meters
  y: number; // 0..64 meters
}

export interface BandEdition {
  id: BandEditionId;
  shortName: string;
  englishName: string;
  swatch: string;
  imageUrl: string;
  prefix: string;
}

export type AlertKind = 'TAMPER_ATTEMPT' | 'GATE_PROXIMITY' | 'DISTANCE_BREACH';

export interface LiveAlert {
  alertId: number;
  type: AlertKind;
  title: string;
  locationLabel: string;
  gateNumber?: number;
  distanceM: number;
  ts: number;
  acknowledged: boolean;
  securityNotified: boolean;
}

export interface RecoveryNotice {
  id: number;
  kind: 'distance' | 'gate' | 'tamper';
  text: string;
  ts: number;
}

export interface LiveBandState {
  bandId: string;
  childName: string;
  editionId: BandEditionId;
  guardianPhone: string;
  pinCode: string;
  lockStatus: 'locked' | 'tampered' | 'unlocked';
  batteryPct: number;
  isReturned: boolean;
  returnedAt?: number;
  safeLimitM: number;
  createdAt: number;
  lastUpdated: number;
  eventId: number;
  senderId: string;
  parentPos: MallPoint;
  childPos: MallPoint;
  pathHistory: MallPoint[];
  steps: number;
  headingDeg: number;
  distanceMeters: number;
  currentZoneLabel: string;
  nearGateNumber: number | null;
  activeAlert: LiveAlert | null;
  recoveryNotice: RecoveryNotice | null;
}

export interface ReturnedBandRecord {
  bandId: string;
  childName: string;
  returnedAt: number;
}

export type SessionDictionary = Record<string, LiveBandState>;

export interface JuryStoragePayload {
  sessions: SessionDictionary;
  returnedHistory: Record<string, ReturnedBandRecord>;
  returnedCount: number;
}

export type SyncStatus = 'connecting' | 'connected' | 'failover' | 'local';

export type ScenarioId =
  | 'kids_arena'
  | 'breach_safe'
  | 'return_parent'
  | 'gate_danger';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
}
