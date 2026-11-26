import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Compass,
  Footprints,
  LocateFixed,
  Lock,
  Navigation,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { LatLngTuple, LiveBandState, SyncStatus } from '../types/safestep';
import {
  deriveZoneLabel,
  getEditionById,
  offsetLatLng,
  stepAlongHeading,
} from '../data/safestepData';
import { playShortChime } from '../utils/audioAlerts';
import { GlassIcon } from './GlassIcon';
import { AdminExitCorner } from './AdminExitCorner';

interface BandWearableViewProps {
  band: LiveBandState | null;
  lockedBandId: string;
  returnedBandInfo: { bandId: string; childName: string } | null;
  syncStatus: SyncStatus;
  onMoveChild: (
    bandId: string,
    nextCoords: LatLngTuple,
    opts: { addSteps: number; headingDeg?: number; source: 'gps' | 'fusion' }
  ) => void;
  onTriggerGate: (bandId: string) => void;
  onTriggerTamper: (bandId: string) => void;
  onDemoReset: (bandId: string) => void;
  onAdminExit: () => void;
}

export function BandWearableView({
  band,
  lockedBandId,
  returnedBandInfo,
  syncStatus,
  onMoveChild,
  onTriggerGate,
  onTriggerTamper,
  onDemoReset,
  onAdminExit,
}: BandWearableViewProps) {
  const [sensorsActive, setSensorsActive] = useState(false);
  const [heading, setHeading] = useState<number>(band?.headingDeg ?? 45);
  const [gpsLocked, setGpsLocked] = useState(false);

  const headingRef = useRef(heading);
  const bandRef = useRef(band);
  const lastStepTsRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    bandRef.current = band;
  }, [band]);

  // Sensor Fusion: GPS + Compass (DeviceOrientation) + Pedometer (DeviceMotion)
  useEffect(() => {
    if (!sensorsActive || !band || band.isReturned) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // 1. Real GPS stream
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsLocked(true);
          const cur = bandRef.current;
          if (!cur) return;
          // Only apply GPS jumps when accuracy is reasonably tight (< 18m)
          if (pos.coords.accuracy <= 18) {
            onMoveChild(
              cur.bandId,
              [
                Number(pos.coords.latitude.toFixed(7)),
                Number(pos.coords.longitude.toFixed(7)),
              ],
              { addSteps: 0, headingDeg: headingRef.current, source: 'gps' }
            );
          }
        },
        () => setGpsLocked(false),
        { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
      );
    }

    // 2. Real Compass Heading
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const webkitHeading = (ev as unknown as { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        setHeading(Math.round(webkitHeading));
      } else if (typeof ev.alpha === 'number') {
        setHeading(Math.round((360 - ev.alpha) % 360));
      }
    };

    // 3. Real Accelerometer Step Dead-Reckoning (+0.75m along compass heading)
    const handleMotion = (ev: DeviceMotionEvent) => {
      const acc = ev.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
      const now = Date.now();
      if (mag > 12.4 && now - lastStepTsRef.current > 420) {
        lastStepTsRef.current = now;
        const cur = bandRef.current;
        if (!cur) return;
        const nextCoords = stepAlongHeading(
          cur.childCoords,
          headingRef.current,
          0.75
        );
        onMoveChild(cur.bandId, nextCoords, {
          addSteps: 1,
          headingDeg: headingRef.current,
          source: 'fusion',
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [sensorsActive, band?.bandId, band?.isReturned, onMoveChild]);

  const handleToggleSensors = async () => {
    if (sensorsActive) {
      setSensorsActive(false);
      return;
    }
    const Dm = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const Do = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    try {
      if (typeof Dm?.requestPermission === 'function') {
        await Dm.requestPermission();
      }
      if (typeof Do?.requestPermission === 'function') {
        await Do.requestPermission();
      }
    } catch {
      // Proceed cleanly with available sensors
    }
    setSensorsActive(true);
  };

  // Official Return Confirmation
  if (returnedBandInfo && (!band || returnedBandInfo.bandId === lockedBandId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex justify-center">
            <GlassIcon tone="safe" size="lg">
              <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A] leading-snug">
            تم فك القفل وتسليم السوار بنجاح — انتهت الجلسة
          </h1>
          <p className="text-sm font-semibold text-[#475569] tabular-nums">
            {returnedBandInfo.childName} · {returnedBandInfo.bandId}
          </p>
        </div>
        <AdminExitCorner onAuthorizedExit={onAdminExit} />
      </div>
    );
  }

  if (!band) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-3">
          <div className="flex justify-center">
            <GlassIcon tone="track" size="lg">
              <Radio className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-base font-bold text-[#0F172A] tabular-nums">
            جارٍ ربط السوار {lockedBandId}
          </h1>
        </div>
        <AdminExitCorner onAuthorizedExit={onAdminExit} />
      </div>
    );
  }

  const edition = getEditionById(band.editionId);
  const zoneInfo = deriveZoneLabel(
    band.childCoords,
    band.parentCoords,
    band.gateCoords,
    band.safeLimitM
  );

  const stepForwardCompass = () => {
    void playShortChime('step');
    const nextCoords = stepAlongHeading(band.childCoords, heading, 0.75);
    onMoveChild(band.bandId, nextCoords, {
      addSteps: 1,
      headingDeg: heading,
      source: 'fusion',
    });
  };

  const stepDirection = (northM: number, eastM: number, dirDeg: number) => {
    void playShortChime('step');
    setHeading(dirDeg);
    const nextCoords = offsetLatLng(band.childCoords, northM, eastM);
    onMoveChild(band.bandId, nextCoords, {
      addSteps: 3,
      headingDeg: dirDeg,
      source: 'fusion',
    });
  };

  return (
    <div className="min-h-screen pb-14">
      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">
        {/* Wearable Hardware Identity Header */}
        <header className="glass-panel rounded-3xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={edition.imageUrl}
              alt={edition.shortName}
              className="w-12 h-12 rounded-2xl object-cover border border-white shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#0284C7]">
                سوار الطفل الحي
              </p>
              <h1 className="text-base font-bold text-[#0F172A] truncate">
                {band.childName} ·{' '}
                <span className="tabular-nums">{band.bandId}</span>
              </h1>
            </div>
          </div>

          <GlassIcon tone="safe" size="md">
            <Lock className="w-5 h-5" strokeWidth={2} />
          </GlassIcon>
        </header>

        {/* Live Telemetry Strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="glass-card rounded-2xl p-3 text-center">
            <p className="text-[11px] text-[#475569]">المسافة</p>
            <p className="text-lg font-bold text-[#0F172A] tabular-nums mt-0.5">
              {zoneInfo.distParent.toFixed(1)} م
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3 text-center">
            <p className="text-[11px] text-[#475569]">الخطوات</p>
            <p className="text-lg font-bold text-[#0F172A] tabular-nums mt-0.5">
              {band.steps}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3 text-center">
            <p className="text-[11px] text-[#475569]">البوصلة</p>
            <p className="text-lg font-bold text-[#0284C7] tabular-nums mt-0.5">
              {heading}°
            </p>
          </div>
        </div>

        {/* Sensor Fusion Toggle (GPS + Pedometer + Compass) */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone={sensorsActive ? 'safe' : 'track'} size="sm">
                <LocateFixed className="w-4 h-4" strokeWidth={2} />
              </GlassIcon>
              <span className="text-xs font-bold text-[#0F172A]">
                حساسات الحركة والبوصلة
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleSensors}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                sensorsActive
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#0F172A] text-white hover:bg-slate-800'
              }`}
            >
              {sensorsActive ? 'الحساسات نشطة' : 'تفعيل الحساسات'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-[#475569]">
            <span className="inline-flex items-center gap-1 text-[#059669]">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
              <span>
                {syncStatus === 'connected' ? 'بث مباشر نشط' : 'مزامنة نشطة'}
              </span>
            </span>
            <span>{gpsLocked ? 'GPS فعلي متصل' : 'دمج خطوات وبوصلة'}</span>
          </div>
        </div>

        {/* Step Along Compass + Indoor Directional Pad */}
        <div className="glass-card rounded-3xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0F172A] inline-flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#0284C7]" strokeWidth={2} />
              <span>اتجاه الحركة</span>
            </span>
            <span className="text-xs font-bold text-[#0284C7] tabular-nums">
              {heading}°
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={359}
            value={heading}
            onChange={(e) => setHeading(Number(e.target.value))}
            aria-label="زاوية البوصلة"
            className="w-full accent-[#0284C7] cursor-pointer"
          />

          <button
            type="button"
            onClick={stepForwardCompass}
            className="w-full py-3.5 px-4 bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-bold rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            <Footprints className="w-4 h-4" strokeWidth={2} />
            <span>خطوة للأمام في اتجاه البوصلة</span>
          </button>

          {/* 4-Direction Smooth Indoor Walk Pad */}
          <div className="grid grid-cols-3 gap-2 pt-1 max-w-[230px] mx-auto">
            <div />
            <button
              type="button"
              onClick={() => stepDirection(2.5, 0, 0)}
              className="h-11 rounded-xl bg-white/80 hover:bg-white border border-white shadow-sm flex items-center justify-center text-[#0F172A] cursor-pointer"
              aria-label="شمال"
            >
              <ArrowUp className="w-5 h-5" strokeWidth={2} />
            </button>
            <div />
            <button
              type="button"
              onClick={() => stepDirection(0, 2.5, 90)}
              className="h-11 rounded-xl bg-white/80 hover:bg-white border border-white shadow-sm flex items-center justify-center text-[#0F172A] cursor-pointer"
              aria-label="شرق"
            >
              <ArrowRight className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => stepDirection(2.2, 2.2, 45)}
              className="h-11 rounded-xl bg-[#0EA5E9]/15 hover:bg-[#0EA5E9]/25 text-[#0284C7] flex items-center justify-center cursor-pointer"
              aria-label="نحو البوابة"
            >
              <Navigation className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => stepDirection(0, -2.5, 270)}
              className="h-11 rounded-xl bg-white/80 hover:bg-white border border-white shadow-sm flex items-center justify-center text-[#0F172A] cursor-pointer"
              aria-label="غرب"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={2} />
            </button>
            <div />
            <button
              type="button"
              onClick={() => stepDirection(-2.5, 0, 180)}
              className="h-11 rounded-xl bg-white/80 hover:bg-white border border-white shadow-sm flex items-center justify-center text-[#0F172A] cursor-pointer"
              aria-label="جنوب"
            >
              <ArrowDown className="w-5 h-5" strokeWidth={2} />
            </button>
            <div />
          </div>
        </div>

        {/* Hardware Alert Triggers + 1-Tap Jury Demo Reset */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onTriggerGate(band.bandId)}
            className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-bold rounded-2xl inline-flex items-center justify-center gap-2 shadow-md shadow-red-600/15 transition-all duration-200 cursor-pointer"
          >
            <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>اقتراب من بوابة الخروج</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerTamper(band.bandId)}
            className="w-full py-3.5 px-4 bg-white/80 hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#EF4444]/40 text-sm font-bold rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>محاولة فك السوار بدون إذن</span>
          </button>

          <button
            type="button"
            onClick={() => onDemoReset(band.bandId)}
            className="w-full py-3 px-4 glass-card hover:bg-white text-[#0F172A] text-xs font-bold rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#0284C7]" strokeWidth={2} />
            <span>إعادة ضبط المسار لتجربة جديدة</span>
          </button>
        </div>
      </div>

      {/* Subtle Bottom-Corner Admin Exit Lock (PIN: 1234) */}
      <AdminExitCorner onAuthorizedExit={onAdminExit} />
    </div>
  );
}
