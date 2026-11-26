import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  ShieldAlert,
  Smartphone,
  Unlock,
  Watch,
} from 'lucide-react';
import {
  BandEditionId,
  LiveBandState,
  MallPoint,
  ReturnedBandRecord,
  ScenarioId,
} from '../types/safestep';
import {
  BAND_EDITIONS,
  buildBandQrUrl,
  buildParentQrUrl,
  evaluateMallPosition,
  formatArabicTime,
} from '../data/safestepData';
import { BandImage } from './BandImage';
import { GlassIcon } from './GlassIcon';
import { PresenterControlDeck } from './PresenterControlDeck';
import { QrImage } from './QrImage';
import { SmartMallMap } from './SmartMallMap';

interface BoothTabProps {
  activeBands: LiveBandState[];
  selectedBandId: string;
  returnedCount: number;
  lastReturnedInfo: ReturnedBandRecord | null;
  baseUrl: string;
  activeScenario: ScenarioId | null;
  onChangeBaseUrl: (url: string) => void;
  onSelectBand: (bandId: string) => void;
  onCreateBand: (params: {
    editionId: BandEditionId;
    childName: string;
    guardianPhone: string;
    safeLimitM: number;
  }) => void;
  onRunScenario: (bandId: string, scenario: ScenarioId) => void;
  onStepDirection: (bandId: string, dxM: number, dyM: number) => void;
  onRegularStep: (bandId: string) => void;
  onDragChild: (bandId: string, pos: MallPoint) => void;
  onDragParent: (bandId: string, pos: MallPoint) => void;
  onClearTrail: (bandId: string) => void;
  onChangeSafeLimit: (bandId: string, safeLimitM: number) => void;
  onChangeBattery: (bandId: string, batteryPct: number) => void;
  onTriggerTamper: (bandId: string) => void;
  onSecureClasp: (bandId: string) => void;
  onFullReset: (bandId: string) => void;
  onUnlockAndReturn: (bandId: string, pin: string) => boolean;
  onOpenPreviewTab: (tab: 'parent' | 'band') => void;
  onDismissReturnedBanner: () => void;
}

