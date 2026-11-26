import mqtt, { MqttClient } from 'mqtt';
import {
  JuryStoragePayload,
  LiveBandState,
  ReturnedBandRecord,
  SessionDictionary,
  SyncStatus,
} from '../types/safestep';
import { sanitizeBandState } from '../data/safestepData';

// Dual-broker auto-healing failover list (<200ms cross-device live sync)
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
] as const;

const BC_NAME = 'safestep_jury_v4_bc';

export const JURY_STORAGE_KEY = 'safestep_jury_v4';

// Legacy stuck keys explicitly cleared on startup so no user is EVER trapped
const LEGACY_KEYS_TO_CLEAR = [
  'safestep_my_role_v1',
  'safestep_active_sessions_v1',
  'safestep_returned_count_v1',
  'safestep_returned_history_v1',
];

export const CLIENT_ID = `safestep_v4_${Math.random().toString(36).slice(2, 10)}`;

export function getBandStateTopic(bandId: string): string {
  return `safestep/jury/v4/band/${bandId.trim().toUpperCase()}/state`;
}

export type BandUpdateHandler = (state: LiveBandState) => void;
export type StatusChangeHandler = (status: SyncStatus) => void;

export function clearLegacyStuckStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    LEGACY_KEYS_TO_CLEAR.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Ignore storage access errors
  }
}

export function loadJuryStorage(): JuryStoragePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(JURY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JuryStoragePayload>;
    if (!parsed || typeof parsed !== 'object') return null;

    const cleanSessions: SessionDictionary = {};
    if (parsed.sessions && typeof parsed.sessions === 'object') {
      for (const item of Object.values(parsed.sessions)) {
        const sanitized = sanitizeBandState(item);
        if (sanitized && !sanitized.isReturned) {
          cleanSessions[sanitized.bandId] = sanitized;
        }
      }
    }

    const cleanHistory: Record<string, ReturnedBandRecord> = {};
    if (parsed.returnedHistory && typeof parsed.returnedHistory === 'object') {
      for (const [id, rec] of Object.entries(parsed.returnedHistory)) {
        if (rec && typeof rec.bandId === 'string') {
          cleanHistory[id.toUpperCase()] = {
            bandId: rec.bandId.toUpperCase(),
            childName: typeof rec.childName === 'string' ? rec.childName : 'طفل',
            returnedAt:
              typeof rec.returnedAt === 'number' ? rec.returnedAt : Date.now(),
          };
        }
      }
    }

    const returnedCount =
      typeof parsed.returnedCount === 'number' &&
      Number.isFinite(parsed.returnedCount) &&
      parsed.returnedCount >= 0
        ? Math.round(parsed.returnedCount)
        : Object.keys(cleanHistory).length;

    return {
      sessions: cleanSessions,
      returnedHistory: cleanHistory,
      returnedCount,
    };
  } catch {
    return null;
  }
}

export function saveJuryStorage(payload: JuryStoragePayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(JURY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

class SafeStepJuryLiveSync {
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

    // 1. Instant same-device BroadcastChannel sync
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

    // 2. Cross-tab localStorage sync
    window.addEventListener('storage', (ev) => {
      if (ev.key !== JURY_STORAGE_KEY || !ev.newValue) return;
      try {
        const parsed = JSON.parse(ev.newValue) as Partial<JuryStoragePayload>;
        if (parsed?.sessions && typeof parsed.sessions === 'object') {
          Object.values(parsed.sessions).forEach((rawBand) => {
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

    // 3. Auto-heal on phone screen wake or reconnect
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.healAndResubscribe();
      }
    });

    window.addEventListener('online', () => {
      this.healAndResubscribe();
    });

    // 4. Dual-broker MQTT over WebSockets
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

  public publishReturnState(state: LiveBandState): void {
    const clean = state.bandId.trim().toUpperCase();
    const topic = getBandStateTopic(clean);
    const now = Date.now();
    const returnedPayload: LiveBandState = {
      ...state,
      bandId: clean,
      isReturned: true,
      returnedAt: now,
      lockStatus: 'unlocked',
      activeAlert: null,
      recoveryNotice: null,
      lastUpdated: now,
      eventId: Math.max(now, (state.eventId ?? 0) + 1),
      senderId: CLIENT_ID,
    };

    this.lastPublishedState.delete(clean);

    if (this.client && this.client.connected) {
      try {
        this.client.publish(topic, JSON.stringify(returnedPayload), {
          qos: 1,
          retain: true,
        });
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

export const liveSync = new SafeStepJuryLiveSync();
