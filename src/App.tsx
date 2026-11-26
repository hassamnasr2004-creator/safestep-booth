import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BandEditionId,
  LiveBandState,
  MainTabId,
  MallPoint,
  ReturnedBandRecord,
  ScenarioId,
  SessionDictionary,
  SyncStatus,
  ToastMessage,
} from './types/safestep';
import {
  DEFAULT_CHILD_POS,
  DEFAULT_PARENT_POS,
  MALL_GATES,
  clampMallPoint,
  createDemoBand,
  createInitialBandState,
  createNewAlertId,
  evaluateMallPosition,
  generateBandId,
  generatePin,
} from './data/safestepData';
import {
  CLIENT_ID,
  clearLegacyStuckStorage,
  liveSync,
  loadJuryStorage,
  saveJuryStorage,
} from './utils/liveSync';
import { playShortChime } from './utils/audioAlerts';
import { TopNav } from './components/TopNav';
import { BoothTab } from './components/BoothTab';
import { ParentTab } from './components/ParentTab';
import { BandWearableView } from './components/BandWearableView';
import { PrintQrTab } from './components/PrintQrTab';
import { ToastStack } from './components/ToastStack';

const BASE_URL_KEY = 'safestep_public_base_url_v4';

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

interface BootState {
  sessions: SessionDictionary;
  returnedHistory: Record<string, ReturnedBandRecord>;
  returnedCount: number;
  selectedBandId: string;
  scanMode: 'none' | 'parent' | 'band';
  scanBandId: string;
}

function bootstrapJuryApp(): BootState {
  // Explicitly delete any legacy stuck role keys so the presenter is NEVER trapped
  clearLegacyStuckStorage();

  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const pParam = params.get('p')?.trim().toUpperCase() || '';
  const wParam = params.get('w')?.trim().toUpperCase() || '';
  const legacyRole = params.get('role')?.trim().toLowerCase() || '';
  const legacyB = params.get('b')?.trim().toUpperCase() || '';

  let scanMode: BootState['scanMode'] = 'none';
  let scanBandId = '';

  if (pParam) {
    scanMode = 'parent';
    scanBandId = pParam;
  } else if (wParam) {
    scanMode = 'band';
    scanBandId = wParam;
  } else if (legacyRole === 'band' && legacyB) {
    scanMode = 'band';
    scanBandId = legacyB;
  } else if (legacyB) {
    scanMode = 'parent';
    scanBandId = legacyB;
  }

  const stored = loadJuryStorage();
  let sessions: SessionDictionary = stored?.sessions ?? {};
  const returnedHistory = stored?.returnedHistory ?? {};
  const returnedCount = stored?.returnedCount ?? 0;

  // On main app (/), always guarantee an active ready-to-demo wristband if none exist and none returned yet
  if (
    scanMode === 'none' &&
    Object.keys(sessions).length === 0 &&
    returnedCount === 0
  ) {
    const demo = createDemoBand(CLIENT_ID);
    sessions = { [demo.bandId]: demo };
    saveJuryStorage({ sessions, returnedHistory, returnedCount });
  }

  const firstId = Object.keys(sessions)[0] ?? '';
  return {
    sessions,
    returnedHistory,
    returnedCount,
    selectedBandId: scanBandId || firstId,
    scanMode,
    scanBandId,
  };
}

