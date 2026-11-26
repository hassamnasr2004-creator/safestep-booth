import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BandEditionId,
  BoothTabId,
  LatLngTuple,
  LiveBandState,
  SessionDictionary,
  StoredDeviceRole,
  SyncStatus,
  ToastMessage,
} from './types/safestep';
import {
  DEFAULT_ORIGIN,
  computeGateCoords,
  createDemoBand,
  createInitialBandState,
  createNewAlertId,
  deriveZoneLabel,
  generateBandId,
  generatePin,
  offsetLatLng,
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
import { BandWearableView } from './components/BandWearableView';
import { PrintQrTab } from './components/PrintQrTab';
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

  const rawRole = params.get('role')?.trim().toLowerCase();
  const bParam = params.get('b')?.trim().toUpperCase() || '';
  const wParam = params.get('w')?.trim().toUpperCase() || '';

  const isUrlBand = (rawRole === 'band' && Boolean(bParam)) || Boolean(wParam);
  const isUrlParent =
    (rawRole === 'parent' && Boolean(bParam)) || (!rawRole && Boolean(bParam));
  const urlBandId = bParam || wParam;

  // 1. Strictly load persisted sessions (never overwrite active stored data)
  let sessions: SessionDictionary;
  if (hasStoredSessionsKey()) {
    sessions = loadActiveSessions();
    // If legacy pre-Leaflet entries were filtered out and no bands were returned yet, seed fresh demo band for Booth
    if (
      Object.keys(sessions).length === 0 &&
      !isUrlParent &&
      !isUrlBand &&
      loadReturnedCount() === 0
    ) {
      const demo = createDemoBand(CLIENT_ID);
      sessions = { [demo.bandId]: demo };
      saveActiveSessions(sessions);
    }
  } else if (isUrlParent || isUrlBand) {
    sessions = {};
  } else {
    const demo = createDemoBand(CLIENT_ID);
    sessions = { [demo.bandId]: demo };
    saveActiveSessions(sessions);
  }

  // 2. Strict Role Resolution + Auto-Resume on Reopen
  let role: StoredDeviceRole;
  if (isUrlBand && urlBandId) {
    role = { role: 'band', activeBandId: urlBandId };
    saveMyRole(role);
  } else if (isUrlParent && urlBandId) {
    role = { role: 'parent', activeBandId: urlBandId };
    saveMyRole(role);
  } else {
    const saved = loadMyRole();
    if (saved && (saved.role === 'parent' || saved.role === 'band') && saved.activeBandId) {
      role = saved;
    } else if (saved && saved.role === 'booth') {
      role = saved;
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
  const [boothTab, setBoothTab] = useState<BoothTabId>('console');
  const [returnedCount, setReturnedCount] = useState<number>(() =>
    loadReturnedCount()
  );
  const [lastReturnedInfo, setLastReturnedInfo] = useState<{
    bandId: string;
    childName: string;
  } | null>(null);
  const [boothOrigin, setBoothOrigin] = useState<LatLngTuple>(DEFAULT_ORIGIN);
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

  // Acquire real GPS origin once on Booth console for accurate room-scale mapping
  useEffect(() => {
    if (deviceRole.role !== 'booth' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBoothOrigin([
          Number(pos.coords.latitude.toFixed(7)),
          Number(pos.coords.longitude.toFixed(7)),
        ]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }, [deviceRole.role]);

  const addToast = useCallback((type: ToastMessage['type'], title: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [{ id, type, title }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
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

  useEffect(() => {
    saveActiveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveMyRole(deviceRole);
  }, [deviceRole]);

  useEffect(() => {
    saveReturnedCount(returnedCount);
  }, [returnedCount]);

  // Dual-Broker Auto-Healing MQTT + BroadcastChannel live sync
  useEffect(() => {
    liveSync.start();
    const unsubStatus = liveSync.onStatus(setSyncStatus);
    const unsubUpdate = liveSync.onUpdate((incoming) => {
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
        setDeviceRole((prevRole) => {
          if (
            prevRole.activeBandId === incoming.bandId &&
            (prevRole.role === 'parent' || prevRole.role === 'band')
          ) {
            saveMyRole({ role: 'booth', activeBandId: '' });
            return prevRole;
          }
          return prevRole;
        });
        void playShortChime('unlock');
        return;
      }

      setSessions((prev) => {
        const existing = prev[incoming.bandId];
        if (
          existing &&
          incoming.eventId < existing.eventId &&
          incoming.lastUpdated < existing.lastUpdated
        ) {
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

  // Subscribe to all active bands + bound role band
  useEffect(() => {
    if (deviceRole.activeBandId) {
      liveSync.subscribeBand(deviceRole.activeBandId);
    }
    activeBands.forEach((b) => liveSync.subscribeBand(b.bandId));
  }, [activeBands, deviceRole.activeBandId]);

  // Flush Booth active bands on initial connect so scanning phones immediately receive retained state
  useEffect(() => {
    if (syncStatus === 'connected' && deviceRole.role === 'booth') {
      activeBands.forEach((b) => liveSync.publishState(b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  const updateAndPublishBand = useCallback(
    (bandId: string, updater: (prev: LiveBandState) => LiveBandState) => {
      setSessions((prev) => {
        const existing = prev[bandId];
        if (!existing || existing.isReturned) return prev;
        const now = Date.now();
        const updated: LiveBandState = {
          ...updater(existing),
          lastUpdated: now,
          eventId: Math.max(now, (existing.eventId ?? 0) + 1),
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

  // Issue New Wristband from Booth
  const handleCreateBand = useCallback(
    (params: {
      editionId: BandEditionId;
      childName: string;
      guardianPhone: string;
      safeLimitM: number;
    }) => {
      const bandId = generateBandId(params.editionId);
      const newBand = createInitialBandState({
        bandId,
        childName: params.childName,
        editionId: params.editionId,
        guardianPhone: params.guardianPhone,
        pinCode: generatePin(),
        safeLimitM: params.safeLimitM,
        origin: boothOrigin,
        senderId: CLIENT_ID,
      });

      setSessions((prev) => {
        const next: SessionDictionary = { ...prev, [bandId]: newBand };
        saveActiveSessions(next);
        return next;
      });
      setLastReturnedInfo(null);
      updateDeviceRole({ role: 'booth', activeBandId: bandId });
      liveSync.publishState(newBand);
      void playShortChime('lock');
      addToast('success', `تم تفعيل السوار ${bandId}`);
    },
    [boothOrigin, updateDeviceRole, addToast]
  );

  // Sensor-Fusion Child Movement + Repeatable Breach/Gate Alert Evaluation
  const handleMoveChild = useCallback(
    (
      bandId: string,
      nextCoords: LatLngTuple,
      opts: { addSteps: number; headingDeg?: number; source: 'gps' | 'fusion' }
    ) => {
      updateAndPublishBand(bandId, (prev) => {
        const zoneInfo = deriveZoneLabel(
          nextCoords,
          prev.parentCoords,
          prev.gateCoords,
          prev.safeLimitM
        );
        const dist = zoneInfo.distParent;

        let activeAlert = prev.activeAlert;

        if (zoneInfo.nearGate) {
          // Always generate a fresh alertId if not currently showing an unacknowledged GATE alert
          if (
            !activeAlert ||
            activeAlert.acknowledged ||
            activeAlert.type !== 'GATE_PROXIMITY'
          ) {
            activeAlert = {
              alertId: createNewAlertId(),
              type: 'GATE_PROXIMITY',
              title: 'تحذير: الطفل يقترب من بوابة الخروج',
              locationLabel: 'بوابة الخروج',
              distanceM: dist,
              ts: Date.now(),
              acknowledged: false,
              securityNotified: false,
            };
          } else {
            activeAlert = { ...activeAlert, distanceM: dist };
          }
        } else if (dist > prev.safeLimitM) {
          // Trigger fresh repeatable alert if previous was cleared/acknowledged or moved 2m further
          if (
            !activeAlert ||
            activeAlert.acknowledged ||
            (activeAlert.type !== 'TAMPER_ATTEMPT' &&
              activeAlert.type !== 'DISTANCE_BREACH')
          ) {
            activeAlert = {
              alertId: createNewAlertId(),
              type: 'DISTANCE_BREACH',
              title: `تنبيه: ابتعد السوار مسافة ${dist.toFixed(1)} متر`,
              locationLabel: 'خارج النطاق',
              distanceM: dist,
              ts: Date.now(),
              acknowledged: false,
              securityNotified: false,
            };
          } else if (activeAlert.type === 'DISTANCE_BREACH') {
            activeAlert = {
              ...activeAlert,
              title: `تنبيه: ابتعد السوار مسافة ${dist.toFixed(1)} متر`,
              distanceM: dist,
            };
          }
        } else if (activeAlert && activeAlert.type !== 'TAMPER_ATTEMPT') {
          // Child returned inside safe ring: cleanly clear distance/gate alert so next exit re-fires
          activeAlert = null;
        }

        const nextHistory = [...prev.pathHistory.slice(-45), nextCoords];

        return {
          ...prev,
          childCoords: nextCoords,
          pathHistory: nextHistory,
          steps: prev.steps + opts.addSteps,
          headingDeg: opts.headingDeg ?? prev.headingDeg,
          distanceMeters: dist,
          gpsSource: opts.source,
          currentZoneLabel: zoneInfo.label,
          activeAlert,
        };
      });
    },
    [updateAndPublishBand]
  );

  // Parent GPS updates Parent anchor & Virtual Gate smoothly if parent moves
  const handleUpdateParentGps = useCallback(
    (bandId: string, coords: LatLngTuple) => {
      updateAndPublishBand(bandId, (prev) => {
        const zoneInfo = deriveZoneLabel(
          prev.childCoords,
          coords,
          prev.gateCoords,
          prev.safeLimitM
        );
        return {
          ...prev,
          parentCoords: coords,
          distanceMeters: zoneInfo.distParent,
          currentZoneLabel: zoneInfo.label,
        };
      });
    },
    [updateAndPublishBand]
  );

  // Repeatable Gate Proximity Trigger (ALWAYS generates brand-new unique alertId!)
  const handleTriggerGate = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) => {
        const gatePos = prev.gateCoords;
        const zoneInfo = deriveZoneLabel(
          gatePos,
          prev.parentCoords,
          prev.gateCoords,
          prev.safeLimitM
        );
        return {
          ...prev,
          childCoords: gatePos,
          pathHistory: [...prev.pathHistory.slice(-45), gatePos],
          steps: prev.steps + 8,
          distanceMeters: zoneInfo.distParent,
          currentZoneLabel: 'بوابة الخروج',
          activeAlert: {
            alertId: createNewAlertId(),
            type: 'GATE_PROXIMITY',
            title: 'تحذير: الطفل يقترب من بوابة الخروج',
            locationLabel: 'بوابة الخروج',
            distanceM: zoneInfo.distParent,
            ts: Date.now(),
            acknowledged: false,
            securityNotified: false,
          },
        };
      });
      addToast('error', 'تم إرسال تنبيه بوابة الخروج');
    },
    [updateAndPublishBand, addToast]
  );

  // Repeatable Tamper Trigger (ALWAYS generates brand-new unique alertId!)
  const handleTriggerTamper = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) => {
        const zoneInfo = deriveZoneLabel(
          prev.childCoords,
          prev.parentCoords,
          prev.gateCoords,
          prev.safeLimitM
        );
        return {
          ...prev,
          activeAlert: {
            alertId: createNewAlertId(),
            type: 'TAMPER_ATTEMPT',
            title: 'تحذير: محاولة فك السوار بدون إذن',
            locationLabel: zoneInfo.label,
            distanceM: zoneInfo.distParent,
            ts: Date.now(),
            acknowledged: false,
            securityNotified: false,
          },
        };
      });
      addToast('error', 'تم إرسال تنبيه محاولة فك السوار');
    },
    [updateAndPublishBand, addToast]
  );

  // 1-Tap Jury Demo Reset (re-centers child next to parent, clears trail & alerts, keeps session active!)
  const handleDemoReset = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) => {
        const startChild = offsetLatLng(prev.parentCoords, 1.4, 1.1);
        const gateCoords = computeGateCoords(prev.parentCoords);
        const zoneInfo = deriveZoneLabel(
          startChild,
          prev.parentCoords,
          gateCoords,
          prev.safeLimitM
        );
        return {
          ...prev,
          childCoords: startChild,
          gateCoords,
          pathHistory: [prev.parentCoords, startChild],
          steps: 0,
          headingDeg: 45,
          distanceMeters: zoneInfo.distParent,
          currentZoneLabel: 'النطاق الآمن',
          activeAlert: null,
        };
      });
      void playShortChime('lock');
      addToast('success', 'تمت إعادة ضبط المسار');
    },
    [updateAndPublishBand, addToast]
  );

  const handleChangeSafeLimit = useCallback(
    (bandId: string, safeLimitM: number) => {
      updateAndPublishBand(bandId, (prev) => ({ ...prev, safeLimitM }));
      addToast('info', `نطاق الأمان ${safeLimitM} متر`);
    },
    [updateAndPublishBand, addToast]
  );

  // Acknowledge ONLY that exact alertId so next triggers always fire cleanly
  const handleAcknowledgeAlert = useCallback(
    (bandId: string, alertId: number) => {
      updateAndPublishBand(bandId, (prev) => {
        if (!prev.activeAlert || prev.activeAlert.alertId !== alertId) {
          return prev;
        }
        return {
          ...prev,
          activeAlert: { ...prev.activeAlert, acknowledged: true },
        };
      });
      addToast('info', 'تم إيقاف الإنذار');
    },
    [updateAndPublishBand, addToast]
  );

  const handleNotifySecurity = useCallback(
    (bandId: string, alertId: number) => {
      updateAndPublishBand(bandId, (prev) => {
        if (!prev.activeAlert || prev.activeAlert.alertId !== alertId) {
          return prev;
        }
        return {
          ...prev,
          activeAlert: { ...prev.activeAlert, securityNotified: true },
        };
      });
      addToast('error', 'تم إبلاغ الأمن فوراً');
    },
    [updateAndPublishBand, addToast]
  );

  // Official Return & Unlock via 4-Digit PIN
  const handleUnlockAndReturn = useCallback(
    (bandId: string, pin: string): boolean => {
      const target = sessions[bandId];
      if (!target || target.isReturned) return false;

      if (pin !== target.pinCode) {
        void playShortChime('denied');
        handleTriggerTamper(bandId);
        return false;
      }

      void playShortChime('unlock');
      liveSync.publishReturnAndClearRetained(target);

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

      const remaining = activeBands.filter((b) => b.bandId !== bandId);
      updateDeviceRole({
        role: 'booth',
        activeBandId: remaining[0]?.bandId ?? '',
      });

      addToast('success', 'تم فك القفل وتسليم السوار بنجاح');
      return true;
    },
    [sessions, activeBands, handleTriggerTamper, updateDeviceRole, addToast]
  );

  const handleAdminExitToBooth = useCallback(() => {
    const firstActiveId = activeBands[0]?.bandId ?? '';
    updateDeviceRole({ role: 'booth', activeBandId: firstActiveId });
    setBoothTab('console');
    setLastReturnedInfo(null);
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeBands, updateDeviceRole]);

  // ROUTE 1: STRICTLY ISOLATED PARENT LOCKED VIEW (?role=parent&b=XXXX or ?b=XXXX)
  if (deviceRole.role === 'parent' && deviceRole.activeBandId) {
    const boundBand = sessions[deviceRole.activeBandId] ?? null;
    return (
      <>
        <ParentTab
          band={boundBand}
          lockedBandId={deviceRole.activeBandId}
          returnedBandInfo={lastReturnedInfo}
          syncStatus={syncStatus}
          onUpdateParentGps={handleUpdateParentGps}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onNotifySecurity={handleNotifySecurity}
          onAdminExit={handleAdminExitToBooth}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  // ROUTE 2: STRICTLY ISOLATED CHILD SMART WRISTBAND VIEW (?role=band&b=XXXX or ?w=XXXX)
  if (deviceRole.role === 'band' && deviceRole.activeBandId) {
    const boundBand = sessions[deviceRole.activeBandId] ?? null;
    return (
      <>
        <BandWearableView
          band={boundBand}
          lockedBandId={deviceRole.activeBandId}
          returnedBandInfo={lastReturnedInfo}
          syncStatus={syncStatus}
          onMoveChild={handleMoveChild}
          onTriggerGate={handleTriggerGate}
          onTriggerTamper={handleTriggerTamper}
          onDemoReset={handleDemoReset}
          onAdminExit={handleAdminExitToBooth}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  // ROUTE 3: SECURITY / BOOTH CONSOLE (Default /)
  return (
    <div className="min-h-screen">
      <TopNav
        activeTab={boothTab}
        onSelectTab={setBoothTab}
        syncStatus={syncStatus}
        activeCount={activeBands.length}
      />

      <main>
        {boothTab === 'console' && (
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
            onChangeSafeLimit={handleChangeSafeLimit}
            onMoveChild={handleMoveChild}
            onTriggerGate={handleTriggerGate}
            onTriggerTamper={handleTriggerTamper}
            onDemoReset={handleDemoReset}
            onUnlockAndReturn={handleUnlockAndReturn}
            onLaunchLockedRole={(role, bandId) => {
              updateDeviceRole({ role, activeBandId: bandId });
            }}
            onDismissReturnedBanner={() => setLastReturnedInfo(null)}
          />
        )}

        {boothTab === 'print' && (
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
