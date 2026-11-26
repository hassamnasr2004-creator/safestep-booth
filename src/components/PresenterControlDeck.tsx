import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BatteryCharging,
  Footprints,
  Lock,
  Play,
  Radar,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { LiveBandState, ScenarioId } from '../types/safestep';
import { GlassIcon } from './GlassIcon';

interface PresenterControlDeckProps {
  band: LiveBandState;
  activeScenario: ScenarioId | null;
  onRunScenario: (bandId: string, scenario: ScenarioId) => void;
  onStepDirection: (bandId: string, dxM: number, dyM: number) => void;
  onRegularStep: (bandId: string) => void;
  onChangeSafeLimit: (bandId: string, safeLimitM: number) => void;
  onChangeBattery: (bandId: string, batteryPct: number) => void;
  onTriggerTamper: (bandId: string) => void;
  onSecureClasp: (bandId: string) => void;
  onFullReset: (bandId: string) => void;
}

export function PresenterControlDeck({
  band,
  activeScenario,
  onRunScenario,
  onStepDirection,
  onRegularStep,
  onChangeSafeLimit,
  onChangeBattery,
  onTriggerTamper,
  onSecureClasp,
  onFullReset,
}: PresenterControlDeckProps) {
  const isTampered =
    band.lockStatus === 'tampered' ||
    band.activeAlert?.type === 'TAMPER_ATTEMPT';

  return (
    <div className="space-y-4">
      {/* 1. ONE-CLICK ANIMATED JURY DEMO SCENARIOS */}
      <div className="glass-panel rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2">
            <GlassIcon tone="track" size="sm">
              <Play className="w-4 h-4" strokeWidth={2.1} />
            </GlassIcon>
            <h2 className="text-sm font-bold text-[#0F172A]">
              لوحة تحكم العرض المباشر
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#0284C7] tabular-nums">
            {band.bandId}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onRunScenario(band.bandId, 'kids_arena')}
          className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl inline-flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer ${
            activeScenario === 'kids_arena'
              ? 'bg-[#0284C7] text-white shadow-md'
              : 'bg-[#0EA5E9]/12 hover:bg-[#0EA5E9]/20 text-[#0369A1] border border-[#0EA5E9]/25'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Footprints className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>تمشية آمنة لمنطقة الألعاب</span>
          </span>
          <span className="text-[10px] opacity-80">آمن</span>
        </button>

        <button
          type="button"
          onClick={() => onRunScenario(band.bandId, 'breach_safe')}
          className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl inline-flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer ${
            activeScenario === 'breach_safe'
              ? 'bg-[#D97706] text-white shadow-md'
              : 'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#B45309] border border-[#F59E0B]/30'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Radar className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>ابتعاد وتجاوز نطاق الأمان</span>
          </span>
          <span className="text-[10px] opacity-80">إنذار</span>
        </button>

        <button
          type="button"
          onClick={() => onRunScenario(band.bandId, 'return_parent')}
          className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl inline-flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer ${
            activeScenario === 'return_parent'
              ? 'bg-[#059669] text-white shadow-md'
              : 'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#047857] border border-[#10B981]/35'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>عودة الطفل لولي الأمر (إيقاف تلقائي للإنذار)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onRunScenario(band.bandId, 'gate_danger')}
          className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl inline-flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer ${
            activeScenario === 'gate_danger'
              ? 'bg-[#B91C1C] text-white shadow-md'
              : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-sm'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>اقتراب خطير من بوابة الخروج</span>
          </span>
          <span className="text-[10px] opacity-90">بوابة 2</span>
        </button>

        {isTampered ? (
          <button
            type="button"
            onClick={() => onSecureClasp(band.bandId)}
            className="w-full py-2.5 px-3.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 shadow-md transition-all duration-200 cursor-pointer"
          >
            <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>تأكيد تأمين القفل</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onTriggerTamper(band.bandId)}
            className="w-full py-2.5 px-3.5 bg-white/85 hover:bg-[#DC2626] text-[#DC2626] hover:text-white border border-[#EF4444]/40 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>محاولة فك السوار بدون إذن</span>
          </button>
        )}
      </div>

      {/* 2. FINE CONTROLS: 8-DIRECTION D-PAD + REGULAR STEP + SLIDERS */}
      <div className="glass-card rounded-3xl p-4 space-y-4">
        {/* 8-Direction Smooth D-Pad */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
            <span>تحريك دقيق (8 اتجاهات)</span>
            <span className="text-[11px] text-[#64748B] tabular-nums">
              {band.steps} خطوة
            </span>
          </div>

          <div
            dir="ltr"
            className="grid grid-cols-3 gap-1.5 max-w-[210px] mx-auto"
          >
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, -1.6, -1.6)}
              aria-label="شمال غرب"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#334155] cursor-pointer"
            >
              <ArrowUpLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, 0, -2.2)}
              aria-label="شمال"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#0F172A] cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, 1.6, -1.6)}
              aria-label="شمال شرق"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#334155] cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, -2.2, 0)}
              aria-label="غرب"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#0F172A] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => onRegularStep(band.bandId)}
              aria-label="خطوة منتظمة +1 متر"
              title="خطوة منتظمة +1 متر"
              className="h-10 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-bold shadow-xs flex items-center justify-center cursor-pointer tabular-nums"
            >
              +1م
            </button>
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, 2.2, 0)}
              aria-label="شرق"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#0F172A] cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, -1.6, 1.6)}
              aria-label="جنوب غرب"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#334155] cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, 0, 2.2)}
              aria-label="جنوب"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#0F172A] cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => onStepDirection(band.bandId, 1.6, 1.6)}
              aria-label="جنوب شرق"
              className="h-10 rounded-xl bg-white/85 hover:bg-white border border-white shadow-xs flex items-center justify-center text-[#334155] cursor-pointer"
            >
              <ArrowDownRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRegularStep(band.bandId)}
            className="w-full py-2 px-3 bg-white/85 hover:bg-white border border-white text-[#0F172A] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Footprints className="w-3.5 h-3.5 text-[#0284C7]" strokeWidth={2} />
            <span>خطوة منتظمة +1 متر</span>
          </button>
        </div>

        {/* Safe Radius Slider (10m - 35m) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#0F172A]">نطاق الأمان</span>
            <span className="text-[#059669] tabular-nums">
              {band.safeLimitM} متر
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={35}
            step={1}
            value={band.safeLimitM}
            onChange={(e) =>
              onChangeSafeLimit(band.bandId, Number(e.target.value))
            }
            aria-label="نطاق الأمان"
            className="w-full accent-[#10B981] cursor-pointer"
          />
        </div>

        {/* Wristband Battery Slider (10% - 100%) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#0F172A] inline-flex items-center gap-1.5">
              <BatteryCharging
                className="w-3.5 h-3.5 text-[#0284C7]"
                strokeWidth={2}
              />
              <span>بطارية السوار</span>
            </span>
            <span
              className={`tabular-nums ${
                band.batteryPct <= 20 ? 'text-[#DC2626]' : 'text-[#0284C7]'
              }`}
            >
              {band.batteryPct}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={band.batteryPct}
            onChange={(e) =>
              onChangeBattery(band.bandId, Number(e.target.value))
            }
            aria-label="بطارية السوار"
            className="w-full accent-[#0284C7] cursor-pointer"
          />
        </div>

        {/* Clasp Lock Status Indicator */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 border ${
            isTampered
              ? 'bg-[#FEF2F2] border-[#EF4444]/40 text-[#DC2626]'
              : 'bg-[#ECFDF5]/80 border-[#10B981]/30 text-[#047857]'
          }`}
        >
          <span className="text-xs font-bold inline-flex items-center gap-1.5">
            {isTampered ? (
              <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            ) : (
              <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
            )}
            <span>حالة القفل</span>
          </span>
          <span className="text-xs font-bold">
            {isTampered ? 'محاولة فك غير مصرح بها' : 'مغلق إلكترونياً'}
          </span>
        </div>

        {/* Full Reset for Next Evaluation */}
        <button
          type="button"
          onClick={() => onFullReset(band.bandId)}
          className="w-full py-2.5 px-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
          <span>إعادة ضبط شاملة للتجربة التالية</span>
        </button>
      </div>
    </div>
  );
}
