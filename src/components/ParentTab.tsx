import { useEffect, useRef, useState } from 'react';
import {
  BatteryCharging,
  BellRing,
  Check,
  CheckCircle2,
  Footprints,
  KeyRound,
  LayoutDashboard,
  Lock,
  MapPin,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  LiveBandState,
  MallPoint,
  ReturnedBandRecord,
  SyncStatus,
} from '../types/safestep';
import {
  evaluateMallPosition,
  formatArabicTime,
  getEditionById,
} from '../data/safestepData';
import {
  playShortChime,
  startRepeatableAlarm,
  stopRepeatableAlarm,
  unlockPhoneAlerts,
} from '../utils/audioAlerts';
import { GlassIcon } from './GlassIcon';
import { SmartMallMap } from './SmartMallMap';

interface ParentTabProps {
  band: LiveBandState | null;
  lockedBandId: string;
  returnedBandInfo: ReturnedBandRecord | null;
  syncStatus: SyncStatus;
  isQrScanMode?: boolean;
  onDragParent?: (bandId: string, pos: MallPoint) => void;
  onAcknowledgeAlert: (bandId: string, alertId: number) => void;
  onSecureClasp: (bandId: string) => void;
  onNotifySecurity: (bandId: string, alertId: number) => void;
  onOpenMainDashboard?: () => void;
}

