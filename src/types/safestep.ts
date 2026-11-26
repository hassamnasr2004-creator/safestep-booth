export type BandEditionId = 'batman' | 'spider' | 'astro' | 'frost';

export type ZoneId =
  | 'atrium'
  | 'kids_arena'
  | 'food_court'
  | 'anchor_stores'
  | 'exit_1'
  | 'exit_2'
  | 'exit_3'
  | 'exit_4';

export type MainTab = 'booth' | 'parent' | 'print';

export type DeviceRole = 'parent' | 'wristband' | 'booth';

export interface StoredDeviceRole {
  role: DeviceRole;
  activeBandId: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
}

export interface BandEdition {
  id: BandEditionId;
  shortName: string;
  englishName: string;
  swatch: string;
  imageUrl: string;
  prefix: string;
}

export interface MallZone {
  id: ZoneId;
  nameAr: string;
  type: 'interior' | 'exit';
  bounds: { x: number; y: number; width: number; height: number };
  center: Point2D;
}

export type LiveAlertType = 'distance' | 'gate' | 'tamper';

export interface LiveAlert {
  id: string;
  type: LiveAlertType;
  title: string;
  zoneName: string;
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
  senderId: string;
  currentZone: ZoneId;
  mapPos: Point2D;
  parentMapPos: Point2D;
  pathHistory: Point2D[];
  steps: number;
  distanceMeters: number;
  coords: {
    band: GpsPoint | null;
    parent: GpsPoint | null;
  };
  activeAlert: LiveAlert | null;
}

export type SessionDictionary = Record<string, LiveBandState>;

export type SyncStatus = 'connecting' | 'connected' | 'local';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
}