export function BoothTab({
  activeBands,
  selectedBandId,
  returnedCount,
  lastReturnedInfo,
  baseUrl,
  activeScenario,
  onChangeBaseUrl,
  onSelectBand,
  onCreateBand,
  onRunScenario,
  onStepDirection,
  onRegularStep,
  onDragChild,
  onDragParent,
  onClearTrail,
  onChangeSafeLimit,
  onChangeBattery,
  onTriggerTamper,
  onSecureClasp,
  onFullReset,
  onUnlockAndReturn,
  onOpenPreviewTab,
  onDismissReturnedBanner,
}: BoothTabProps) {
  const [editionId, setEditionId] = useState<BandEditionId>('batman');
  const [childName, setChildName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [safeLimitM, setSafeLimitM] = useState<number>(15);
  const [nameError, setNameError] = useState(false);

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinShakeCount, setPinShakeCount] = useState(0);
  const [copiedWhich, setCopiedWhich] = useState<'parent' | 'band' | null>(null);

  const currentBand =
    activeBands.find((b) => b.bandId === selectedBandId) ??
    activeBands[0] ??
    null;

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
    setPinInput('');
    setPinError(false);
  };

  const handleConfirmUnlock = () => {
    if (!currentBand) return;
    const ok = onUnlockAndReturn(currentBand.bandId, pinInput.trim());
    if (ok) {
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinShakeCount((c) => c + 1);
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

  const evalInfo = currentBand
    ? evaluateMallPosition(
        currentBand.childPos,
        currentBand.parentPos,
        currentBand.safeLimitM
      )
    : null;

  return (
    <div className="no-print max-w-7xl mx-auto px-4 py-5 space-y-5">
      {/* Official Return Confirmation Banner */}
      {lastReturnedInfo && (
        <div className="glass-panel rounded-2xl p-4 border-[#10B981]/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlassIcon tone="safe" size="md">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
            </GlassIcon>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                انتهت الجلسة وتم تسليم السوار بأمان
              </p>
              <p className="text-xs font-semibold text-[#475569] tabular-nums mt-0.5">
                {lastReturnedInfo.childName} · {lastReturnedInfo.bandId} ·{' '}
                {formatArabicTime(lastReturnedInfo.returnedAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissReturnedBanner}
            className="px-3.5 py-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A] bg-white/75 rounded-xl border border-white cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* ACTIVE BAND SMART MALL COMMAND CENTER (Map + Side-by-Side Presenter Control Deck) */}
      {currentBand && evalInfo ? (
        <section className="space-y-4">
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
                {evalInfo.distParent.toFixed(1)} متر
              </span>
            </div>
          )}

          {/* MAIN DESKTOP SPLIT: SMART MALL MAP + QR + CHECKOUT (8 cols) | PRESENTER CONTROL DECK (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 space-y-5">
              {/* INTERACTIVE 2.5D ARCHITECTURAL SMART MALL MAP */}
              <SmartMallMap
                band={currentBand}
                allowDragChild
                allowDragParent
                onDragChild={(pt) => onDragChild(currentBand.bandId, pt)}
                onDragParent={(pt) => onDragParent(currentBand.bandId, pt)}
                onClearTrail={() => onClearTrail(currentBand.bandId)}
              />

              {/* PARENT QR CODE + SECURITY RETURN PIN CHECKOUT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Large Crisp Parent QR Code (?p=BAND_ID) */}
                <div className="glass-panel rounded-3xl p-5 flex flex-col items-center justify-between text-center space-y-3">
                  <div className="w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
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
                      size={360}
                      className="w-48 h-48"
                      alt={`كود ولي الأمر ${currentBand.bandId}`}
                    />
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(parentQrUrl, 'parent')}
                      className="py-2.5 px-3 bg-white/85 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedWhich === 'parent' ? (
                        <>
                          <Check
                            className="w-3.5 h-3.5 text-[#059669]"
                            strokeWidth={2}
                          />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>نسخ رابط الأب</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPreviewTab('parent')}
                      className="py-2.5 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>معاينة شاشة الأب</span>
                    </button>
                  </div>
                </div>

                {/* Official Return PIN + Public URL + Wristband Link */}
                <div className="glass-panel rounded-3xl p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GlassIcon tone="safe" size="sm">
                          <KeyRound className="w-4 h-4" strokeWidth={2} />
                        </GlassIcon>
                        <span className="text-sm font-bold text-[#0F172A]">
                          فك القفل وتسليم السوار
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-[#0F172A] tabular-nums">
                        الرمز: {currentBand.pinCode}
                      </span>
                    </div>

                    <div
                      key={pinShakeCount}
                      className={`flex gap-2 ${pinError ? 'animate-shake' : ''}`}
                    >
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value.replace(/\D/g, ''));
                          setPinError(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmUnlock();
                        }}
                        placeholder="رمز الأب (4 أرقام)"
                        className={`flex-1 h-11 px-3 text-center text-sm font-bold tracking-[0.25em] bg-white border rounded-xl tabular-nums focus:outline-none ${
                          pinError
                            ? 'border-[#EF4444] text-[#DC2626]'
                            : 'border-slate-200 focus:border-[#0284C7]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleConfirmUnlock}
                        className="px-4 h-11 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Unlock className="w-4 h-4" strokeWidth={2} />
                        <span>إنهاء وتسليم</span>
                      </button>
                    </div>

                    {pinError && (
                      <p className="text-xs font-bold text-[#DC2626] leading-relaxed">
                        رمز التحقق غير صحيح — راجع الرمز المكون من 4 أرقام في شاشة
                        ولي الأمر
                      </p>
                    )}
                  </div>

                  {/* Secondary Wristband Link + Public Base URL */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/70">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(bandQrUrl, 'band')}
                        className="flex-1 py-2 px-3 bg-white/85 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedWhich === 'band' ? (
                          <>
                            <Check
                              className="w-3.5 h-3.5 text-[#059669]"
                              strokeWidth={2}
                            />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Watch className="w-3.5 h-3.5 text-[#059669]" strokeWidth={2} />
                            <span>نسخ رابط السوار</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPreviewTab('band')}
                        className="flex-1 py-2 px-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Watch className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>فتح وحدة السوار</span>
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="booth-public-url"
                        className="block text-[11px] font-bold text-[#64748B] mb-1"
                      >
                        رابط الموقع العام للموبايل
                      </label>
                      <input
                        id="booth-public-url"
                        type="url"
                        dir="ltr"
                        value={baseUrl}
                        onChange={(e) => onChangeBaseUrl(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white/85 border border-white rounded-xl text-[#0F172A] focus:outline-none focus:border-[#0284C7]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR: FULL PRESENTER CONTROL DECK */}
            <aside className="lg:col-span-4 lg:sticky lg:top-20">
              <PresenterControlDeck
                band={currentBand}
                activeScenario={activeScenario}
                onRunScenario={onRunScenario}
                onStepDirection={onStepDirection}
                onRegularStep={onRegularStep}
                onChangeSafeLimit={onChangeSafeLimit}
                onChangeBattery={onChangeBattery}
                onTriggerTamper={onTriggerTamper}
                onSecureClasp={onSecureClasp}
                onFullReset={onFullReset}
              />
            </aside>
          </div>
        </section>
      ) : (
        <section className="glass-card rounded-3xl p-8 text-center">
          <p className="text-sm font-bold text-[#0F172A]">
            لا توجد أساور نشطة حالياً — أصدر سواراً جديداً من القسم أدناه
          </p>
        </section>
      )}

      {/* ISSUE NEW WRISTBAND PANEL */}
      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#0F172A]">
            إصدار وتفعيل سوار جديد
          </h2>
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
                    ? 'border-[#0284C7] bg-white/95 shadow-md'
                    : 'border-white/75 bg-white/55 hover:bg-white/85'
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
              className={`w-full h-11 px-3.5 text-sm font-medium bg-white/85 border rounded-xl text-[#0F172A] focus:outline-none ${
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
              className="w-full h-11 px-3.5 text-sm font-medium bg-white/85 border border-white rounded-xl text-[#0F172A] text-right tabular-nums focus:outline-none focus:border-[#0284C7]"
            />
          </div>

          <div className="lg:col-span-3 grid grid-cols-3 gap-1.5 p-1 bg-white/65 border border-white rounded-xl">
            {[12, 15, 25].map((r) => (
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
              <span>تفعيل السوار وإصدار كود QR</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
