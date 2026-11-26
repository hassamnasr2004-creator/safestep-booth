import { useEffect, useRef, useState } from 'react';
import {
  Footprints,
  LocateFixed,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { GpsPoint, LiveBandState } from '../types/safestep';
import {
  MALL_ZONES,
  computeEffectiveDistance,
  detectZone,
  distanceToMapPosition,
} from '../data/safestepData';

interface WristbandLivePanelProps {
  band: LiveBandState;
  onBroadcastPatch: (updater: (prev: LiveBandState) => LiveBandState) => void;
  compact?: boolean;
}

export function WristbandLivePanel({
  band,
  onBroadcastPatch,
  compact = false,
}: WristbandLivePanelProps) {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastStepTsRef = useRef<number>(0);

  // Real GPS watchPosition for the Wristband device
  useEffect(() => {
    if (!gpsEnabled) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('الموقع غير مدعوم');
      setGpsEnabled(false);
      return;
    }

    setGpsError('');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gps: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          ts: Date.now(),
        };
        onBroadcastPatch((prev) => {
          const next: LiveBandState = {
            ...prev,
            coords: { ...prev.coords, band: gps },
          };
          const { meters } = computeEffectiveDistance(next);
          let activeAlert = prev.activeAlert;
          if (meters > prev.safeLimitM && activeAlert?.type !== 'tamper') {
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
      () => {
        setGpsError('تعذر قراءة GPS');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [gpsEnabled, onBroadcastPatch]);

  // Real DeviceMotion step sensor
  useEffect(() => {
    if (!motionEnabled) return;
    const handleMotion = (ev: DeviceMotionEvent) => {
      const acc = ev.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
      const now = Date.now();
      if (mag > 12.6 && now - lastStepTsRef.current > 450) {
        lastStepTsRef.current = now;
        onBroadcastPatch((prev) => {
          const nextDist = Math.min(35, prev.distanceMeters + 1);
          const pos = distanceToMapPosition(nextDist);
          const zone = detectZone(pos);
          return {
            ...prev,
            steps: prev.steps + 1,
            distanceMeters: nextDist,
            mapPos: pos,
            currentZone: zone.id,
            pathHistory: [...prev.pathHistory.slice(-24), pos],
          };
        });
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [motionEnabled, onBroadcastPatch]);

  const handleToggleMotion = async () => {
    if (motionEnabled) {
      setMotionEnabled(false);
      return;
    }
    const Dm = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof Dm?.requestPermission === 'function') {
      try {
        const res = await Dm.requestPermission();
        if (res !== 'granted') return;
      } catch {
        return;
      }
    }
    setMotionEnabled(true);
  };

  const applyIndoorDistance = (nextDist: number, addSteps: number) => {
    const clamped = Math.max(0, Math.min(35, nextDist));
    const pos = distanceToMapPosition(clamped);
    const zone = detectZone(pos);
    onBroadcastPatch((prev) => {
      let activeAlert = prev.activeAlert;
      if (zone.type === 'exit') {
        activeAlert = {
          id: `al-${Date.now()}`,
          type: 'gate',
          title: `تحذير: الطفل يقترب من ${zone.nameAr}`,
          zoneName: zone.nameAr,
          distanceM: clamped,
          ts: Date.now(),
          acknowledged: false,
          securityNotified: false,
        };
      } else if (clamped > prev.safeLimitM) {
        activeAlert = {
          id: `al-${Date.now()}`,
          type: 'distance',
          title: `تنبيه: ابتعد السوار مسافة ${clamped} متر`,
          zoneName: zone.nameAr,
          distanceM: clamped,
          ts: Date.now(),
          acknowledged: false,
          securityNotified: false,
        };
      } else {
        activeAlert = null;
      }

      return {
        ...prev,
        distanceMeters: clamped,
        steps: prev.steps + addSteps,
        mapPos: pos,
        currentZone: zone.id,
        pathHistory: [...prev.pathHistory.slice(-24), pos],
        activeAlert,
      };
    });
  };

  const triggerGateAlert = () => {
    const gate2 = MALL_ZONES.find((z) => z.id === 'exit_2')!;
    onBroadcastPatch((prev) => ({
      ...prev,
      currentZone: gate2.id,
      mapPos: gate2.center,
      distanceMeters: 28,
      steps: prev.steps + 14,
      pathHistory: [...prev.pathHistory.slice(-24), gate2.center],
      activeAlert: {
        id: `al-${Date.now()}`,
        type: 'gate',
        title: `تحذير: الطفل يقترب من ${gate2.nameAr}`,
        zoneName: gate2.nameAr,
        distanceM: 28,
        ts: Date.now(),
        acknowledged: false,
        securityNotified: false,
      },
    }));
  };

  const triggerTamperAlert = () => {
    onBroadcastPatch((prev) => {
      const zone = detectZone(prev.mapPos);
      const { meters } = computeEffectiveDistance(prev);
      return {
        ...prev,
        activeAlert: {
          id: `al-${Date.now()}`,
          type: 'tamper',
          title: 'تحذير: محاولة فك السوار بدون إذن',
          zoneName: zone.nameAr,
          distanceM: meters,
          ts: Date.now(),
          acknowledged: false,
          securityNotified: false,
        },
      };
    });
  };

  const handleReturnSafe = () => {
    const safePos = { x: 428, y: 235 };
    onBroadcastPatch((prev) => ({
      ...prev,
      currentZone: 'atrium',
      mapPos: safePos,
      distanceMeters: 3,
      pathHistory: [prev.parentMapPos, safePos],
      activeAlert: null,
    }));
  };

  const { meters, source } = computeEffectiveDistance(band);

  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-xl ${
        compact ? 'p-4' : 'p-5'
      } space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3 text-xs font-bold text-[#0F172A] tabular-nums">
          <span>المسافة: {meters} م</span>
          <span className="text-[#CBD5E1]">|</span>
          <span>الخطوات: {band.steps}</span>
          <span className="text-[#CBD5E1]">|</span>
          <span className="text-[#0D9488]">
            {source === 'gps' ? 'GPS فعلي' : 'نطاق داخلي'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGpsEnabled((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border inline-flex items-center gap-1.5 cursor-pointer ${
              gpsEnabled
                ? 'bg-[#0D9488] text-white border-[#0D9488]'
                : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{gpsEnabled ? 'GPS نشط' : 'تفعيل GPS'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMotion}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border inline-flex items-center gap-1.5 cursor-pointer ${
              motionEnabled
                ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{motionEnabled ? 'حساس الخطوات نشط' : 'حساس الخطوات'}</span>
          </button>
        </div>
      </div>

      {gpsError && (
        <p className="text-xs font-semibold text-[#D97706]">{gpsError}</p>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[#0F172A]">تحريك السوار (مسافة عن ولي الأمر)</span>
          <span className="text-[#1E3A8A] tabular-nums">
            {band.distanceMeters} متر / الحد {band.safeLimitM} متر
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={35}
          step={1}
          value={band.distanceMeters}
          onChange={(e) => applyIndoorDistance(Number(e.target.value), 3)}
          className="w-full accent-[#1E3A8A] cursor-pointer"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => applyIndoorDistance(band.distanceMeters + 4, 6)}
            className="py-2.5 px-3 bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Footprints className="w-4 h-4" strokeWidth={1.75} />
            <span>تحرك خطوات (+4م)</span>
          </button>

          <button
            type="button"
            onClick={handleReturnSafe}
            className="py-2.5 px-3 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
            <span>عودة للأهل (آمن)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={triggerGateAlert}
          className="py-3 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs sm:text-sm font-bold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>اقتراب من بوابة الخروج</span>
        </button>

        <button
          type="button"
          onClick={triggerTamperAlert}
          className="py-3 px-4 bg-white hover:bg-[#DC2626] text-[#DC2626] hover:text-white border-2 border-[#DC2626] text-xs sm:text-sm font-bold rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>محاولة فك السوار بدون إذن</span>
        </button>
      </div>
    </div>
  );
}
