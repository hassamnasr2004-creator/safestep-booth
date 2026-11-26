import { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Footprints,
  KeyRound,
  LocateFixed,
  MapPin,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LatLngTuple, LiveBandState, SyncStatus } from '../types/safestep';
import { deriveZoneLabel, getEditionById } from '../data/safestepData';
import {
  startRepeatableAlarm,
  stopRepeatableAlarm,
  unlockPhoneAlerts,
} from '../utils/audioAlerts';
import { GlassIcon } from './GlassIcon';
import { LiveLeafletMap } from './LiveLeafletMap';
import { AdminExitCorner } from './AdminExitCorner';

interface ParentTabProps {
  band: LiveBandState | null;
  lockedBandId: string;
  returnedBandInfo: { bandId: string; childName: string } | null;
  syncStatus: SyncStatus;
  onUpdateParentGps: (bandId: string, coords: LatLngTuple) => void;
  onAcknowledgeAlert: (bandId: string, alertId: number) => void;
  onNotifySecurity: (bandId: string, alertId: number) => void;
  onAdminExit: () => void;
}

export function ParentTab({
  band,
  lockedBandId,
  returnedBandInfo,
  syncStatus,
  onUpdateParentGps,
  onAcknowledgeAlert,
  onNotifySecurity,
  onAdminExit,
}: ParentTabProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastFiredAlertIdRef = useRef<number | null>(null);
  const localAckedIdsRef = useRef<Set<number>>(new Set());

  // Parent real GPS watchPosition
  useEffect(() => {
    if (!gpsActive || !band || band.isReturned) {
      if (watchRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        onUpdateParentGps(band.bandId, [
          Number(pos.coords.latitude.toFixed(7)),
          Number(pos.coords.longitude.toFixed(7)),
        ]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [gpsActive, band?.bandId, band?.isReturned, onUpdateParentGps]);

  // Repeatable Alert State Machine: triggers cleanly for EVERY new unique alertId
  const activeAlert =
    band &&
    !band.isReturned &&
    band.activeAlert &&
    !band.activeAlert.acknowledged &&
    !localAckedIdsRef.current.has(band.activeAlert.alertId)
      ? band.activeAlert
      : null;

  useEffect(() => {
    if (activeAlert) {
      if (lastFiredAlertIdRef.current !== activeAlert.alertId) {
        lastFiredAlertIdRef.current = activeAlert.alertId;
        const severity =
          activeAlert.type === 'DISTANCE_BREACH' ? 'warning' : 'critical';
        startRepeatableAlarm(
          severity,
          activeAlert.title,
          `${activeAlert.locationLabel} • ${activeAlert.distanceM.toFixed(1)} متر`,
          `safestep-${activeAlert.alertId}`
        );
      }
    } else {
      lastFiredAlertIdRef.current = null;
      stopRepeatableAlarm();
    }

    return () => {
      stopRepeatableAlarm();
    };
  }, [activeAlert]);

  const handleEnablePhoneAlerts = async () => {
    await unlockPhoneAlerts();
    setAlertsEnabled(true);
    setGpsActive(true);
  };

  const handleStopAlarm = () => {
    stopRepeatableAlarm();
    if (band && activeAlert) {
      localAckedIdsRef.current.add(activeAlert.alertId);
      lastFiredAlertIdRef.current = null;
      onAcknowledgeAlert(band.bandId, activeAlert.alertId);
    }
  };

  const handleReportSecurity = () => {
    if (band && activeAlert) {
      onNotifySecurity(band.bandId, activeAlert.alertId);
    }
  };

  const syncLabel =
    syncStatus === 'connected'
      ? 'بث مباشر'
      : syncStatus === 'failover'
      ? 'خادم احتياطي'
      : 'مزامنة';

  // Official Return Confirmation Screen
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

  // Waiting for retained cloud state on fresh phone scan
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
            جارٍ الاتصال بالسوار {lockedBandId}
          </h1>
          <p className="text-xs font-medium text-[#475569]">{syncLabel}</p>
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
  const dist = zoneInfo.distParent;

  const isCritical =
    band.activeAlert?.type === 'TAMPER_ATTEMPT' ||
    band.activeAlert?.type === 'GATE_PROXIMITY' ||
    zoneInfo.nearGate ||
    dist > band.safeLimitM;
  const isWarn = !isCritical && dist > band.safeLimitM * 0.7;

  const statusLabel =
    band.activeAlert?.type === 'TAMPER_ATTEMPT'
      ? 'محاولة فك'
      : zoneInfo.nearGate || band.activeAlert?.type === 'GATE_PROXIMITY'
      ? 'خطر بوابة'
      : dist > band.safeLimitM
      ? 'خارج النطاق'
      : isWarn
      ? 'قرب الحد'
      : 'آمن';

  const statusTone = isCritical ? 'alert' : isWarn ? 'warn' : 'safe';

  return (
    <div className="min-h-screen pb-14">
      {/* FULL-SCREEN REPEATABLE FROSTED RED ALERT OVERLAY */}
      {activeAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#DC2626]/95 backdrop-blur-xl text-white flex flex-col items-center justify-between p-6 text-center alert-flash-bg"
        >
          <div className="w-full max-w-md flex items-center justify-between text-xs font-bold opacity-90 pt-2">
            <span className="tabular-nums">{band.bandId}</span>
            <span>{band.childName}</span>
          </div>

          <div className="max-w-md space-y-5 my-auto">
            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md border border-white/40 mx-auto flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-11 h-11 text-white" strokeWidth={2} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-snug">
              {activeAlert.title}
            </h1>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-black/20 backdrop-blur-md border border-white/15 rounded-2xl p-4">
                <p className="text-xs opacity-85">الموقع الحالي</p>
                <p className="text-lg font-bold mt-1">
                  {activeAlert.locationLabel}
                </p>
              </div>
              <div className="bg-black/20 backdrop-blur-md border border-white/15 rounded-2xl p-4">
                <p className="text-xs opacity-85">المسافة</p>
                <p className="text-lg font-bold mt-1 tabular-nums">
                  {activeAlert.distanceM.toFixed(1)} متر
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md space-y-3 pb-4">
            {activeAlert.securityNotified ? (
              <div className="w-full py-3.5 px-4 bg-white/15 border border-white/40 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2">
                <Check className="w-5 h-5" strokeWidth={2.25} />
                <span>تم إبلاغ الأمن فوراً</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReportSecurity}
                className="w-full py-4 px-5 bg-[#0F172A] hover:bg-black text-white text-base font-bold rounded-2xl transition-all duration-200 cursor-pointer"
              >
                إبلاغ الأمن فوراً
              </button>
            )}

            <button
              type="button"
              onClick={handleStopAlarm}
              className="w-full py-4 px-5 bg-white hover:bg-slate-50 text-[#DC2626] text-base font-bold rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <VolumeX className="w-5 h-5" strokeWidth={2} />
              <span>تم الانتباه وإيقاف الإنذار</span>
            </button>
          </div>
        </div>
      )}

      {/* LOCKED PARENT SCREEN CONTENT (Zero Booth Navigation / Zero Simulator Controls) */}
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3.5">
        {/* Compact Frosted Header */}
        <header className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={edition.imageUrl}
              alt={edition.shortName}
              className="w-11 h-11 rounded-xl object-cover border border-white shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0F172A] truncate">
                {band.childName}
              </h1>
              <p className="text-[11px] font-semibold text-[#475569] tabular-nums">
                {band.bandId} · {edition.shortName}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold ${
                isCritical
                  ? 'bg-[#EF4444]/15 text-[#DC2626]'
                  : isWarn
                  ? 'bg-[#F59E0B]/15 text-[#D97706]'
                  : 'bg-[#10B981]/15 text-[#059669]'
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-[10px] font-semibold text-[#059669] inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" strokeWidth={2} />
              <span>{syncLabel}</span>
            </span>
          </div>
        </header>

        {/* Auto-Saved Indicator */}
        <div className="px-1 flex items-center justify-between text-[11px] font-semibold text-[#059669]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
            <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
          </span>
          <span className="text-[#475569] tabular-nums">
            النطاق {band.safeLimitM} متر
          </span>
        </div>

        {/* One-Tap Sound + Notification + Vibration + GPS Unlock */}
        {!alertsEnabled ? (
          <button
            type="button"
            onClick={handleEnablePhoneAlerts}
            className="w-full py-3.5 px-5 bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-bold rounded-2xl inline-flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 transition-all duration-300 cursor-pointer"
          >
            <BellRing className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>تفعيل تنبيهات الهاتف والصوت</span>
          </button>
        ) : (
          <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs font-bold">
            <span className="text-[#059669] inline-flex items-center gap-2">
              <GlassIcon tone="safe" size="sm" className="!w-7 !h-7">
                <Volume2 className="w-3.5 h-3.5" strokeWidth={2} />
              </GlassIcon>
              <span>الإنذار الصوتي والاهتزاز نشط</span>
            </span>
            <button
              type="button"
              onClick={() => setGpsActive((v) => !v)}
              className="inline-flex items-center gap-1 text-[#0284C7] cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{gpsActive ? 'GPS مفعّل' : 'تشغيل GPS'}</span>
            </button>
          </div>
        )}

        {/* LIVE INTERACTIVE LEAFLET MAP + TETHER + BREADCRUMB PATH */}
        <LiveLeafletMap band={band} heightClass="h-[360px] sm:h-[420px]" />

        {/* 4 FROSTED GLASS METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
            <GlassIcon tone={statusTone} size="md">
              <MapPin className="w-5 h-5" strokeWidth={1.9} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569]">المسافة</p>
              <p className="text-base font-bold text-[#0F172A] tabular-nums">
                {dist.toFixed(1)} م
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
            <GlassIcon tone="track" size="md">
              <Footprints className="w-5 h-5" strokeWidth={1.9} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569]">الخطوات</p>
              <p className="text-base font-bold text-[#0F172A] tabular-nums">
                {band.steps}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
            <GlassIcon tone={statusTone} size="md">
              <Radio className="w-5 h-5" strokeWidth={1.9} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569]">المنطقة</p>
              <p className="text-xs font-bold text-[#0F172A] truncate mt-0.5">
                {zoneInfo.label}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
            <GlassIcon tone="neutral" size="md">
              <KeyRound className="w-5 h-5" strokeWidth={1.9} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569]">رمز التسليم</p>
              <p className="text-base font-bold text-[#0F172A] tabular-nums">
                {band.pinCode}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom-Corner Admin Exit Lock (PIN: 1234) */}
      <AdminExitCorner onAuthorizedExit={onAdminExit} />
    </div>
  );
}
