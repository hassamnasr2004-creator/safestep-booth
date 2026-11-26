import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  BandEditionId,
  GpsPoint,
  LiveBandState,
  MainTab,
  SessionDictionary,
  StoredDeviceRole,
  SyncStatus,
  ToastMessage,
} from './types/safestep';
import {
  PARENT_DEFAULT_POS,
  computeEffectiveDistance,
  createDemoBand,
  detectZone,
  generateBandId,
  generatePin,
  getEditionById,
} from './data/safestepData';
import {
  CLIENT_ID,
  hasStoredSessionsKey,
  liveSync,
  loadActiveSessions,
  loadMyRole,
  loadReturnedCount,
  saveActiveSessions,
  saveMyRole,
  saveReturnedCount,
} from './utils/liveSync';
import { playShortChime } from './utils/audioAlerts';
import { TopNav } from './components/TopNav';
import { BoothTab } from './components/BoothTab';
import { ParentTab } from './components/ParentTab';
import { PrintQrTab } from './components/PrintQrTab';
import { WristbandLivePanel } from './components/WristbandLivePanel';
import { ToastStack } from './components/ToastStack';

const BASE_URL_KEY = 'safestep_public_base_url_v2';

function getInitialBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.localStorage.getItem(BASE_URL_KEY);
    if (saved) return saved;
  } catch {
    // Ignore
  }
  return `${window.location.origin}${window.location.pathname}`;
}

function bootstrapRoleAndSessions(): {
  initialSessions: SessionDictionary;
  initialRole: StoredDeviceRole;
} {
  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const urlParentId = params.get('b')?.trim().toUpperCase() || '';
  const urlWristbandId = params.get('w')?.trim().toUpperCase() || '';

  // 1. Load active sessions strictly without resetting real stored sessions
  let sessions: SessionDictionary;
  if (hasStoredSessionsKey()) {
    sessions = loadActiveSessions();
  } else if (urlParentId || urlWristbandId) {
    // Fresh phone scanning a QR code — wait cleanly for retained MQTT state instead of seeding unrelated demo
    sessions = {};
  } else {
    // Very first Booth visit on a brand-new browser: seed 1 realistic demo band and persist immediately
    const demo = createDemoBand(CLIENT_ID);
    sessions = { [demo.bandId]: demo };
    saveActiveSessions(sessions);
  }

  // 2. Resolve device role: URL query params take priority, otherwise auto-resume saved role
  let role: StoredDeviceRole;
  if (urlParentId) {
    role = { role: 'parent', activeBandId: urlParentId };
    saveMyRole(role);
  } else if (urlWristbandId) {
    role = { role: 'wristband', activeBandId: urlWristbandId };
    saveMyRole(role);
  } else {
    const savedRole = loadMyRole();
    if (savedRole) {
      // Auto-resume parent or wristband even without URL params!
      role = savedRole;
    } else {
      const firstId = Object.keys(sessions)[0] ?? '';
      role = { role: 'booth', activeBandId: firstId };
      saveMyRole(role);
    }
  }

  return { initialSessions: sessions, initialRole: role };
}