// Evaluate next band state after child or parent moves on the Smart Mall Map
function applyPositionEvaluation(
  prev: LiveBandState,
  nextChild: MallPoint,
  nextParent: MallPoint,
  opts: {
    addSteps: number;
    headingDeg?: number;
    appendTrail: boolean;
  }
): LiveBandState {
  const evalInfo = evaluateMallPosition(nextChild, nextParent, prev.safeLimitM);
  const dist = evalInfo.distParent;

  let activeAlert = prev.activeAlert;
  let recoveryNotice = prev.recoveryNotice;

  // Keep TAMPER_ATTEMPT until Parent/Security confirms clasp lock
  if (
    (prev.lockStatus === 'tampered' ||
      prev.activeAlert?.type === 'TAMPER_ATTEMPT') &&
    prev.activeAlert &&
    !prev.activeAlert.acknowledged
  ) {
    activeAlert = { ...prev.activeAlert, distanceM: dist };
  } else if (evalInfo.nearGate && evalInfo.nearestGate) {
    const gateNum = evalInfo.nearestGate.id;
    if (
      !activeAlert ||
      activeAlert.acknowledged ||
      activeAlert.type !== 'GATE_PROXIMITY' ||
      activeAlert.gateNumber !== gateNum
    ) {
      activeAlert = {
        alertId: createNewAlertId(),
        type: 'GATE_PROXIMITY',
        title: `تحذير: الطفل يقترب من بوابة الخروج ${gateNum}`,
        locationLabel: `بوابة الخروج ${gateNum}`,
        gateNumber: gateNum,
        distanceM: dist,
        ts: Date.now(),
        acknowledged: false,
        securityNotified: false,
      };
    } else {
      activeAlert = { ...activeAlert, distanceM: dist };
    }
  } else if (
    prev.activeAlert?.type === 'GATE_PROXIMITY' &&
    evalInfo.nearestGateDist > 6.2
  ) {
    // Auto-clear GATE_PROXIMITY once child moves back away from exit gate
    if (!evalInfo.outsideSafe) {
      activeAlert = null;
      recoveryNotice = {
        id: createNewAlertId(),
        kind: 'gate',
        text: 'ابتعد الطفل عن البوابة وعاد لمنطقة آمنة — توقف الإنذار تلقائياً',
        ts: Date.now(),
      };
    } else {
      activeAlert = {
        alertId: createNewAlertId(),
        type: 'DISTANCE_BREACH',
        title: `تنبيه: ابتعد الطفل وتجاوز نطاق الأمان (${dist.toFixed(1)} متر)`,
        locationLabel: evalInfo.zoneName,
        distanceM: dist,
        ts: Date.now(),
        acknowledged: false,
        securityNotified: false,
      };
    }
  } else if (evalInfo.outsideSafe) {
    // Distance Breach Alert
    if (
      !activeAlert ||
      activeAlert.acknowledged ||
      activeAlert.type !== 'DISTANCE_BREACH'
    ) {
      activeAlert = {
        alertId: createNewAlertId(),
        type: 'DISTANCE_BREACH',
        title: `تنبيه: ابتعد الطفل وتجاوز نطاق الأمان (${dist.toFixed(1)} متر)`,
        locationLabel: evalInfo.zoneName,
        distanceM: dist,
        ts: Date.now(),
        acknowledged: false,
        securityNotified: false,
      };
    } else {
      activeAlert = {
        ...activeAlert,
        title: `تنبيه: ابتعد الطفل وتجاوز نطاق الأمان (${dist.toFixed(1)} متر)`,
        locationLabel: evalInfo.zoneName,
        distanceM: dist,
      };
    }
  } else {
    // Child is inside Safe Radius & away from gates -> AUTOMATIC ALARM SHUTOFF!
    if (prev.activeAlert?.type === 'DISTANCE_BREACH') {
      activeAlert = null;
      recoveryNotice = {
        id: createNewAlertId(),
        kind: 'distance',
        text: 'عاد الطفل إلى النطاق الآمن — توقف الإنذار تلقائياً',
        ts: Date.now(),
      };
    } else if (
      prev.activeAlert?.type === 'GATE_PROXIMITY' &&
      evalInfo.nearestGateDist > 6.2
    ) {
      activeAlert = null;
      recoveryNotice = {
        id: createNewAlertId(),
        kind: 'gate',
        text: 'ابتعد الطفل عن البوابة وعاد لمنطقة آمنة — توقف الإنذار تلقائياً',
        ts: Date.now(),
      };
    }
  }

  let nextHistory = prev.pathHistory;
  if (opts.appendTrail) {
    const lastPt = prev.pathHistory[prev.pathHistory.length - 1];
    const moved = lastPt
      ? Math.hypot(nextChild.x - lastPt.x, nextChild.y - lastPt.y)
      : 99;
    if (moved >= 0.7) {
      nextHistory = [...prev.pathHistory.slice(-55), nextChild];
    }
  }

  return {
    ...prev,
    parentPos: nextParent,
    childPos: nextChild,
    pathHistory: nextHistory,
    steps: prev.steps + opts.addSteps,
    headingDeg: opts.headingDeg ?? prev.headingDeg,
    distanceMeters: dist,
    currentZoneLabel: evalInfo.zoneName,
    nearGateNumber:
      evalInfo.nearGate && evalInfo.nearestGate ? evalInfo.nearestGate.id : null,
    activeAlert,
    recoveryNotice,
  };
}

