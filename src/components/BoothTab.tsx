import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Footprints,
  Lock,
  Radio,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  Unlock,
  Watch,
} from 'lucide-react';
import { BandEditionId, LatLngTuple, LiveBandState } from '../types/safestep';
import {
  BAND_EDITIONS,
  buildBandQrUrl,
  buildParentQrUrl,
  deriveZoneLabel,
  getEditionById,
  stepAlongHeading,
} from '../data/safestepData';
import { BandImage } from './BandImage';
import { GlassIcon } from './GlassIcon';
import { LiveLeafletMap } from './LiveLeafletMap';
import { QrImage } from './QrImage';

interface BoothTabProps {
  activeBands: LiveBandState[];
  selectedBandId: string;
  returnedCount: number;
  lastReturnedInfo: { bandId: string; childName: string } | null;
  baseUrl: string;
  onChangeBaseUrl: (url: string) => void;
  onSelectBand: (bandId: string) => void;
  onCreateBand: (params: {
    editionId: BandEditionId;
    childName: string;
    guardianPhone: string;
    safeLimitM: number;
  }) => void;
  onChangeSafeLimit: (bandId: string, safeLimitM: number) => void;
  onMoveChild: (
    bandId: string,
    nextCoords: LatLngTuple,
    opts: { addSteps: number; headingDeg?: number; source: 'gps' | 'fusion' }
  ) => void;
  onTriggerGate: (bandId: string) => void;
  onTriggerTamper: (bandId: string) => void;
  onDemoReset: (bandId: string) => void;
  onUnlockAndReturn: (bandId: string, pin: string) => boolean;
  onLaunchLockedRole: (role: 'parent' | 'band', bandId: string) => void;
  onDismissReturnedBanner: () => void;
}

