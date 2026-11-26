import mqtt, { MqttClient } from 'mqtt';
import {
  LiveBandState,
  SessionDictionary,
  StoredDeviceRole,
  SyncStatus,
} from '../types/safestep';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const BC_NAME = 'safestep_live_sync_v3';

// Versioned persistent storage keys
export const ACTIVE_SESSIONS_KEY = 'safestep_active_sessions_v1';
export const MY_ROLE_KEY = 'safestep_my_role_v1';
export const RETURNED_COUNT_KEY = 'safestep_returned_count_v1';

export const CLIENT_ID = `safestep_${Math.random().toString(36).slice(2, 10)}`;

export function getBandStateTopic(bandId: string): string {
  return `safestep/live/band/${bandId.trim().toUpperCase()}/state`;
}

export type BandUpdateHandler = (state: LiveBandState) => void;
export type StatusChangeHandler = (status: SyncStatus) => void;

class SafeStepLiveSync {
  private client: MqttClient | null = null;
  private bc: BroadcastChannel | null = null;
  private subscribedBands = new Set<string>();
  private listeners = new Set<BandUpdateHandler>();
  private statusListeners = new Set<StatusChangeHandler>();
  private status: SyncStatus = 'connecting';
  private started = false;

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // 1. Same-device BroadcastChannel instant sync
    if ('BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(BC_NAME);
        this.bc.onmessage = (ev) => {
          const msg = ev.data as LiveBandState | undefined;
          if (msg && msg.bandId && msg.senderId !== CLIENT_ID) {
            this.emitUpdate(msg);
          }
        };
      } catch {
        this.bc = null;
      }
    }

    // 2. Cross-tab localStorage event sync
    window.addEventListener('storage', (ev) => {
      if (ev.key !== ACTIVE_SESSIONS_KEY || !ev.newValue) return;
      try {
        const dict = JSON.parse(ev.newValue) as SessionDictionary;
        if (dict && typeof dict === 'object') {
          Object.values(dict).forEach((b) => {
            if (b && b.bandId && b.senderId !== CLIENT_ID) {
              this.emitUpdate(b);
            }
          });
        }
      } catch {
        // Ignore parse error
      }
    });

    // 3. Cloud-Retained Cross-Device MQTT over WebSockets (QoS 1 + retain: true)
    try {
      this.setStatus('connecting');
      const client = mqtt.connect(BROKER_URL, {
        clientId: CLIENT_ID,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 8000,
        keepalive: 30,
      });
      this.client = client;

      client.on('connect', () => {
        this.setStatus('connected');
        this.subscribedBands.forEach((bandId) => {
          client.subscribe(getBandStateTopic(bandId), { qos: 1 });
        });
      });

      client.on('reconnect', () => {
        this.setStatus('connecting');
      });

      client.on('offline', () => {
        this.setStatus('local');
      });

      client.on('error', () => {
        this.setStatus('local');
      });

      client.on('message', (_topic, payload) => {
        const raw = payload.toString('utf-8').trim();
        // Empty payload means retained state was officially cleared upon wristband return
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as LiveBandState;
          if (!parsed || !parsed.bandId) return;
          if (parsed.senderId === CLIENT_ID) return;
          this.emitUpdate(parsed);
        } catch {
          // Ignore malformed payload
        }
      });
    } catch {
      this.setStatus('local');
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(next: SyncStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((fn) => fn(next));
  }

  public onStatus(fn: StatusChangeHandler): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  public onUpdate(fn: BandUpdateHandler): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emitUpdate(state: LiveBandState): void {
    this.listeners.forEach((fn) => fn(state));
  }

  public subscribeBand(bandId: string): void {
    const clean = bandId.trim().toUpperCase();
    if (!clean) return;
    if (this.subscribedBands.has(clean)) return;
    this.subscribedBands.add(clean);
    if (this.client && this.client.connected) {
      this.client.subscribe(getBandStateTopic(clean), { qos: 1 });
    }
  }

  public publishState(state: LiveBandState): void {
    const clean = state.bandId.trim().toUpperCase();
    const stamped: LiveBandState = {
      ...state,
      bandId: clean,
      lastUpdated: Date.now(),
      senderId: CLIENT_ID,
    };

    this.subscribeBand(clean);
    const topic = getBandStateTopic(clean);

    if (this.client && this.client.connected) {
      try {
        this.client.publish(topic, JSON.stringify(stamped), {
          qos: 1,
          retain: true,
        });
      } catch {
        // Fallback handles local delivery
      }
    }

    if (this.bc) {
      try {
        this.bc.postMessage(stamped);
      } catch {
        // Ignore closed channel
      }
    }
  }

  // Official Return & Unlock: broadcast returned state immediately, then wipe retained MQTT topic
  public publishReturnAndClearRetained(state: LiveBandState): void {
    const clean = state.bandId.trim().toUpperCase();
    const topic = getBandStateTopic(clean);
    const returnedPayload: LiveBandState = {
      ...state,
      bandId: clean,
      isReturned: true,
      lockStatus: 'unlocked',
      activeAlert: null,
      lastUpdated: Date.now(),
      senderId: CLIENT_ID,
    };

    if (this.client && this.client.connected) {
      try {
        // 1. Notify live connected devices immediately
        this.client.publish(topic, JSON.stringify(returnedPayload), {
          qos: 1,
          retain: false,
        });
        // 2. Clear retained broker message so returned band never reappears on future scans
        window.setTimeout(() => {
          if (this.client && this.client.connected) {
            this.client.publish(topic, '', { qos: 1, retain: true });
          }
        }, 250);
      } catch {
        // Ignore
      }
    }

    if (this.bc) {
      try {
        this.bc.postMessage(returnedPayload);
      } catch {
        // Ignore
      }
    }
  }
}

export const liveSync = new SafeStepLiveSync();

// Bulletproof localStorage dictionary persistence
export function hasStoredSessionsKey(): boolean {
  try {
    return window.localStorage.getItem(ACTIVE_SESSIONS_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadActiveSessions(): SessionDictionary {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionDictionary;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: SessionDictionary = {};
    for (const [id, session] of Object.entries(parsed)) {
      if (session && session.bandId && !session.isReturned) {
        clean[id] = session;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveActiveSessions(dict: SessionDictionary): void {
  try {
    window.localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(dict));
  } catch {
    // Ignore storage quota error
  }
}

export function loadMyRole(): StoredDeviceRole | null {
  try {
    const raw = window.localStorage.getItem(MY_ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDeviceRole>;
    if (
      parsed &&
      (parsed.role === 'parent' ||
        parsed.role === 'wristband' ||
        parsed.role === 'booth')
    ) {
      return {
        role: parsed.role,
        activeBandId: typeof parsed.activeBandId === 'string' ? parsed.activeBandId : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMyRole(role: StoredDeviceRole): void {
  try {
    window.localStorage.setItem(MY_ROLE_KEY, JSON.stringify(role));
  } catch {
    // Ignore
  }
}

export function loadReturnedCount(): number {
  try {
    const raw = window.localStorage.getItem(RETURNED_COUNT_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export function saveReturnedCount(count: number): void {
  try {
    window.localStorage.setItem(RETURNED_COUNT_KEY, String(count));
  } catch {
    // Ignore
  }
}
