import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Lock,
  Radio,
  ShieldAlert,
  Smartphone,
  Unlock,
} from 'lucide-react';
import { BandEditionId, LiveBandState } from '../types/safestep';
import {
  BAND_EDITIONS,
  buildParentBandUrl,
  buildWristbandUrl,
  computeEffectiveDistance,
  detectZone,
  getEditionById,
} from '../data/safestepData';
import { BandImage } from './BandImage';
import { QrImage } from './QrImage';
import { WristbandLivePanel } from './WristbandLivePanel';

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
  }) => void;
  onBroadcastPatch: (
    bandId: string,
    updater: (prev: LiveBandState) => LiveBandState
  ) => void;
  onUnlockAndReturn: (bandId: string, pin: string) => boolean;
  onOpenParentView: (bandId: string) => void;
  onOpenWristbandFullscreen: (bandId: string) => void;
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
  onBroadcastPatch,
  onUnlockAndReturn,
  onOpenParentView,
  onOpenWristbandFullscreen,
  onDismissReturnedBanner,
}: BoothTabProps) {
  const [editionId, setEditionId] = useState<BandEditionId>('batman');
  const [childName, setChildName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [nameError, setNameError] = useState(false);

  const [showSimulator, setShowSimulator] = useState(true);
  const [showUnlockBox, setShowUnlockBox] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'parent' | 'band' | null>(null);

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

  const copyText = (text: string, which: 'parent' | 'band') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedLink(which);
    window.setTimeout(() => setCopiedLink(null), 1800);
  };

  const parentUrl = currentBand
    ? buildParentBandUrl(baseUrl, currentBand.bandId)
    : '';
  const wristbandUrl = currentBand
    ? buildWristbandUrl(baseUrl, currentBand.bandId)
    : '';

  const currentZone = currentBand ? detectZone(currentBand.mapPos) : null;
  const distInfo = currentBand ? computeEffectiveDistance(currentBand) : null;
  const isRed =
    currentBand?.activeAlert?.type === 'gate' ||
    currentBand?.activeAlert?.type === 'tamper' ||
    currentZone?.type === 'exit';
  const isAmber =
    !isRed &&
    currentBand !== null &&
    distInfo !== null &&
    distInfo.meters > currentBand.safeLimitM;

  return (
    <div className="no-print max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Official Return Confirmation Banner */}
      {lastReturnedInfo && (
        <div className="bg-white border-2 border-[#0D9488] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className="w-5 h-5 text-[#0D9488] shrink-0"
              strokeWidth={2}
            />
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                تم فك القفل وتسليم السوار بنجاح — انتهت الجلسة
              </p>
              <p className="text-xs font-medium text-[#475569] tabular-nums mt-0.5">
                {lastReturnedInfo.childName} · {lastReturnedInfo.bandId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissReturnedBanner}
            className="px-3 py-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A] border border-[#E2E8F0] rounded-md cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* SECTION 1: FAST 1-SCREEN ISSUE FORM */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-bold text-[#0F172A]">
            إصدار وتلبيس سوار جديد
          </h1>
          <div className="flex items-center gap-3 text-xs font-semibold text-[#475569] tabular-nums">
            <span>النشط: {activeBands.length}</span>
            {returnedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#0D9488]">المسلّم: {returnedCount}</span>
              </>
            )}
          </div>
        </div>

        {/* 4 Visual Character Picker Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BAND_EDITIONS.map((ed) => {
            const active = editionId === ed.id;
            return (
              <button
                key={ed.id}
                type="button"
                onClick={() => setEditionId(ed.id)}
                className={`p-2 rounded-lg border-2 text-center transition-colors cursor-pointer ${
                  active
                    ? 'border-[#1E3A8A] bg-[#1E3A8A]/[0.04]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#94A3B8]'
                }`}
              >
                <div className="aspect-[4/3] rounded-md overflow-hidden bg-[#F1F5F9] mb-2">
                  <BandImage edition={ed} className="w-full h-full" />
                </div>
                <span className="text-sm font-bold text-[#0F172A]">
                  {ed.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Child Name + Optional Phone + Activate Button */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-4">
            <input
              type="text"
              value={childName}
              onChange={(e) => {
                setChildName(e.target.value);
                setNameError(false);
              }}
              placeholder="اسم الطفل"
              className={`w-full h-11 px-3.5 text-sm font-medium border rounded-lg bg-white text-[#0F172A] focus:outline-none ${
                nameError
                  ? 'border-[#DC2626]'
                  : 'border-[#CBD5E1] focus:border-[#1E3A8A]'
              }`}
            />
          </div>

          <div className="sm:col-span-4">
            <input
              type="tel"
              dir="ltr"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="رقم ولي الأمر (اختياري)"
              className="w-full h-11 px-3.5 text-sm font-medium border border-[#CBD5E1] rounded-lg bg-white text-[#0F172A] text-right tabular-nums focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={handleIssue}
              className="w-full h-11 px-4 bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-sm font-bold rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span>تفعيل قفل السوار وإصدار الكود</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: ACTIVE BANDS SWITCHER + LIVE QR + WRISTBAND SIMULATOR + OFFICIAL RETURN */}
      {currentBand ? (
        <section className="space-y-4">
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
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#0F172A]'
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

          {currentBand.activeAlert?.securityNotified && (
            <div className="p-4 rounded-xl bg-[#DC2626] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0" strokeWidth={2} />
                <span className="text-sm font-bold">
                  بلاغ أمني عاجل: {currentBand.childName} ({currentBand.bandId}) —{' '}
                  {currentBand.activeAlert.zoneName}
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums shrink-0">
                {distInfo?.meters ?? 0} م
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* QR Pairing Card (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
              <div>
                <label
                  htmlFor="public-base-url"
                  className="block text-xs font-bold text-[#475569] mb-1"
                >
                  رابط الموقع العام للموبايل
                </label>
                <input
                  id="public-base-url"
                  type="url"
                  dir="ltr"
                  value={baseUrl}
                  onChange={(e) => onChangeBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md text-[#0F172A] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              <div className="flex flex-col items-center py-4 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <QrImage
                  value={parentUrl}
                  size={360}
                  className="w-56 h-56 bg-white p-2 rounded-lg border border-[#E2E8F0]"
                  alt={`QR ${currentBand.bandId}`}
                />
                <div className="mt-3 text-center">
                  <p className="text-lg font-bold text-[#0F172A] tabular-nums">
                    {currentBand.bandId}
                  </p>
                  <p className="text-xs font-semibold text-[#475569]">
                    {currentBand.childName} ·{' '}
                    {getEditionById(currentBand.editionId).shortName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenParentView(currentBand.bandId)}
                  className="py-2.5 px-3 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" strokeWidth={1.75} />
                  <span>شاشة ولي الأمر</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyText(parentUrl, 'parent')}
                  className="py-2.5 px-3 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedLink === 'parent' ? (
                    <>
                      <Check className="w-4 h-4 text-[#0D9488]" strokeWidth={2} />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" strokeWidth={1.75} />
                      <span>نسخ رابط المتابعة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Status + Wristband Simulator + Official Return (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BandImage
                    edition={getEditionById(currentBand.editionId)}
                    className="w-14 h-11 rounded-md border border-[#E2E8F0]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#0F172A]">
                        {currentBand.childName}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isRed
                            ? 'text-[#DC2626]'
                            : isAmber
                            ? 'text-[#D97706]'
                            : 'text-[#0D9488]'
                        }`}
                      >
                        {currentBand.activeAlert?.type === 'tamper'
                          ? 'محاولة فك'
                          : isRed
                          ? 'خطر بوابة'
                          : isAmber
                          ? 'ابتعاد عن النطاق'
                          : 'آمن'}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] tabular-nums mt-0.5">
                      {currentZone?.nameAr} · {distInfo?.meters ?? 0} متر · القفل مغلق
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulator((v) => !v)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg border inline-flex items-center gap-1.5 cursor-pointer ${
                      showSimulator
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                        : 'bg-white text-[#0F172A] border-[#CBD5E1]'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>
                      {showSimulator ? 'إخفاء محاكي السوار' : 'فتح محاكي السوار الحي'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockBox((v) => !v);
                      setPinError(false);
                    }}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#0F172A] bg-white hover:bg-[#0F172A] hover:text-white text-[#0F172A] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>إنهاء الجلسة وتسليم السوار</span>
                  </button>
                </div>
              </div>

              {/* Secure 4-Digit PIN Official Return Gate */}
              {showUnlockBox && (
                <div className="bg-white border-2 border-[#0F172A] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A]">
                      أدخل رمز الفك الموجود على موبايل ولي الأمر
                    </span>
                    <span className="font-bold text-[#475569] tabular-nums">
                      رمز الجلسة: {currentBand.pinCode}
                    </span>
                  </div>
                  <div className="flex gap-2.5">
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
                      className="w-36 h-11 text-center text-base font-bold tracking-[0.35em] border border-[#CBD5E1] rounded-lg tabular-nums focus:outline-none focus:border-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmUnlock}
                      className="flex-1 h-11 px-4 bg-[#0D9488] hover:bg-[#0B7C72] text-white text-sm font-bold rounded-lg cursor-pointer"
                    >
                      تأكيد فك القفل والتسليم
                    </button>
                  </div>
                  {pinError && (
                    <p className="text-xs font-bold text-[#DC2626]">
                      الرمز غير صحيح — تم إرسال تنبيه محاولة فك
                    </p>
                  )}
                </div>
              )}

              {/* Live Wristband Simulator Panel */}
              {showSimulator && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <span className="text-xs font-bold text-[#0F172A]">
                      محاكي السوار الحي (بث مباشر إلى موبايل ولي الأمر)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(wristbandUrl, 'band')}
                        className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                      >
                        {copiedLink === 'band'
                          ? 'تم نسخ رابط السوار'
                          : 'نسخ رابط جهاز الطفل'}
                      </button>
                      <span className="text-[#CBD5E1]">·</span>
                      <button
                        type="button"
                        onClick={() => onOpenWristbandFullscreen(currentBand.bandId)}
                        className="text-xs font-semibold text-[#0F172A] hover:underline cursor-pointer"
                      >
                        تشغيل هذا الجهاز كسوار حي
                      </button>
                    </div>
                  </div>

                  <WristbandLivePanel
                    band={currentBand}
                    onBroadcastPatch={(updater) =>
                      onBroadcastPatch(currentBand.bandId, updater)
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center">
          <p className="text-sm font-bold text-[#0F172A]">
            لا توجد أساور نشطة حالياً
          </p>
          <p className="text-xs text-[#475569] mt-1">
            اختر شخصية وأدخل اسم الطفل أعلاه لإصدار سوار جديد
          </p>
        </section>
      )}
    </div>
  );
}
