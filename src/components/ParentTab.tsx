import { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Footprints,
  LocateFixed,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GpsPoint, LiveBandState, SyncStatus } from '../types/safestep';
import {
  computeEffectiveDistance,
  detectZone,
  getEditionById,
} from '../data/safestepData';
import {
  startContinuousAlarm,
  stopContinuousAlarm,
  unlockPhoneAlerts,
} from '../utils/audioAlerts';
import { MallMapSvg } from './MallMapSvg';

interface ParentTabProps {
  activeBands: LiveBandState[];
  lockedBandId: string | null;
  selectedBandId: string;
  returnedBandInfo: { bandId: string; childName: string } | null;
  syncStatus: SyncStatus;
  onSelectBand: (bandId: string) => void;
  onUpdateParentGps: (bandId: string, gps: GpsPoint) => void;
  onAcknowledgeAlert: (bandId: string) => void;
  onNotifySecurity: (bandId: string) => void;
  onExitFullscreen?: () => void;
}

export function ParentTab({
  activeBands,
  lockedBandId,
  selectedBandId,
  returnedBandInfo,
  syncStatus,
  onSelectBand,
  onUpdateParentGps,
  onAcknowledgeAlert,
  onNotifySecurity,
  onExitFullscreen,
}: ParentTabProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastAlarmIdRef = useRef<string | null>(null);

  const targetId = lockedBandId ?? selectedBandId;
  const band =
    activeBands.find((b) => b.bandId === targetId) ??
    (!lockedBandId ? activeBands[0] ?? null : null);

  // Parent GPS watchPosition once alerts/GPS enabled
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
        onUpdateParentGps(band.bandId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          ts: Date.now(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2500, timeout: 10000 }
    );

    return () => {
      if (watchRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [gpsActive, band?.bandId, band?.isReturned, onUpdateParentGps]);

  const activeAlert =
    band && !band.isReturned && band.activeAlert && !band.activeAlert.acknowledged
      ? band.activeAlert
      : null;

  useEffect(() => {
    if (activeAlert) {
      if (lastAlarmIdRef.current !== activeAlert.id) {
        lastAlarmIdRef.current = activeAlert.id;
        const severity =
          activeAlert.type === 'distance' ? 'warning' : 'critical';
        startContinuousAlarm(
          severity,
          activeAlert.title,
          `${activeAlert.zoneName} · المسافة ${activeAlert.distanceM} متر`
        );
      }
    } else {
      lastAlarmIdRef.current = null;
      stopContinuousAlarm();
    }

    return () => {
      stopContinuousAlarm();
    };
  }, [activeAlert]);

  const handleEnablePhoneAlerts = async () => {
    await unlockPhoneAlerts();
    setAlertsEnabled(true);
    setGpsActive(true);
  };

  const handleStopAlarm = () => {
    stopContinuousAlarm();
    if (band) onAcknowledgeAlert(band.bandId);
  };

  const handleReportSecurity = () => {
    if (band) onNotifySecurity(band.bandId);
  };

  // Official Return Confirmation Screen
  if (returnedBandInfo && (!band || returnedBandInfo.bandId === targetId)) {
    return (
      <div className="no-print max-w-md mx-auto px-4 py-12 text-center">
        <div className="bg-white border-2 border-[#0D9488] rounded-2xl p-8 space-y-3">
          <CheckCircle2
            className="w-12 h-12 text-[#0D9488] mx-auto"
            strokeWidth={1.75}
          />
          <h1 className="text-lg font-bold text-[#0F172A] leading-snug">
            تم فك القفل وتسليم السوار بنجاح — انتهت الجلسة
          </h1>
          <p className="text-sm font-semibold text-[#475569] tabular-nums">
            {returnedBandInfo.childName} · {returnedBandInfo.bandId}
          </p>
          {onExitFullscreen && (
            <button
              type="button"
              onClick={onExitFullscreen}
              className="mt-4 px-5 py-2.5 bg-[#0F172A] text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              فتح شاشة البوث
            </button>
          )}
        </div>
      </div>
    );
  }

  // Waiting for retained MQTT state when scanned on a brand-new phone
  if (!band) {
    return (
      <div className="no-print max-w-md mx-auto px-4 py-14 text-center space-y-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 space-y-3">
          <p className="text-lg font-bold text-[#0F172A] tabular-nums">
            {lockedBandId
              ? `جارٍ استعادة بيانات السوار ${lockedBandId}`
              : 'لا يوجد سوار نشط'}
          </p>
          <p className="text-xs font-medium text-[#475569]">
            {syncStatus === 'connected'
              ? 'متصل بالبث المباشر — بانتظار إشارة السوار'
              : 'جارٍ تفعيل المزامنة المباشرة'}
          </p>
          {onExitFullscreen && (
            <button
              type="button"
              onClick={onExitFullscreen}
              className="mt-3 px-4 py-2 text-xs font-bold border border-[#CBD5E1] rounded-lg text-[#0F172A] cursor-pointer"
            >
              فتح شاشة البوث
            </button>
          )}
        </div>
      </div>
    );
  }

  const edition = getEditionById(band.editionId);
  const zone = detectZone(band.mapPos);
  const { meters, source } = computeEffectiveDistance(band);

  const isRed =
    band.activeAlert?.type === 'gate' ||
    band.activeAlert?.type === 'tamper' ||
    zone.type === 'exit';
  const isAmber = !isRed && meters > band.safeLimitM;

  const statusText =
    band.activeAlert?.type === 'tamper'
      ? 'محاولة فك'
      : isRed
      ? 'خطر بوابة'
      : isAmber
      ? 'ابتعاد عن النطاق'
      : 'آمن';

  const statusBg = isRed
    ? 'bg-[#DC2626] text-white'
    : isAmber
    ? 'bg-[#D97706] text-white'
    : 'bg-[#0D9488] text-white';

  return (
    <div className="no-print max-w-2xl mx-auto px-4 py-5 space-y-4">
      {/* FULL-SCREEN HIGH-CONTRAST RED EMERGENCY OVERLAY */}
      {activeAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#DC2626] text-white flex flex-col items-center justify-between p-6 text-center"
        >
          <div className="w-full max-w-md flex items-center justify-between text-xs font-bold opacity-90 pt-2">
            <span className="tabular-nums">{band.bandId}</span>
            <span>{band.childName}</span>
          </div>

          <div className="max-w-md space-y-5 my-auto">
            <div className="w-20 h-20 rounded-full bg-white/15 border-2 border-white mx-auto flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-11 h-11 text-white" strokeWidth={2} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-snug">
              {activeAlert.title}
            </h1>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-black/20 rounded-xl p-4">
                <p className="text-xs opacity-85">الموقع الحالي</p>
                <p className="text-xl font-bold mt-1">{activeAlert.zoneName}</p>
              </div>
              <div className="bg-black/20 rounded-xl p-4">
                <p className="text-xs opacity-85">المسافة</p>
                <p className="text-xl font-bold mt-1 tabular-nums">
                  {activeAlert.distanceM} متر
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md space-y-3 pb-4">
            {activeAlert.securityNotified ? (
              <div className="w-full py-3.5 px-4 bg-white/15 border border-white/40 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2">
                <Check className="w-5 h-5" strokeWidth={2.25} />
                <span>تم إبلاغ الأمن فوراً</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReportSecurity}
                className="w-full py-4 px-5 bg-[#0F172A] hover:bg-black text-white text-base font-bold rounded-xl cursor-pointer"
              >
                إبلاغ الأمن فوراً
              </button>
            )}

            <button
              type="button"
              onClick={handleStopAlarm}
              className="w-full py-4 px-5 bg-white hover:bg-[#F8FAFC] text-[#DC2626] text-base font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <VolumeX className="w-5 h-5" strokeWidth={2} />
              <span>تم الانتباه / إيقاف الصوت</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Parent Header with Auto-Persistence Indicator */}
      {lockedBandId && (
        <div className="space-y-1.5 pb-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#0F172A]">SafeStep</span>
              <span className="text-xs font-semibold text-[#475569] tabular-nums">
                {band.bandId}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === 'connected' ? 'bg-[#0D9488]' : 'bg-[#D97706]'
                  }`}
                />
                <span>{syncStatus === 'connected' ? 'مباشر' : 'محلي'}</span>
              </span>
              {onExitFullscreen && (
                <button
                  type="button"
                  onClick={onExitFullscreen}
                  className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  البوث
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0D9488]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
          </div>
        </div>
      )}

      {/* Multi-Band Switcher (when NOT locked in parent role) */}
      {!lockedBandId && activeBands.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeBands.map((b) => (
            <button
              key={b.bandId}
              type="button"
              onClick={() => onSelectBand(b.bandId)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border cursor-pointer ${
                b.bandId === band.bandId
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1]'
              }`}
            >
              {b.childName} · <span className="tabular-nums">{b.bandId}</span>
            </button>
          ))}
        </div>
      )}

      {/* ONE-TAP PHONE ALARM + PUSH + VIBRATION + GPS ACTIVATION */}
      {!alertsEnabled ? (
        <button
          type="button"
          onClick={handleEnablePhoneAlerts}
          className="w-full py-4 px-5 bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-sm sm:text-base font-bold rounded-xl inline-flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
        >
          <BellRing className="w-5 h-5 shrink-0" strokeWidth={2} />
          <span>تفعيل تنبيهات الهاتف والصوت</span>
        </button>
      ) : (
        <div className="bg-white border border-[#0D9488]/35 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-bold">
          <span className="text-[#0D9488] inline-flex items-center gap-1.5">
            <Volume2 className="w-4 h-4" strokeWidth={2} />
            <span>الصوت والاهتزاز والإشعارات مفعّلة</span>
          </span>
          <button
            type="button"
            onClick={() => setGpsActive((v) => !v)}
            className={`inline-flex items-center gap-1 cursor-pointer ${
              gpsActive ? 'text-[#0D9488]' : 'text-[#475569]'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{gpsActive ? 'GPS الهاتف نشط' : 'تفعيل GPS'}</span>
          </button>
        </div>
      )}

      {/* PRIMARY CHILD STATUS HEADER */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">{band.childName}</h1>
          <p className="text-xs font-semibold text-[#475569] tabular-nums mt-0.5">
            {band.bandId} · {edition.shortName}
          </p>
        </div>
        <span className={`px-4 py-2 rounded-lg text-sm font-bold ${statusBg}`}>
          {statusText}
        </span>
      </div>

      {/* 4 COMPACT VISUAL METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5">
          <p className="text-xs text-[#475569]">المسافة</p>
          <p className="text-xl font-bold text-[#0F172A] mt-1 tabular-nums">
            {meters} م
          </p>
          <p className="text-[11px] font-semibold text-[#0D9488] mt-0.5">
            {source === 'gps' ? 'GPS فعلي' : 'نطاق داخلي'}
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5">
          <p className="text-xs text-[#475569]">الموقع</p>
          <p className="text-lg font-bold text-[#0F172A] mt-1 inline-flex items-center gap-1">
            <MapPin className="w-4 h-4 text-[#1E3A8A] shrink-0" strokeWidth={2} />
            <span>{zone.nameAr}</span>
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5">
          <p className="text-xs text-[#475569]">الخطوات</p>
          <p className="text-xl font-bold text-[#0F172A] mt-1 tabular-nums inline-flex items-center gap-1.5">
            <Footprints className="w-4 h-4 text-[#475569]" strokeWidth={1.75} />
            <span>{band.steps}</span>
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5">
          <p className="text-xs text-[#475569]">رمز فك القفل</p>
          <p className="text-xl font-bold text-[#1E3A8A] mt-1 tabular-nums inline-flex items-center gap-1.5">
            <Lock className="w-4 h-4" strokeWidth={2} />
            <span>{band.pinCode}</span>
          </p>
        </div>
      </div>

      {/* CLEAN VISUAL MALL MAP WITH PERSISTED TRAIL */}
      <MallMapSvg band={band} />
    </div>
  );
}