export default function App() {
  const [boot] = useState(() => bootstrapRoleAndSessions());
  const [sessions, setSessions] = useState<SessionDictionary>(
    boot.initialSessions
  );
  const [deviceRole, setDeviceRole] = useState<StoredDeviceRole>(
    boot.initialRole
  );
  const [returnedCount, setReturnedCount] = useState<number>(() =>
    loadReturnedCount()
  );
  const [lastReturnedInfo, setLastReturnedInfo] = useState<{
    bandId: string;
    childName: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>(() =>
    boot.initialRole.role === 'parent' ? 'parent' : 'booth'
  );
  const [baseUrl, setBaseUrl] = useState<string>(getInitialBaseUrl);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const activeBands = useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => !s.isReturned)
        .sort((a, b) => b.createdAt - a.createdAt),
    [sessions]
  );

  const addToast = useCallback((type: ToastMessage['type'], title: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [{ id, type, title }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const updateDeviceRole = useCallback((next: StoredDeviceRole) => {
    setDeviceRole(next);
    saveMyRole(next);
  }, []);

  const handleChangeBaseUrl = useCallback((next: string) => {
    setBaseUrl(next);
    try {
      window.localStorage.setItem(BASE_URL_KEY, next);
    } catch {
      // Ignore
    }
  }, []);

  // Continuous synchronous-safe localStorage persistence
  useEffect(() => {
    saveActiveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveMyRole(deviceRole);
  }, [deviceRole]);

  useEffect(() => {
    saveReturnedCount(returnedCount);
  }, [returnedCount]);

  // Start real MQTT WebSocket + BroadcastChannel live sync
  useEffect(() => {
    liveSync.start();
    const unsubStatus = liveSync.onStatus(setSyncStatus);
    const unsubUpdate = liveSync.onUpdate((incoming) => {
      // Handle remote Official Return & Unlock event
      if (incoming.isReturned) {
        setSessions((prev) => {
          const next = { ...prev };
          delete next[incoming.bandId];
          saveActiveSessions(next);
          return next;
        });
        setLastReturnedInfo({
          bandId: incoming.bandId,
          childName: incoming.childName,
        });
        setReturnedCount((c) => c + 1);
        // Clear bound parent/wristband role if this device was tracking the returned band
        setDeviceRole((prevRole) => {
          if (
            prevRole.activeBandId === incoming.bandId &&
            (prevRole.role === 'parent' || prevRole.role === 'wristband')
          ) {
            const cleared: StoredDeviceRole = { role: 'booth', activeBandId: '' };
            saveMyRole(cleared);
            return prevRole; // keep view on confirmation screen until user taps button, while storage is safely cleared
          }
          return prevRole;
        });
        playShortChime('unlock');
        return;
      }

      // Merge fresh cloud-retained state with localStorage using lastUpdated timestamp
      setSessions((prev) => {
        const existing = prev[incoming.bandId];
        if (existing && incoming.lastUpdated < existing.lastUpdated) {
          return prev;
        }
        const next: SessionDictionary = {
          ...prev,
          [incoming.bandId]: incoming,
        };
        saveActiveSessions(next);
        return next;
      });
    });

    return () => {
      unsubStatus();
      unsubUpdate();
    };
  }, []);

  // Subscribe MQTT to every active band + bound device band
  useEffect(() => {
    if (deviceRole.activeBandId) {
      liveSync.subscribeBand(deviceRole.activeBandId);
    }
    activeBands.forEach((b) => liveSync.subscribeBand(b.bandId));
  }, [activeBands, deviceRole.activeBandId]);

  // When Booth connects to MQTT, ensure active local bands are retained on the broker
  useEffect(() => {
    if (syncStatus === 'connected' && deviceRole.role === 'booth') {
      activeBands.forEach((b) => {
        liveSync.publishState(b);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  // Update a band, persist synchronously to localStorage, and publish retained MQTT snapshot
  const updateAndPublishBand = useCallback(
    (bandId: string, updater: (prev: LiveBandState) => LiveBandState) => {
      setSessions((prev) => {
        const existing = prev[bandId];
        if (!existing || existing.isReturned) return prev;
        const updated: LiveBandState = {
          ...updater(existing),
          lastUpdated: Date.now(),
          senderId: CLIENT_ID,
        };
        const next: SessionDictionary = { ...prev, [bandId]: updated };
        saveActiveSessions(next);
        liveSync.publishState(updated);
        return next;
      });
    },
    []
  );

  // Issue new wristband in Booth
  const handleCreateBand = useCallback(
    (params: {
      editionId: BandEditionId;
      childName: string;
      guardianPhone: string;
    }) => {
      const now = Date.now();
      const newBand: LiveBandState = {
        bandId: generateBandId(params.editionId),
        childName: params.childName,
        editionId: params.editionId,
        guardianPhone: params.guardianPhone,
        pinCode: generatePin(),
        lockStatus: 'locked',
        isReturned: false,
        safeLimitM: 15,
        createdAt: now,
        lastUpdated: now,
        senderId: CLIENT_ID,
        currentZone: 'atrium',
        mapPos: { x: 428, y: 235 },
        parentMapPos: PARENT_DEFAULT_POS,
        pathHistory: [PARENT_DEFAULT_POS, { x: 428, y: 235 }],
        steps: 0,
        distanceMeters: 3,
        coords: { band: null, parent: null },
        activeAlert: null,
      };
      setSessions((prev) => {
        const next: SessionDictionary = { ...prev, [newBand.bandId]: newBand };
        saveActiveSessions(next);
        return next;
      });
      setLastReturnedInfo(null);
      updateDeviceRole({ role: 'booth', activeBandId: newBand.bandId });
      liveSync.publishState(newBand);
      playShortChime('lock');
      addToast('success', `تم تفعيل السوار ${newBand.bandId}`);
    },
    [addToast, updateDeviceRole]
  );

  // Official Return & Unlock (ONLY place where active session is removed and MQTT retained topic is wiped)
  const handleUnlockAndReturn = useCallback(
    (bandId: string, pin: string): boolean => {
      const target = sessions[bandId];
      if (!target || target.isReturned) return false;

      if (pin !== target.pinCode) {
        playShortChime('denied');
        updateAndPublishBand(bandId, (prev) => {
          const z = detectZone(prev.mapPos);
          const { meters } = computeEffectiveDistance(prev);
          return {
            ...prev,
            activeAlert: {
              id: `al-${Date.now()}`,
              type: 'tamper',
              title: 'تحذير: محاولة فك السوار بدون إذن',
              zoneName: z.nameAr,
              distanceM: meters,
              ts: Date.now(),
              acknowledged: false,
              securityNotified: false,
            },
          };
        });
        addToast('error', 'الرمز غير صحيح');
        return false;
      }

      playShortChime('unlock');
      // 1. Publish returned state & wipe retained MQTT topic
      liveSync.publishReturnAndClearRetained(target);

      // 2. Remove from active sessions dictionary immediately
      setSessions((prev) => {
        const next = { ...prev };
        delete next[bandId];
        saveActiveSessions(next);
        return next;
      });

      setReturnedCount((c) => {
        const next = c + 1;
        saveReturnedCount(next);
        return next;
      });

      setLastReturnedInfo({
        bandId: target.bandId,
        childName: target.childName,
      });

      // Point booth selector to next active band if any
      const remaining = activeBands.filter((b) => b.bandId !== bandId);
      updateDeviceRole({
        role: 'booth',
        activeBandId: remaining[0]?.bandId ?? '',
      });

      addToast('success', 'تم فك القفل وتسليم السوار بنجاح');
      return true;
    },
    [sessions, activeBands, updateAndPublishBand, updateDeviceRole, addToast]
  );

  const handleUpdateParentGps = useCallback(
    (bandId: string, gps: GpsPoint) => {
      updateAndPublishBand(bandId, (prev) => {
        const next: LiveBandState = {
          ...prev,
          coords: { ...prev.coords, parent: gps },
        };
        const { meters } = computeEffectiveDistance(next);
        let activeAlert = prev.activeAlert;
        if (meters > prev.safeLimitM && !activeAlert) {
          const z = detectZone(prev.mapPos);
          activeAlert = {
            id: `al-${Date.now()}`,
            type: 'distance',
            title: `تنبيه: ابتعد السوار مسافة ${meters} متر`,
            zoneName: z.nameAr,
            distanceM: meters,
            ts: Date.now(),
            acknowledged: false,
            securityNotified: false,
          };
        }
        return { ...next, activeAlert };
      });
    },
    [updateAndPublishBand]
  );

  const handleAcknowledgeAlert = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) =>
        prev.activeAlert
          ? {
              ...prev,
              activeAlert: { ...prev.activeAlert, acknowledged: true },
            }
          : prev
      );
      addToast('info', 'تم إيقاف الصوت');
    },
    [updateAndPublishBand, addToast]
  );

  const handleNotifySecurity = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) =>
        prev.activeAlert
          ? {
              ...prev,
              activeAlert: { ...prev.activeAlert, securityNotified: true },
            }
          : prev
      );
      addToast('error', 'تم إبلاغ الأمن فوراً');
    },
    [updateAndPublishBand, addToast]
  );

  const exitToBooth = useCallback(() => {
    const firstActiveId = activeBands[0]?.bandId ?? '';
    updateDeviceRole({ role: 'booth', activeBandId: firstActiveId });
    setActiveTab('booth');
    setLastReturnedInfo(null);
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeBands, updateDeviceRole]);

  const hasActiveAlarm = useMemo(
    () =>
      activeBands.some(
        (b) => b.activeAlert !== null && !b.activeAlert.acknowledged
      ),
    [activeBands]
  );

  // AUTO-RESUMED OR URL-LAUNCHED FULL-SCREEN LIVE WRISTBAND MODE
  if (deviceRole.role === 'wristband' && deviceRole.activeBandId) {
    const band = sessions[deviceRole.activeBandId] ?? null;
    const isReturnedNow =
      !band && lastReturnedInfo?.bandId === deviceRole.activeBandId;

    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#1E3A8A]">وضع السوار الحي</p>
              <h1 className="text-lg font-bold text-[#0F172A] tabular-nums">
                {deviceRole.activeBandId}
                {band ? ` · ${band.childName}` : ''}
              </h1>
            </div>
            <button
              type="button"
              onClick={exitToBooth}
              className="px-3 py-1.5 text-xs font-bold border border-[#CBD5E1] bg-white rounded-lg text-[#0F172A] cursor-pointer"
            >
              العودة للبوث
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0D9488]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
          </div>

          {isReturnedNow ? (
            <div className="bg-white border-2 border-[#0D9488] rounded-2xl p-8 text-center space-y-3">
              <CheckCircle2
                className="w-12 h-12 text-[#0D9488] mx-auto"
                strokeWidth={1.75}
              />
              <h2 className="text-base font-bold text-[#0F172A]">
                تم فك القفل وتسليم السوار بنجاح — انتهت الجلسة
              </h2>
              <button
                type="button"
                onClick={exitToBooth}
                className="mt-2 px-5 py-2.5 bg-[#0F172A] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                فتح شاشة البوث
              </button>
            </div>
          ) : band ? (
            <>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between text-xs font-bold">
                <span>{getEditionById(band.editionId).shortName}</span>
                <span className="text-[#0D9488]">
                  {syncStatus === 'connected' ? 'بث مباشر نشط' : 'وضع محلي'}
                </span>
              </div>
              <WristbandLivePanel
                band={band}
                onBroadcastPatch={(updater) =>
                  updateAndPublishBand(band.bandId, updater)
                }
              />
            </>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-sm font-bold text-[#475569]">
              جارٍ استعادة السوار {deviceRole.activeBandId}
            </div>
          )}
        </div>
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </div>
    );
  }

  // AUTO-RESUMED OR QR-SCANNED FULL-SCREEN PARENT TRACKER MODE
  if (deviceRole.role === 'parent' && deviceRole.activeBandId) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
        <ParentTab
          activeBands={activeBands}
          lockedBandId={deviceRole.activeBandId}
          selectedBandId={deviceRole.activeBandId}
          returnedBandInfo={lastReturnedInfo}
          syncStatus={syncStatus}
          onSelectBand={(id) =>
            updateDeviceRole({ role: 'parent', activeBandId: id })
          }
          onUpdateParentGps={handleUpdateParentGps}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onNotifySecurity={handleNotifySecurity}
          onExitFullscreen={exitToBooth}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </div>
    );
  }

  // STANDARD 3-TAB BOOTH / OPERATIONAL WORKSPACE
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        syncStatus={syncStatus}
        hasActiveAlarm={hasActiveAlarm}
        hasActiveSessions={activeBands.length > 0}
      />

      <main>
        {activeTab === 'booth' && (
          <BoothTab
            activeBands={activeBands}
            selectedBandId={deviceRole.activeBandId}
            returnedCount={returnedCount}
            lastReturnedInfo={lastReturnedInfo}
            baseUrl={baseUrl}
            onChangeBaseUrl={handleChangeBaseUrl}
            onSelectBand={(id) =>
              updateDeviceRole({ role: 'booth', activeBandId: id })
            }
            onCreateBand={handleCreateBand}
            onBroadcastPatch={updateAndPublishBand}
            onUnlockAndReturn={handleUnlockAndReturn}
            onOpenParentView={(bandId) => {
              updateDeviceRole({ role: 'booth', activeBandId: bandId });
              setActiveTab('parent');
            }}
            onOpenWristbandFullscreen={(bandId) => {
              updateDeviceRole({ role: 'wristband', activeBandId: bandId });
            }}
            onDismissReturnedBanner={() => setLastReturnedInfo(null)}
          />
        )}

        {activeTab === 'parent' && (
          <ParentTab
            activeBands={activeBands}
            lockedBandId={null}
            selectedBandId={deviceRole.activeBandId}
            returnedBandInfo={lastReturnedInfo}
            syncStatus={syncStatus}
            onSelectBand={(id) =>
              updateDeviceRole({ role: 'booth', activeBandId: id })
            }
            onUpdateParentGps={handleUpdateParentGps}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onNotifySecurity={handleNotifySecurity}
          />
        )}

        {activeTab === 'print' && (
          <PrintQrTab
            baseUrl={baseUrl}
            onChangeBaseUrl={handleChangeBaseUrl}
            defaultBandId={deviceRole.activeBandId || activeBands[0]?.bandId}
          />
        )}
      </main>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </div>
  );
}
