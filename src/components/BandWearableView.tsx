import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Lock,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import {
  LiveBandState,
  MallPoint,
  ReturnedBandRecord,
  ScenarioId,
  SyncStatus,
} from '../types/safestep';
import {
  evaluateMallPosition,
  formatArabicTime,
  getEditionById,
} from '../data/safestepData';
import { GlassIcon } from './GlassIcon';
import { PresenterControlDeck } from './PresenterControlDeck';
import { SmartMallMap } from './SmartMallMap';

interface BandWearableViewProps {
  band: LiveBandState | null;
  lockedBandId: string;
  returnedBandInfo: ReturnedBandRecord | null;
  syncStatus: SyncStatus;
  activeScenario: ScenarioId | null;
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
  onReturnToBooth: () => void;
}

export function BandWearableView({
  band,
  lockedBandId,
  returnedBandInfo,
  syncStatus,
  activeScenario,
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
  onReturnToBooth,
}: BandWearableViewProps) {
  const [lookupExpired, setLookupExpired] = useState(false);

  useEffect(() => {
    if (band || returnedBandInfo) {
      setLookupExpired(false);
      return;
    }
    const timer = window.setTimeout(() => setLookupExpired(true), 5500);
    return () => window.clearTimeout(timer);
  }, [band, returnedBandInfo, lockedBandId]);

  // Ended / Returned session confirmation card (ALWAYS includes instant Return to Booth!)
  if (
    (returnedBandInfo && (!band || returnedBandInfo.bandId === lockedBandId)) ||
    (!band && lookupExpired)
  ) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        <button
          type="button"
          onClick={onReturnToBooth}
          className="w-full glass-panel rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#0F172A] hover:bg-white border-[#0284C7]/35 transition-all duration-200 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-[#0284C7]" strokeWidth={2.2} />
          <span>العودة للبوث</span>
        </button>

        <div className="glass-panel rounded-3xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <GlassIcon tone="safe" size="lg">
              <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A]">
            انتهت الجلسة وتم تسليم هذا السوار بأمان
          </h1>
          <p className="text-xs font-semibold text-[#475569] tabular-nums">
            {returnedBandInfo
              ? `${returnedBandInfo.childName} · ${returnedBandInfo.bandId}`
              : lockedBandId}
          </p>
          <p className="text-xs font-semibold text-[#059669] tabular-nums">
            وقت التسليم: {formatArabicTime(returnedBandInfo?.returnedAt)}
          </p>
        </div>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        <button
          type="button"
          onClick={onReturnToBooth}
          className="w-full glass-panel rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#0F172A] hover:bg-white border-[#0284C7]/35 transition-all duration-200 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-[#0284C7]" strokeWidth={2.2} />
          <span>العودة للبوث</span>
        </button>

        <div className="glass-panel rounded-3xl p-8 text-center space-y-3">
          <div className="flex justify-center">
            <GlassIcon tone="track" size="lg">
              <Radio className="w-6 h-6" strokeWidth={2} />
            </GlassIcon>
          </div>
          <h1 className="text-base font-bold text-[#0F172A] tabular-nums">
            جارٍ الاتصال بالسوار {lockedBandId}
          </h1>
          <p className="text-xs font-semibold text-[#64748B]">
            {syncStatus === 'connected' ? 'بث مباشر متصل' : 'مزامنة نشطة'}
          </p>
        </div>
      </div>
    );
  }

  const edition = getEditionById(band.editionId);
  const evalInfo = evaluateMallPosition(
    band.childPos,
    band.parentPos,
    band.safeLimitM
  );
  const isTampered =
    band.lockStatus === 'tampered' ||
    band.activeAlert?.type === 'TAMPER_ATTEMPT';

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      {/* ALWAYS VISIBLE 1-CLICK RETURN TO BOOTH BUTTON (Zero Navigation Traps!) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReturnToBooth}
          className="glass-panel rounded-2xl px-4 py-2.5 inline-flex items-center gap-2 text-sm font-bold text-[#0F172A] hover:bg-white border-[#0284C7]/35 transition-all duration-200 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-[#0284C7]" strokeWidth={2.2} />
          <span>العودة للبوث</span>
        </button>

        {/* Wearable Hardware Identity Pill */}
        <div className="glass-card rounded-2xl px-4 py-2 flex items-center gap-3">
          <img
            src={edition.imageUrl}
            alt={edition.shortName}
            className="w-9 h-9 rounded-xl object-cover border border-white shadow-xs shrink-0"
          />
          <div>
            <p className="text-xs font-bold text-[#0F172A]">
              وحدة السوار الذكي · {band.childName}
            </p>
            <p className="text-[11px] font-semibold text-[#475569] tabular-nums">
              {band.bandId} · {evalInfo.distParent.toFixed(1)} متر ·{' '}
              {band.steps} خطوة
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#0EA5E9]/12 text-[#0284C7] text-xs font-bold inline-flex items-center gap-1 tabular-nums">
            <BatteryCharging className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{band.batteryPct}%</span>
          </span>
          <GlassIcon tone={isTampered ? 'alert' : 'safe'} size="sm">
            {isTampered ? (
              <ShieldAlert className="w-4 h-4" strokeWidth={2} />
            ) : (
              <Lock className="w-4 h-4" strokeWidth={2} />
            )}
          </GlassIcon>
        </div>
      </div>

      {/* Interactive Smart Mall Map + Full Presenter Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8">
          <SmartMallMap
            band={band}
            allowDragChild
            allowDragParent
            onDragChild={(pt) => onDragChild(band.bandId, pt)}
            onDragParent={(pt) => onDragParent(band.bandId, pt)}
            onClearTrail={() => onClearTrail(band.bandId)}
          />
        </div>

        <div className="lg:col-span-4">
          <PresenterControlDeck
            band={band}
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
        </div>
      </div>
    </div>
  );
}