export default function App() {
  const [boot] = useState(() => bootstrapJuryApp());
  const [sessions, setSessions] = useState<SessionDictionary>(boot.sessions);
  const [returnedHistory, setReturnedHistory] = useState<
    Record<string, ReturnedBandRecord>
  >(boot.returnedHistory);
  const [returnedCount, setReturnedCount] = useState<number>(boot.returnedCount);
  const [selectedBandId, setSelectedBandId] = useState<string>(
    boot.selectedBandId
  );
  const [scanMode, setScanMode] = useState<BootState['scanMode']>(boot.scanMode);
  const [scanBandId, setScanBandId] = useState<string>(boot.scanBandId);
  const [activeTab, setActiveTab] = useState<MainTabId>('booth');
  const [lastReturnedInfo, setLastReturnedInfo] =
    useState<ReturnedBandRecord | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(getInitialBaseUrl);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const scenarioTimerRef = useRef<number | null>(null);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const stopScenarioAnimation = useCallback(() => {
    if (scenarioTimerRef.current !== null) {
      window.clearInterval(scenarioTimerRef.current);
      scenarioTimerRef.current = null;
    }
    setActiveScenario(null);
  }, []);

  useEffect(() => {
    return () => {
      if (scenarioTimerRef.current !== null) {
        window.clearInterval(scenarioTimerRef.current);
      }
    };
  }, []);

  const activeBands = useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => !s.isReturned)
        .sort((a, b) => b.createdAt - a.createdAt),
    [sessions]
  );

  // Persist to fresh safestep_jury_v4 storage key continuously
  useEffect(() => {
    saveJuryStorage({ sessions, returnedHistory, returnedCount });
  }, [sessions, returnedHistory, returnedCount]);

  const addToast = useCallback((type: ToastMessage['type'], title: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [{ id, type, title }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const handleChangeBaseUrl = useCallback((next: string) => {
    setBaseUrl(next);
    try {
      window.localStorage.setItem(BASE_URL_KEY, next);
    } catch {
      // Ignore
    }
  }, []);

  // Dual-Broker Auto-Healing MQTT + BroadcastChannel live sync
  useEffect(() => {
    liveSync.start();
    const unsubStatus = liveSync.onStatus(setSyncStatus);
    const unsubUpdate = liveSync.onUpdate((incoming) => {
      if (incoming.isReturned) {
        const record: ReturnedBandRecord = {
          bandId: incoming.bandId,
          childName: incoming.childName,
          returnedAt: incoming.returnedAt ?? incoming.lastUpdated ?? Date.now(),
        };
        setReturnedHistory((prev) => ({ ...prev, [record.bandId]: record }));
        setSessions((prev) => {
          const next = { ...prev };
          delete next[incoming.bandId];
          return next;
        });
        setLastReturnedInfo(record);
        setReturnedCount((c) => c + 1);
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
        return {
          ...prev,
          [incoming.bandId]: incoming,
        };
      });
    });

    return () => {
      unsubStatus();
      unsubUpdate();
    };
  }, []);

  // Subscribe to all active bands + scanned QR band
  useEffect(() => {
    if (scanBandId) {
      liveSync.subscribeBand(scanBandId);
    }
    if (selectedBandId) {
      liveSync.subscribeBand(selectedBandId);
    }
    activeBands.forEach((b) => liveSync.subscribeBand(b.bandId));
  }, [activeBands, scanBandId, selectedBandId]);

  // Republish Booth active bands upon connect so freshly scanned phones immediately receive retained state
  useEffect(() => {
    if (syncStatus === 'connected' && scanMode === 'none') {
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
        liveSync.publishState(updated);
        return { ...prev, [bandId]: updated };
      });
    },
    []
  );

  // Issue New Wristband
  const handleCreateBand = useCallback(
    (params: {
      editionId: BandEditionId;
      childName: string;
      guardianPhone: string;
      safeLimitM: number;
    }) => {
      stopScenarioAnimation();
      const bandId = generateBandId(params.editionId);
      const newBand = createInitialBandState({
        bandId,
        childName: params.childName,
        editionId: params.editionId,
        guardianPhone: params.guardianPhone,
        pinCode: generatePin(),
        safeLimitM: params.safeLimitM,
        senderId: CLIENT_ID,
      });

      setSessions((prev) => ({ ...prev, [bandId]: newBand }));
      setSelectedBandId(bandId);
      setLastReturnedInfo(null);
      liveSync.publishState(newBand);
      void playShortChime('lock');
      addToast('success', `تم تفعيل السوار ${bandId}`);
    },
    [stopScenarioAnimation, addToast]
  );

  // Direct Drag Child Pin on Smart Mall Map
  const handleDragChild = useCallback(
    (bandId: string, rawPos: MallPoint) => {
      stopScenarioAnimation();
      const pos = clampMallPoint(rawPos);
      updateAndPublishBand(bandId, (prev) => {
        const moved = Math.hypot(
          pos.x - prev.childPos.x,
          pos.y - prev.childPos.y
        );
        const addSteps = moved >= 0.8 ? Math.max(1, Math.round(moved)) : 0;
        const headingDeg =
          moved > 0.2
            ? Math.round(
                ((Math.atan2(pos.x - prev.childPos.x, -(pos.y - prev.childPos.y)) *
                  180) /
                  Math.PI +
                  360) %
                  360
              )
            : prev.headingDeg;
        return applyPositionEvaluation(prev, pos, prev.parentPos, {
          addSteps,
          headingDeg,
          appendTrail: true,
        });
      });
    },
    [stopScenarioAnimation, updateAndPublishBand]
  );

  // Direct Drag Parent Beacon Pin on Smart Mall Map
  const handleDragParent = useCallback(
    (bandId: string, rawPos: MallPoint) => {
      const pos = clampMallPoint(rawPos);
      updateAndPublishBand(bandId, (prev) =>
        applyPositionEvaluation(prev, prev.childPos, pos, {
          addSteps: 0,
          appendTrail: false,
        })
      );
    },
    [updateAndPublishBand]
  );

  // 8-Direction D-Pad Step
  const handleStepDirection = useCallback(
    (bandId: string, dxM: number, dyM: number) => {
      stopScenarioAnimation();
      void playShortChime('step');
      updateAndPublishBand(bandId, (prev) => {
        const nextChild = clampMallPoint({
          x: prev.childPos.x + dxM,
          y: prev.childPos.y + dyM,
        });
        const headingDeg = Math.round(
          ((Math.atan2(dxM, -dyM) * 180) / Math.PI + 360) % 360
        );
        return applyPositionEvaluation(prev, nextChild, prev.parentPos, {
          addSteps: 2,
          headingDeg,
          appendTrail: true,
        });
      });
    },
    [stopScenarioAnimation, updateAndPublishBand]
  );

  // Regular +1m Step outward along current heading
  const handleRegularStep = useCallback(
    (bandId: string) => {
      stopScenarioAnimation();
      void playShortChime('step');
      updateAndPublishBand(bandId, (prev) => {
        const rad = (prev.headingDeg * Math.PI) / 180;
        const dx = Math.sin(rad) * 1.0;
        const dy = -Math.cos(rad) * 1.0;
        const nextChild = clampMallPoint({
          x: prev.childPos.x + dx,
          y: prev.childPos.y + dy,
        });
        return applyPositionEvaluation(prev, nextChild, prev.parentPos, {
          addSteps: 1,
          appendTrail: true,
        });
      });
    },
    [stopScenarioAnimation, updateAndPublishBand]
  );

  // 1-Click Smooth Animated Jury Demo Scenarios (Deterministic Waypoints!)
  const handleRunScenario = useCallback(
    (bandId: string, scenario: ScenarioId) => {
      const band = sessionsRef.current[bandId];
      if (!band || band.isReturned) return;

      stopScenarioAnimation();
      setActiveScenario(scenario);

      // Compute clean deterministic architectural waypoints based on current parentPos & safeLimitM
      const p = band.parentPos;
      let waypoints: MallPoint[] = [];

      if (scenario === 'kids_arena') {
        // Walk smoothly along corridor into Kids Arena staying Green/Safe inside safeLimitM
        const desired = { x: 64, y: 21 };
        const dx = desired.x - p.x;
        const dy = desired.y - p.y;
        const d = Math.hypot(dx, dy);
        const maxSafe = Math.max(4, band.safeLimitM - 1.4);
        const target: MallPoint =
          d > maxSafe && d > 0
            ? clampMallPoint({
                x: p.x + (dx / d) * maxSafe,
                y: p.y + (dy / d) * maxSafe,
              })
            : desired;
        waypoints = [
          clampMallPoint({ x: (band.childPos.x + target.x) / 2, y: 28 }),
          target,
        ];
        addToast('info', 'بدء سيناريو: تمشية آمنة لمنطقة الألعاب');
      } else if (scenario === 'breach_safe') {
        // Walk smoothly into upper-left Food Court cleanly past safeLimitM (away from perimeter gates!)
        const breachDist = Math.min(34, band.safeLimitM + 6.5);
        const angleRad = (-140 * Math.PI) / 180; // Toward Food Court (top-left)
        const target = clampMallPoint({
          x: Math.max(14, Math.min(86, p.x + Math.cos(angleRad) * breachDist)),
          y: Math.max(12, Math.min(52, p.y + Math.sin(angleRad) * breachDist)),
        });
        waypoints = [
          clampMallPoint({ x: Math.max(24, p.x - 8), y: Math.max(20, p.y - 6) }),
          target,
        ];
        addToast('warning', 'بدء سيناريو: ابتعاد وتجاوز نطاق الأمان');
      } else if (scenario === 'return_parent') {
        // Walk child straight back inside Parent's safe circle -> triggers AUTOMATIC ALARM SHUTOFF!
        const target = clampMallPoint({
          x: p.x + 2.8,
          y: p.y - 1.2,
        });
        waypoints = [target];
        addToast('success', 'بدء سيناريو: عودة الطفل لولي الأمر');
      } else if (scenario === 'gate_danger') {
        // Walk smoothly along main east corridor right up to Gate 2 glowing laser!
        const gate2 = MALL_GATES.find((g) => g.id === 2)!;
        waypoints = [
          { x: Math.max(band.childPos.x, 66), y: 32 },
          gate2.approachPoint,
        ];
        addToast('error', 'بدء سيناريو: اقتراب خطير من بوابة الخروج 2');
      }

      let wpIndex = 0;

      scenarioTimerRef.current = window.setInterval(() => {
        const curBand = sessionsRef.current[bandId];
        if (!curBand || curBand.isReturned || wpIndex >= waypoints.length) {
          stopScenarioAnimation();
          return;
        }

        const goal = waypoints[wpIndex];
        const dx = goal.x - curBand.childPos.x;
        const dy = goal.y - curBand.childPos.y;
        const distToGoal = Math.hypot(dx, dy);
        const stepSize = 1.45; // smooth 1.45m per 150ms tick

        let nextPos: MallPoint;
        if (distToGoal <= stepSize) {
          nextPos = goal;
          wpIndex += 1;
        } else {
          nextPos = clampMallPoint({
            x: curBand.childPos.x + (dx / distToGoal) * stepSize,
            y: curBand.childPos.y + (dy / distToGoal) * stepSize,
          });
        }

        const headingDeg = Math.round(
          ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
        );

        updateAndPublishBand(bandId, (prev) =>
          applyPositionEvaluation(prev, nextPos, prev.parentPos, {
            addSteps: 2,
            headingDeg,
            appendTrail: true,
          })
        );

        if (wpIndex >= waypoints.length) {
          stopScenarioAnimation();
        }
      }, 150);
    },
    [stopScenarioAnimation, updateAndPublishBand, addToast]
  );

  // Clear Footsteps Trail on Map
  const handleClearTrail = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) => ({
        ...prev,
        pathHistory: [prev.childPos],
      }));
      addToast('info', 'تم مسح مسار الخطوات');
    },
    [updateAndPublishBand, addToast]
  );

  // Safe Radius Slider (10m - 35m) with live auto-recovery / breach evaluation
  const handleChangeSafeLimit = useCallback(
    (bandId: string, safeLimitM: number) => {
      updateAndPublishBand(bandId, (prev) => {
        const withRadius: LiveBandState = { ...prev, safeLimitM };
        return applyPositionEvaluation(
          withRadius,
          withRadius.childPos,
          withRadius.parentPos,
          { addSteps: 0, appendTrail: false }
        );
      });
    },
    [updateAndPublishBand]
  );

  // Battery Slider (10% - 100%)
  const handleChangeBattery = useCallback(
    (bandId: string, batteryPct: number) => {
      updateAndPublishBand(bandId, (prev) => ({
        ...prev,
        batteryPct: Math.max(10, Math.min(100, Math.round(batteryPct))),
      }));
    },
    [updateAndPublishBand]
  );

  // Unauthorized Clasp Tamper Alert
  const handleTriggerTamper = useCallback(
    (bandId: string) => {
      stopScenarioAnimation();
      updateAndPublishBand(bandId, (prev) => {
        const evalInfo = evaluateMallPosition(
          prev.childPos,
          prev.parentPos,
          prev.safeLimitM
        );
        return {
          ...prev,
          lockStatus: 'tampered',
          activeAlert: {
            alertId: createNewAlertId(),
            type: 'TAMPER_ATTEMPT',
            title: 'إنذار أمني: محاولة فتح قفل السوار بدون تصريح',
            locationLabel: evalInfo.zoneName,
            distanceM: evalInfo.distParent,
            ts: Date.now(),
            acknowledged: false,
            securityNotified: false,
          },
        };
      });
      addToast('error', 'تم إطلاق إنذار محاولة فك السوار');
    },
    [stopScenarioAnimation, updateAndPublishBand, addToast]
  );

  // Confirm Clasp Secured -> immediately syncs silence across devices
  const handleSecureClasp = useCallback(
    (bandId: string) => {
      updateAndPublishBand(bandId, (prev) => ({
        ...prev,
        lockStatus: 'locked',
        activeAlert:
          prev.activeAlert?.type === 'TAMPER_ATTEMPT'
            ? null
            : prev.activeAlert,
        recoveryNotice: {
          id: createNewAlertId(),
          kind: 'tamper',
          text: 'تم تأكيد تأمين القفل الإلكتروني — توقف الإنذار',
          ts: Date.now(),
        },
      }));
      void playShortChime('lock');
      addToast('success', 'تم تأكيد تأمين القفل الإلكتروني');
    },
    [updateAndPublishBand, addToast]
  );

  // Acknowledge Distance/Gate Alert on Parent Phone
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
      addToast('info', 'تم إيقاف صوت الإنذار');
    },
    [updateAndPublishBand, addToast]
  );

  // Notify Mall Security from Parent Phone
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
      addToast('error', 'تم إبلاغ أمن المول فوراً');
    },
    [updateAndPublishBand, addToast]
  );

  // Comprehensive Reset for Next Jury Demo
  const handleFullReset = useCallback(
    (bandId: string) => {
      stopScenarioAnimation();
      updateAndPublishBand(bandId, (prev) => {
        const parentPos = { ...DEFAULT_PARENT_POS };
        const childPos = { ...DEFAULT_CHILD_POS };
        const evalInfo = evaluateMallPosition(childPos, parentPos, 15);
        return {
          ...prev,
          parentPos,
          childPos,
          pathHistory: [parentPos, childPos],
          steps: 0,
          headingDeg: 45,
          safeLimitM: 15,
          batteryPct: 98,
          lockStatus: 'locked',
          distanceMeters: evalInfo.distParent,
          currentZoneLabel: evalInfo.zoneName,
          nearGateNumber: null,
          activeAlert: null,
          recoveryNotice: null,
        };
      });
      void playShortChime('lock');
      addToast('success', 'تمت إعادة الضبط الشاملة للتجربة التالية');
    },
    [stopScenarioAnimation, updateAndPublishBand, addToast]
  );

  // Official Return via 4-Digit Security PIN
  const handleUnlockAndReturn = useCallback(
    (bandId: string, pin: string): boolean => {
      const target = sessions[bandId];
      if (!target || target.isReturned) return false;

      if (pin !== target.pinCode) {
        void playShortChime('denied');
        return false;
      }

      stopScenarioAnimation();
      const returnedAt = Date.now();
      const record: ReturnedBandRecord = {
        bandId: target.bandId,
        childName: target.childName,
        returnedAt,
      };

      void playShortChime('unlock');
      liveSync.publishReturnState(target);

      setReturnedHistory((prev) => ({ ...prev, [record.bandId]: record }));
      setSessions((prev) => {
        const next = { ...prev };
        delete next[bandId];
        return next;
      });
      setReturnedCount((c) => c + 1);
      setLastReturnedInfo(record);

      const remaining = activeBands.filter((b) => b.bandId !== bandId);
      setSelectedBandId(remaining[0]?.bandId ?? '');

      addToast('success', 'تم فك القفل وتسليم السوار بنجاح');
      return true;
    },
    [sessions, activeBands, stopScenarioAnimation, addToast]
  );

  const handleOpenMainDashboard = useCallback(() => {
    setScanMode('none');
    setScanBandId('');
    setActiveTab('booth');
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // Ensure demo band exists if user jumps from a fresh phone into Booth
    if (Object.keys(sessionsRef.current).length === 0) {
      const demo = createDemoBand(CLIENT_ID);
      setSessions({ [demo.bandId]: demo });
      setSelectedBandId(demo.bandId);
      liveSync.publishState(demo);
    }
  }, []);

  const currentBand =
    sessions[selectedBandId] ?? activeBands[0] ?? null;

  // DEDICATED SCANNED PARENT QR EXPERIENCE (?p=BAND_ID)
  if (scanMode === 'parent' && scanBandId) {
    const scannedBand = sessions[scanBandId] ?? null;
    const matchedReturned =
      returnedHistory[scanBandId] ??
      (lastReturnedInfo?.bandId === scanBandId ? lastReturnedInfo : null);
    return (
      <div className="min-h-screen">
        <ParentTab
          band={scannedBand}
          lockedBandId={scanBandId}
          returnedBandInfo={matchedReturned}
          syncStatus={syncStatus}
          isQrScanMode
          onDragParent={handleDragParent}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onSecureClasp={handleSecureClasp}
          onNotifySecurity={handleNotifySecurity}
          onOpenMainDashboard={handleOpenMainDashboard}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </div>
    );
  }

  // DEDICATED SCANNED WRISTBAND QR EXPERIENCE (?w=BAND_ID) — ALWAYS HAS RETURN TO BOOTH!
  if (scanMode === 'band' && scanBandId) {
    const scannedBand = sessions[scanBandId] ?? null;
    const matchedReturned =
      returnedHistory[scanBandId] ??
      (lastReturnedInfo?.bandId === scanBandId ? lastReturnedInfo : null);
    return (
      <div className="min-h-screen">
        <BandWearableView
          band={scannedBand}
          lockedBandId={scanBandId}
          returnedBandInfo={matchedReturned}
          syncStatus={syncStatus}
          activeScenario={activeScenario}
          onRunScenario={handleRunScenario}
          onStepDirection={handleStepDirection}
          onRegularStep={handleRegularStep}
          onDragChild={handleDragChild}
          onDragParent={handleDragParent}
          onClearTrail={handleClearTrail}
          onChangeSafeLimit={handleChangeSafeLimit}
          onChangeBattery={handleChangeBattery}
          onTriggerTamper={handleTriggerTamper}
          onSecureClasp={handleSecureClasp}
          onFullReset={handleFullReset}
          onReturnToBooth={handleOpenMainDashboard}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </div>
    );
  }

  // MAIN APP (/) — ALWAYS SHOWS FULL 4-TAB FROSTED GLASS NAVIGATION BAR (ZERO TRAPS!)
  return (
    <div className="min-h-screen">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        syncStatus={syncStatus}
        activeCount={activeBands.length}
      />

      <main>
        {activeTab === 'booth' && (
          <BoothTab
            activeBands={activeBands}
            selectedBandId={currentBand?.bandId ?? ''}
            returnedCount={returnedCount}
            lastReturnedInfo={lastReturnedInfo}
            baseUrl={baseUrl}
            activeScenario={activeScenario}
            onChangeBaseUrl={handleChangeBaseUrl}
            onSelectBand={setSelectedBandId}
            onCreateBand={handleCreateBand}
            onRunScenario={handleRunScenario}
            onStepDirection={handleStepDirection}
            onRegularStep={handleRegularStep}
            onDragChild={handleDragChild}
            onDragParent={handleDragParent}
            onClearTrail={handleClearTrail}
            onChangeSafeLimit={handleChangeSafeLimit}
            onChangeBattery={handleChangeBattery}
            onTriggerTamper={handleTriggerTamper}
            onSecureClasp={handleSecureClasp}
            onFullReset={handleFullReset}
            onUnlockAndReturn={handleUnlockAndReturn}
            onOpenPreviewTab={(tab) => setActiveTab(tab)}
            onDismissReturnedBanner={() => setLastReturnedInfo(null)}
          />
        )}

        {activeTab === 'parent' && (
          <ParentTab
            band={currentBand}
            lockedBandId={currentBand?.bandId ?? ''}
            returnedBandInfo={lastReturnedInfo}
            syncStatus={syncStatus}
            isQrScanMode={false}
            onDragParent={handleDragParent}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onSecureClasp={handleSecureClasp}
            onNotifySecurity={handleNotifySecurity}
          />
        )}

        {activeTab === 'band' && (
          <BandWearableView
            band={currentBand}
            lockedBandId={currentBand?.bandId ?? ''}
            returnedBandInfo={lastReturnedInfo}
            syncStatus={syncStatus}
            activeScenario={activeScenario}
            onRunScenario={handleRunScenario}
            onStepDirection={handleStepDirection}
            onRegularStep={handleRegularStep}
            onDragChild={handleDragChild}
            onDragParent={handleDragParent}
            onClearTrail={handleClearTrail}
            onChangeSafeLimit={handleChangeSafeLimit}
            onChangeBattery={handleChangeBattery}
            onTriggerTamper={handleTriggerTamper}
            onSecureClasp={handleSecureClasp}
            onFullReset={handleFullReset}
            onReturnToBooth={() => setActiveTab('booth')}
          />
        )}

        {activeTab === 'print' && (
          <PrintQrTab
            baseUrl={baseUrl}
            onChangeBaseUrl={handleChangeBaseUrl}
            defaultBandId={currentBand?.bandId}
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
