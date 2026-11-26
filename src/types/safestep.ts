export type BandEditionId = 'batman' | 'spider' | 'astro' | 'frost';

export type LatLngTuple = [number, number];

export type BoothTabId = 'console' | 'print';

export type DeviceRole = 'parent' | 'band' | 'booth';

export interface StoredDeviceRole {
  role: DeviceRole;
  activeBandId: string;
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
  distanceM: number;
  ts: number;
  acknowledged: boolean;
  securityNotified: boolean;
}

export interface LiveBandState {
  bandId: string;
  childName: string;
  editionId: BandEditionId;
  guardianPhone: string;
  pinCode: string;
  lockStatus: 'locked' | 'unlocked';
  isReturned: boolean;
  safeLimitM: number;
  createdAt: number;
  lastUpdated: number;
  eventId: number;
  senderId: string;
  originCoords: LatLngTuple;
  parentCoords: LatLngTuple;
  childCoords: LatLngTuple;
  gateCoords: LatLngTuple;
  pathHistory: LatLngTuple[];
  steps: number;
  headingDeg: number;
  distanceMeters: number;
  gpsSource: 'gps' | 'fusion';
  currentZoneLabel: string;
  activeAlert: LiveAlert | null;
}

export type SessionDictionary = Record<string, LiveBandState>;

export type SyncStatus = 'connecting' | 'connected' | 'failover' | 'local';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
}