export function ParentTab({
  band,
  lockedBandId,
  returnedBandInfo,
  syncStatus,
  isQrScanMode = false,
  onDragParent,
  onAcknowledgeAlert,
  onSecureClasp,
  onNotifySecurity,
  onOpenMainDashboard,
}: ParentTabProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [recoveryToast, setRecoveryToast] = useState<string | null>(null);
  const [lookupExpired, setLookupExpired] = useState(false);

  const lastFiredAlertIdRef = useRef<number | null>(null);
  const lastRecoveryIdRef = useRef<number | null>(null);
  const localAckedIdsRef = useRef<Set<number>>(new Set());

  // If scanned QR has no active session after 5.5s, show clean returned/ended card
  useEffect(() => {
    if (band || returnedBandInfo) {
      setLookupExpired(false);
      return;
    }
    const timer = window.setTimeout(() => setLookupExpired(true), 5500);
    return () => window.clearTimeout(timer);
  }, [band, returnedBandInfo, lockedBandId]);

  // Repeatable Alert State Machine:
  // Fires Web Audio Siren + Vibration for every new alertId,
  // and AUTOMATICALLY STOPS + DISMISSES the instant activeAlert clears!
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

  // Calm 4-second Emerald frosted-glass toast on automatic safe-zone/gate/clasp recovery
  useEffect(() => {
    const notice = band?.recoveryNotice;
    if (!notice || band?.isReturned) return;
    if (lastRecoveryIdRef.current === notice.id) return;
    if (Date.now() - notice.ts > 20000) {
      lastRecoveryIdRef.current = notice.id;
      return;
    }

    lastRecoveryIdRef.current = notice.id;
    stopRepeatableAlarm();
    setRecoveryToast(notice.text);
    void playShortChime('lock');

    const timer = window.setTimeout(() => {
      setRecoveryToast((cur) => (cur === notice.text ? null : cur));
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [
    band?.recoveryNotice?.id,
    band?.recoveryNotice?.text,
    band?.recoveryNotice?.ts,
    band?.isReturned,
  ]);

  const handleEnablePhoneAlerts = async () => {
    await unlockPhoneAlerts();
    setAlertsEnabled(true);
  };

  const handleDismissOrSecure = () => {
    stopRepeatableAlarm();
    if (!band || !activeAlert) return;
    localAckedIdsRef.current.add(activeAlert.alertId);
    lastFiredAlertIdRef.current = null;

    if (activeAlert.type === 'TAMPER_ATTEMPT') {
      onSecureClasp(band.bandId);
    } else {
      onAcknowledgeAlert(band.bandId, activeAlert.alertId);
    }
  };

  const handleReportSecurity = () => {
    if (band && activeAlert) {
      onNotifySecurity(band.bandId, activeAlert.alertId);
    }
  };

  // Ended / Returned Wristband Confirmation Card
  if (
    (returnedBandInfo && (!band || returnedBandInfo.bandId === lockedBandId)) ||
    (!band && lookupExpired)
  ) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 gap-5">
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex justify-center">
            <GlassIcon tone="safe" size="lg">
              <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A] leading-snug">
            انتهت الجلسة وتم تسليم هذا السوار بأمان
          </h1>
          <p className="text-sm font-semibold text-[#475569] tabular-nums">
            {returnedBandInfo
              ? `${returnedBandInfo.childName} · ${returnedBandInfo.bandId}`
              : lockedBandId}
          </p>
          <p className="text-xs font-semibold text-[#059669] tabular-nums">
            وقت التسليم: {formatArabicTime(returnedBandInfo?.returnedAt)}
          </p>
        </div>

        {isQrScanMode && onOpenMainDashboard && (
          <button
            type="button"
            onClick={onOpenMainDashboard}
            className="px-4 py-2 rounded-full bg-white/75 hover:bg-white border border-white text-xs font-bold text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} />
            <span>فتح اللوحة الرئيسية</span>
          </button>
        )}
      </div>
    );
  }

  // Connecting state while receiving retained snapshot on fresh phone scan
  if (!band) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 gap-5">
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-3">
          <div className="flex justify-center">
            <GlassIcon tone="track" size="lg">
              <Radio className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-base font-bold text-[#0F172A] tabular-nums">
            {lockedBandId
              ? `جارٍ الاتصال بالسوار ${lockedBandId}`
              : 'لا يوجد سوار نشط حالياً'}
          </h1>
          <p className="text-xs font-semibold text-[#059669]">
            {syncStatus === 'connected'
              ? 'متصل لحظياً • إشارة قوية'
              : 'جارٍ مزامنة البث المباشر'}
          </p>
        </div>

        {isQrScanMode && onOpenMainDashboard && (
          <button
            type="button"
            onClick={onOpenMainDashboard}
            className="px-4 py-2 rounded-full bg-white/75 hover:bg-white border border-white text-xs font-bold text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} />
            <span>فتح اللوحة الرئيسية</span>
          </button>
        )}
      </div>
    );
  }

  const edition = getEditionById(band.editionId);
  const evalInfo = evaluateMallPosition(
    band.childPos,
    band.parentPos,
    band.safeLimitM
  );
  const dist = evalInfo.distParent;

  const isCritical =
    band.activeAlert?.type === 'TAMPER_ATTEMPT' ||
    band.activeAlert?.type === 'GATE_PROXIMITY' ||
    evalInfo.nearGate ||
    evalInfo.outsideSafe;
  const isWarn = !isCritical && dist > band.safeLimitM * 0.72;

  const statusLabel =
    band.activeAlert?.type === 'TAMPER_ATTEMPT'
      ? 'محاولة فك'
      : evalInfo.nearGate && evalInfo.nearestGate
      ? `خطر بوابة ${evalInfo.nearestGate.id}`
      : evalInfo.outsideSafe
      ? 'خارج النطاق'
      : isWarn
      ? 'قرب الحد'
      : 'آمن';

  const statusTone = isCritical ? 'alert' : isWarn ? 'warn' : 'safe';
  const isTampered =
    band.lockStatus === 'tampered' ||
    band.activeAlert?.type === 'TAMPER_ATTEMPT';

  return (
    <div className="pb-10">
      {/* CALM EMERALD AUTO-RECOVERY FROSTED TOAST */}
      {recoveryToast && !activeAlert && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 inset-x-4 z-40 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto max-w-md w-full px-4 py-3.5 rounded-2xl bg-[#ECFDF5]/95 backdrop-blur-xl border border-[#10B981]/55 shadow-[0_12px_36px_rgba(16,185,129,0.22)] flex items-center gap-3">
            <GlassIcon tone="safe" size="sm">
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
            </GlassIcon>
            <p className="text-xs sm:text-sm font-bold text-[#065F46] leading-snug">
              {recoveryToast}
            </p>
          </div>
        </div>
      )}

      {/* FULL-SCREEN FROSTED RED ALERT OVERLAY (Auto-dismisses when child returns to safety!) */}
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
                <p className="text-base sm:text-lg font-bold mt-1">
                  {activeAlert.locationLabel}
                </p>
              </div>
              <div className="bg-black/20 backdrop-blur-md border border-white/15 rounded-2xl p-4">
                <p className="text-xs opacity-85">المسافة</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
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
              onClick={handleDismissOrSecure}
              className="w-full py-4 px-5 bg-white hover:bg-slate-50 text-[#DC2626] text-base font-bold rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              {activeAlert.type === 'TAMPER_ATTEMPT' ? (
                <>
                  <Lock className="w-5 h-5" strokeWidth={2} />
                  <span>تأكيد تأمين القفل</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-5 h-5" strokeWidth={2} />
                  <span>تم الانتباه وإيقاف الصوت</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* DEDICATED PARENT MOBILE TRACKER CONTENT */}
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Compact Frosted Child Identity Header */}
        <header className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={edition.imageUrl}
              alt={edition.shortName}
              className="w-11 h-11 rounded-xl object-cover border border-white shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0F172A] truncate">
                {band.childName}
              </h1>
              <p className="text-[11px] font-semibold text-[#475569] tabular-nums">
                {band.bandId} · {edition.shortName} · النطاق {band.safeLimitM}م
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
            <span className="text-[10px] font-bold text-[#059669] inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <span>
                {syncStatus === 'connected'
                  ? 'متصل لحظياً • إشارة قوية'
                  : 'مزامنة مباشرة'}
              </span>
            </span>
          </div>
        </header>

        {/* One-Tap Sound + Vibration Unlock */}
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
            <span className="inline-flex items-center gap-1 text-[#0284C7] tabular-nums">
              <BatteryCharging className="w-3.5 h-3.5" strokeWidth={2} />
              <span>البطارية {band.batteryPct}%</span>
            </span>
          </div>
        )}

        {/* INTERACTIVE ARCHITECTURAL SMART MALL MAP */}
        <SmartMallMap
          band={band}
          allowDragChild={false}
          allowDragParent={Boolean(onDragParent)}
          onDragParent={
            onDragParent ? (pt) => onDragParent(band.bandId, pt) : undefined
          }
        />

        {/* FROSTED GLASS TELEMETRY CARDS + 4-DIGIT RETURN PIN */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="glass-card rounded-2xl p-3 flex items-center gap-2.5">
            <GlassIcon tone={statusTone} size="sm">
              <MapPin className="w-4 h-4" strokeWidth={2} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#64748B]">المسافة</p>
              <p className="text-sm font-bold text-[#0F172A] tabular-nums">
                {dist.toFixed(1)} م
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3 flex items-center gap-2.5">
            <GlassIcon tone="track" size="sm">
              <Footprints className="w-4 h-4" strokeWidth={2} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#64748B]">الخطوات</p>
              <p className="text-sm font-bold text-[#0F172A] tabular-nums">
                {band.steps}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3 flex items-center gap-2.5">
            <GlassIcon
              tone={band.batteryPct <= 20 ? 'alert' : 'safe'}
              size="sm"
            >
              <BatteryCharging className="w-4 h-4" strokeWidth={2} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#64748B]">البطارية</p>
              <p className="text-sm font-bold text-[#0F172A] tabular-nums">
                {band.batteryPct}%
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3 flex items-center gap-2.5">
            <GlassIcon tone={isTampered ? 'alert' : 'safe'} size="sm">
              {isTampered ? (
                <ShieldAlert className="w-4 h-4" strokeWidth={2} />
              ) : (
                <ShieldCheck className="w-4 h-4" strokeWidth={2} />
              )}
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#64748B]">القفل</p>
              <p className="text-[11px] font-bold text-[#0F172A] truncate">
                {isTampered ? 'محاولة فك' : 'مغلق إلكترونياً'}
              </p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 glass-panel rounded-2xl p-3 flex items-center gap-2.5 border-[#0284C7]/25">
            <GlassIcon tone="neutral" size="sm">
              <KeyRound className="w-4 h-4" strokeWidth={2} />
            </GlassIcon>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#64748B]">
                رمز التسليم
              </p>
              <p className="text-sm font-bold text-[#0F172A] tabular-nums">
                {band.pinCode}
              </p>
            </div>
          </div>
        </div>

        {/* Clean Subtle Footer Button on Scanned Phone (Zero Trap!) */}
        {isQrScanMode && onOpenMainDashboard && (
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={onOpenMainDashboard}
              className="px-4 py-2 rounded-full bg-white/70 hover:bg-white border border-white text-[11px] font-bold text-[#64748B] hover:text-[#0F172A] inline-flex items-center gap-1.5 shadow-xs transition-all duration-200 cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} />
              <span>فتح اللوحة الرئيسية</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