export function BoothTab({
  activeBands,
  selectedBandId,
  returnedCount,
  lastReturnedInfo,
  baseUrl,
  onChangeBaseUrl,
  onSelectBand,
  onCreateBand,
  onChangeSafeLimit,
  onMoveChild,
  onTriggerGate,
  onTriggerTamper,
  onDemoReset,
  onUnlockAndReturn,
  onLaunchLockedRole,
  onDismissReturnedBanner,
}: BoothTabProps) {
  const [editionId, setEditionId] = useState<BandEditionId>('batman');
  const [childName, setChildName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [safeLimitM, setSafeLimitM] = useState<number>(15);
  const [nameError, setNameError] = useState(false);

  const [showUnlockBox, setShowUnlockBox] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [copiedWhich, setCopiedWhich] = useState<'parent' | 'band' | null>(null);

  const currentBand =
    activeBands.find((b) => b.bandId === selectedBandId) ?? activeBands[0] ?? null;

  const handleIssue = () => {
    const clean = childName.trim();
    if (!clean) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onCreateBand({
      editionId,
      childName: clean,
      guardianPhone: guardianPhone.trim(),
      safeLimitM,
    });
    setChildName('');
    setGuardianPhone('');
    setShowUnlockBox(false);
    setPinInput('');
    setPinError(false);
  };

  const handleConfirmUnlock = () => {
    if (!currentBand) return;
    const ok = onUnlockAndReturn(currentBand.bandId, pinInput.trim());
    if (ok) {
      setShowUnlockBox(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const copyLink = (text: string, which: 'parent' | 'band') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedWhich(which);
    window.setTimeout(() => setCopiedWhich(null), 1800);
  };

  const parentQrUrl = currentBand
    ? buildParentQrUrl(baseUrl, currentBand.bandId)
    : '';
  const bandQrUrl = currentBand
    ? buildBandQrUrl(baseUrl, currentBand.bandId)
    : '';

  const zoneInfo = currentBand
    ? deriveZoneLabel(
        currentBand.childCoords,
        currentBand.parentCoords,
        currentBand.gateCoords,
        currentBand.safeLimitM
      )
    : null;

  const isCritical =
    currentBand !== null &&
    zoneInfo !== null &&
    (currentBand.activeAlert?.type === 'TAMPER_ATTEMPT' ||
      currentBand.activeAlert?.type === 'GATE_PROXIMITY' ||
      zoneInfo.nearGate ||
      zoneInfo.distParent > currentBand.safeLimitM);

  const isWarn =
    !isCritical &&
    currentBand !== null &&
    zoneInfo !== null &&
    zoneInfo.distParent > currentBand.safeLimitM * 0.7;

  return (
    <div className="no-print max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Official Return Confirmation Banner */}
      {lastReturnedInfo && (
        <div className="glass-panel rounded-2xl p-4 border-[#10B981]/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlassIcon tone="safe" size="md">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
            </GlassIcon>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                تم فك القفل وتسليم السوار بنجاح — انتهت الجلسة
              </p>
              <p className="text-xs font-semibold text-[#475569] tabular-nums mt-0.5">
                {lastReturnedInfo.childName} · {lastReturnedInfo.bandId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissReturnedBanner}
            className="px-3.5 py-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A] bg-white/70 rounded-xl border border-white cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* SECTION 1: ISSUE NEW WRISTBAND */}
      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-bold text-[#0F172A]">
            إصدار وتفعيل سوار جديد
          </h1>
          <div className="flex items-center gap-3 text-xs font-semibold text-[#475569] tabular-nums">
            <span>النشط: {activeBands.length}</span>
            {returnedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#059669]">المسلّم: {returnedCount}</span>
              </>
            )}
          </div>
        </div>

        {/* 4 Character Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BAND_EDITIONS.map((ed) => {
            const active = editionId === ed.id;
            return (
              <button
                key={ed.id}
                type="button"
                onClick={() => setEditionId(ed.id)}
                className={`p-2 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer ${
                  active
                    ? 'border-[#0284C7] bg-white/90 shadow-md'
                    : 'border-white/70 bg-white/50 hover:bg-white/80'
                }`}
              >
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2">
                  <BandImage edition={ed} className="w-full h-full" />
                </div>
                <span className="text-sm font-bold text-[#0F172A]">
                  {ed.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Name + Phone + Safe Radius + Activate */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          <div className="lg:col-span-3">
            <input
              type="text"
              value={childName}
              onChange={(e) => {
                setChildName(e.target.value);
                setNameError(false);
              }}
              placeholder="اسم الطفل"
              className={`w-full h-11 px-3.5 text-sm font-medium bg-white/80 border rounded-xl text-[#0F172A] focus:outline-none ${
                nameError
                  ? 'border-[#EF4444]'
                  : 'border-white focus:border-[#0284C7]'
              }`}
            />
          </div>

          <div className="lg:col-span-3">
            <input
              type="tel"
              dir="ltr"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="رقم الهاتف (اختياري)"
              className="w-full h-11 px-3.5 text-sm font-medium bg-white/80 border border-white rounded-xl text-[#0F172A] text-right tabular-nums focus:outline-none focus:border-[#0284C7]"
            />
          </div>

          <div className="lg:col-span-3 grid grid-cols-3 gap-1.5 p-1 bg-white/60 border border-white rounded-xl">
            {[10, 15, 25].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSafeLimitM(r)}
                className={`text-xs font-bold rounded-lg transition-all duration-200 tabular-nums cursor-pointer ${
                  safeLimitM === r
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {r}م
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={handleIssue}
              className="w-full h-11 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span>تفعيل السوار وإصدار الأكواد</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: ACTIVE BAND DUAL QR CODES + LIVE MAP + UNLOCK */}
      {currentBand && zoneInfo ? (
        <section className="space-y-5">
          {/* Active Band Switcher */}
          {activeBands.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeBands.map((b) => {
                const selected = b.bandId === currentBand.bandId;
                return (
                  <button
                    key={b.bandId}
                    type="button"
                    onClick={() => {
                      onSelectBand(b.bandId);
                      setShowUnlockBox(false);
                      setPinInput('');
                      setPinError(false);
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
                      selected
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'glass-card text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <span>{b.childName}</span>
                    <span className="mx-1.5 opacity-60">·</span>
                    <span className="tabular-nums">{b.bandId}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Security Dispatch Alert Banner if Parent Clicked "إبلاغ الأمن فوراً" */}
          {currentBand.activeAlert?.securityNotified && (
            <div className="p-4 rounded-2xl bg-[#DC2626] text-white flex items-center justify-between gap-3 shadow-lg shadow-red-600/20">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0" strokeWidth={2} />
                <span className="text-sm font-bold">
                  بلاغ أمني عاجل: {currentBand.childName} ({currentBand.bandId}) —{' '}
                  {currentBand.activeAlert.locationLabel}
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums shrink-0">
                {zoneInfo.distParent.toFixed(1)} م
              </span>
            </div>
          )}

          {/* Editable Public URL Bar */}
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              htmlFor="booth-public-url"
              className="text-xs font-bold text-[#475569] whitespace-nowrap shrink-0"
            >
              رابط الموقع العام للموبايل
            </label>
            <input
              id="booth-public-url"
              type="url"
              dir="ltr"
              value={baseUrl}
              onChange={(e) => onChangeBaseUrl(e.target.value)}
              className="flex-1 h-9 px-3 text-xs bg-white/80 border border-white rounded-xl text-[#0F172A] focus:outline-none focus:border-[#0284C7]"
            />
          </div>

          {/* TWO CLEARLY LABELED SIDE-BY-SIDE QR CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* QR 1: Parent Locked View */}
            <div className="glass-panel rounded-3xl p-5 flex flex-col items-center text-center space-y-3.5">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <GlassIcon tone="track" size="sm">
                    <Smartphone className="w-4 h-4" strokeWidth={2} />
                  </GlassIcon>
                  <span className="text-sm font-bold text-[#0F172A]">
                    كود موبايل ولي الأمر
                  </span>
                </div>
                <span className="text-xs font-bold text-[#0284C7] tabular-nums">
                  {currentBand.bandId}
                </span>
              </div>

              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                <QrImage
                  value={parentQrUrl}
                  size={340}
                  className="w-48 h-48"
                  alt={`كود ولي الأمر ${currentBand.bandId}`}
                />
              </div>

              <div className="w-full grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => copyLink(parentQrUrl, 'parent')}
                  className="py-2.5 px-3 bg-white/80 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedWhich === 'parent' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#059669]" strokeWidth={2} />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchLockedRole('parent', currentBand.bandId)}
                  className="py-2.5 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>فتح شاشة الأب</span>
                </button>
              </div>
            </div>

            {/* QR 2: Child Smart Wristband View */}
            <div className="glass-panel rounded-3xl p-5 flex flex-col items-center text-center space-y-3.5">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <GlassIcon tone="safe" size="sm">
                    <Watch className="w-4 h-4" strokeWidth={2} />
                  </GlassIcon>
                  <span className="text-sm font-bold text-[#0F172A]">
                    كود جهاز/سوار الطفل للتجربة الحية
                  </span>
                </div>
                <span className="text-xs font-bold text-[#059669]">
                  {getEditionById(currentBand.editionId).shortName}
                </span>
              </div>

              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                <QrImage
                  value={bandQrUrl}
                  size={340}
                  className="w-48 h-48"
                  alt={`كود سوار الطفل ${currentBand.bandId}`}
                />
              </div>

              <div className="w-full grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => copyLink(bandQrUrl, 'band')}
                  className="py-2.5 px-3 bg-white/80 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedWhich === 'band' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#059669]" strokeWidth={2} />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchLockedRole('band', currentBand.bandId)}
                  className="py-2.5 px-3 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Watch className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>فتح كسوار حي</span>
                </button>
              </div>
            </div>
          </div>

          {/* LIVE MONITORING MAP + CONTROLS + OFFICIAL RETURN */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Real Leaflet Map Preview (7 cols) */}
            <div className="lg:col-span-7">
              <LiveLeafletMap
                band={currentBand}
                heightClass="h-[340px] sm:h-[380px]"
              />
            </div>

            {/* Booth Operational Desk (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Live Status Summary */}
              <div className="glass-card rounded-3xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <GlassIcon
                      tone={isCritical ? 'alert' : isWarn ? 'warn' : 'safe'}
                      size="sm"
                    >
                      <Radio className="w-4 h-4" strokeWidth={2} />
                    </GlassIcon>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        {currentBand.childName}
                      </p>
                      <p className="text-[11px] font-semibold text-[#475569] tabular-nums">
                        {zoneInfo.label} · {zoneInfo.distParent.toFixed(1)} م ·{' '}
                        {currentBand.steps} خطوة
                      </p>
                    </div>
                  </div>

                  {/* Live Safe Radius Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-white/70 rounded-xl border border-white">
                    {[10, 15, 25].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onChangeSafeLimit(currentBand.bandId, r)}
                        className={`px-2 py-1 text-[11px] font-bold rounded-lg tabular-nums cursor-pointer ${
                          currentBand.safeLimitM === r
                            ? 'bg-[#0F172A] text-white'
                            : 'text-[#475569]'
                        }`}
                      >
                        {r}م
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Live Demo Controls (Syncs Instantly to Scanned Phones) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = stepAlongHeading(
                        currentBand.childCoords,
                        45,
                        2.5
                      );
                      onMoveChild(currentBand.bandId, next, {
                        addSteps: 3,
                        headingDeg: 45,
                        source: 'fusion',
                      });
                    }}
                    className="py-2.5 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Footprints className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>خطوة (+2.5م)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDemoReset(currentBand.bandId)}
                    className="py-2.5 px-3 bg-white/85 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#0284C7]" strokeWidth={2} />
                    <span>إعادة ضبط المسار</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerGate(currentBand.bandId)}
                    className="py-2.5 px-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <TriangleAlert className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>اقتراب من البوابة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerTamper(currentBand.bandId)}
                    className="py-2.5 px-3 bg-white/85 hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#EF4444]/40 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>محاولة فك السوار</span>
                  </button>
                </div>

                {/* 1-Tap Jury Demo Reset Full Label */}
                <button
                  type="button"
                  onClick={() => onDemoReset(currentBand.bandId)}
                  className="w-full py-2.5 px-3 bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 text-[#0284C7] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>إعادة ضبط المسار لتجربة جديدة</span>
                </button>
              </div>

              {/* Official Return & 4-Digit PIN Unlock */}
              <div className="glass-card rounded-3xl p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockBox((v) => !v);
                    setPinError(false);
                  }}
                  className="w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" strokeWidth={2} />
                  <span>إنهاء الجلسة وتسليم السوار</span>
                </button>

                {showUnlockBox && (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A]">
                        رمز فك القفل من موبايل الأب
                      </span>
                      <span className="font-bold text-[#475569] tabular-nums">
                        {currentBand.pinCode}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value.replace(/\D/g, ''));
                          setPinError(false);
                        }}
                        placeholder="••••"
                        className="w-28 h-10 text-center text-base font-bold tracking-[0.35em] bg-white border border-slate-200 rounded-xl tabular-nums focus:outline-none focus:border-[#0284C7]"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmUnlock}
                        className="flex-1 h-10 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        تأكيد التسليم
                      </button>
                    </div>
                    {pinError && (
                      <p className="text-xs font-bold text-[#DC2626]">
                        الرمز غير صحيح
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="glass-card rounded-3xl p-8 text-center">
          <p className="text-sm font-bold text-[#0F172A]">
            لا توجد أساور نشطة حالياً
          </p>
        </section>
      )}
    </div>
  );
}
