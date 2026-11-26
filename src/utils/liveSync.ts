import mqtt, { MqttClient } from 'mqtt';
import {
  LiveBandState,
  SessionDictionary,
  StoredDeviceRole,
  SyncStatus,
} from '../types/safestep';
import { sanitizeBandState } from '../data/safestepData';

// Dual-broker auto-healing failover list
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
] as const;

const BC_NAME = 'safestep_live_sync_v4';

export const ACTIVE_SESSIONS_KEY = 'safestep_active_sessions_v1';
export const MY_ROLE_KEY = 'safestep_my_role_v1';
export const RETURNED_COUNT_KEY = 'safestep_returned_count_v1';

export const CLIENT_ID = `safestep_${Math.random().toString(36).slice(2, 10)}`;

export function getBandStateTopic(bandId: string): string {
  return `safestep/live/band/${bandId.trim().toUpperCase()}/state`;
}

export type BandUpdateHandler = (state: LiveBandState) => void;
export type StatusChangeHandler = (status: SyncStatus) => void;

class SafeStepDualBrokerSync {
  private client: MqttClient | null = null;
  private bc: BroadcastChannel | null = null;
  private brokerIndex = 0;
  private failCount = 0;
  private connectTimeoutWatch: number | null = null;
  private subscribedBands = new Set<string>();
  private listeners = new Set<BandUpdateHandler>();
  private statusListeners = new Set<StatusChangeHandler>();
  private status: SyncStatus = 'connecting';
  private started = false;
  private lastPublishedState = new Map<string, LiveBandState>();

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // 1. Same-device BroadcastChannel instant sync
    if ('BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(BC_NAME);
        this.bc.onmessage = (ev) => {
          const msg = sanitizeBandState(ev.data);
          if (msg && msg.senderId !== CLIENT_ID) {
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
        const dict = JSON.parse(ev.newValue) as Record<string, unknown>;
        if (dict && typeof dict === 'object' && !Array.isArray(dict)) {
          Object.values(dict).forEach((rawBand) => {
            const clean = sanitizeBandState(rawBand);
            if (clean && clean.senderId !== CLIENT_ID) {
              this.emitUpdate(clean);
            }
          });
        }
      } catch {
        // Ignore parse error
      }
    });

    // 3. Auto-heal on phone screen wake or network restore (<300ms retained pull)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.healAndResubscribe();
      }
    });

    window.addEventListener('online', () => {
      this.healAndResubscribe();
    });

    // 4. Connect to primary broker (EMQX -> automatic failover to HiveMQ)
    this.connectBroker(0);
  }

  private clearWatchTimer() {
    if (this.connectTimeoutWatch !== null) {
      window.clearTimeout(this.connectTimeoutWatch);
      this.connectTimeoutWatch = null;
    }
  }

  private connectBroker(index: number): void {
    this.clearWatchTimer();
    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.end(true);
      } catch {
        // Ignore
      }
      this.client = null;
    }

    this.brokerIndex = index % BROKERS.length;
    const url = BROKERS[this.brokerIndex];
    this.setStatus(this.brokerIndex === 0 ? 'connecting' : 'failover');

    try {
      const client = mqtt.connect(url, {
        clientId: `${CLIENT_ID}_${this.brokerIndex}`,
        clean: true,
        keepalive: 15,
        reconnectPeriod: 1500,
        connectTimeout: 5500,
      });
      this.client = client;

      // Failover watchdog if primary broker fails to connect within 6s
      this.connectTimeoutWatch = window.setTimeout(() => {
        if (this.client && !this.client.connected) {
          this.failoverNext();
        }
      }, 6000);

      client.on('connect', () => {
        this.clearWatchTimer();
        this.failCount = 0;
        this.setStatus('connected');
        this.resubscribeAll();
      });

      client.on('reconnect', () => {
        this.setStatus(this.brokerIndex === 0 ? 'connecting' : 'failover');
      });

      client.on('offline', () => {
        this.setStatus('local');
      });

      client.on('error', () => {
        this.failCount += 1;
        if (this.failCount >= 2) {
          this.failCount = 0;
          this.failoverNext();
        }
      });

      client.on('message', (_topic, payload) => {
        const raw = payload.toString('utf-8').trim();
        if (!raw) return;
        try {
          const parsed = sanitizeBandState(JSON.parse(raw));
          if (!parsed) return;
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

  private failoverNext(): void {
    const nextIdx = (this.brokerIndex + 1) % BROKERS.length;
    this.connectBroker(nextIdx);
  }

  private resubscribeAll(): void {
    if (!this.client || !this.client.connected) return;
    this.subscribedBands.forEach((bandId) => {
      const topic = getBandStateTopic(bandId);
      // Unsubscribe + re-subscribe forces immediate delivery of latest retained snapshot on wake
      this.client?.unsubscribe(topic, () => {
        this.client?.subscribe(topic, { qos: 1 });
      });
    });
  }

  public healAndResubscribe(): void {
    if (!this.client) {
      this.connectBroker(this.brokerIndex);
      return;
    }
    if (this.client.connected) {
      this.resubscribeAll();
      // Also flush any locally buffered band states
      this.lastPublishedState.forEach((state, bandId) => {
        if (!state.isReturned) {
          this.client?.publish(getBandStateTopic(bandId), JSON.stringify(state), {
            qos: 1,
            retain: true,
          });
        }
      });
    } else {
      try {
        this.client.reconnect();
      } catch {
        this.connectBroker(this.brokerIndex);
      }
    }
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
    const isNew = !this.subscribedBands.has(clean);
    this.subscribedBands.add(clean);
    if (isNew && this.client && this.client.connected) {
      this.client.subscribe(getBandStateTopic(clean), { qos: 1 });
    }
  }

  public publishState(state: LiveBandState): void {
    const clean = state.bandId.trim().toUpperCase();
    const now = Date.now();
    const stamped: LiveBandState = {
      ...state,
      bandId: clean,
      lastUpdated: now,
      eventId: Math.max(now, (state.eventId ?? 0) + 1),
      senderId: CLIENT_ID,
    };

    this.lastPublishedState.set(clean, stamped);
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
        // Ignore
      }
    }
  }

  public publishReturnAndClearRetained(state: LiveBandState): void {
    const clean = state.bandId.trim().toUpperCase();
    const topic = getBandStateTopic(clean);
    const now = Date.now();
    const returnedPayload: LiveBandState = {
      ...state,
      bandId: clean,
      isReturned: true,
      lockStatus: 'unlocked',
      activeAlert: null,
      lastUpdated: now,
      eventId: Math.max(now, (state.eventId ?? 0) + 1),
      senderId: CLIENT_ID,
    };

    this.lastPublishedState.delete(clean);

    if (this.client && this.client.connected) {
      try {
        this.client.publish(topic, JSON.stringify(returnedPayload), {
          qos: 1,
          retain: false,
        });
        window.setTimeout(() => {
          if (this.client && this.client.connected) {
            this.client.publish(topic, '', { qos: 1, retain: true });
          }
        }, 280);
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

export const liveSync = new SafeStepDualBrokerSync();

// Bulletproof localStorage helpers
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: SessionDictionary = {};
    for (const session of Object.values(parsed)) {
      const sanitized = sanitizeBandState(session);
      if (sanitized && !sanitized.isReturned) {
        clean[sanitized.bandId] = sanitized;
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
    // Ignore
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
        parsed.role === 'band' ||
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
