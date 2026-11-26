import { Printer, Radio, ShieldCheck, Shield } from 'lucide-react';
import { BoothTabId, SyncStatus } from '../types/safestep';
import { GlassIcon } from './GlassIcon';

interface TopNavProps {
  activeTab: BoothTabId;
  onSelectTab: (tab: BoothTabId) => void;
  syncStatus: SyncStatus;
  activeCount: number;
}

export function TopNav({
  activeTab,
  onSelectTab,
  syncStatus,
  activeCount,
}: TopNavProps) {
  const syncLabel =
    syncStatus === 'connected'
      ? 'بث مباشر'
      : syncStatus === 'failover'
      ? 'خادم احتياطي'
      : syncStatus === 'connecting'
      ? 'جارٍ الاتصال'
      : 'وضع محلي';

  const syncTone =
    syncStatus === 'connected'
      ? 'safe'
      : syncStatus === 'local'
      ? 'neutral'
      : 'warn';

  return (
    <header className="no-print sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <GlassIcon tone="track" size="sm">
            <Shield className="w-4 h-4" strokeWidth={2} />
          </GlassIcon>
          <span className="text-base font-bold text-[#0F172A] whitespace-nowrap">
            SafeStep
          </span>
        </div>

        {/* Booth Tabs (Strictly Booth Console & Print QR) */}
        <nav aria-label="أقسام البوث" className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectTab('console')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'console'
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/70'
            }`}
          >
            لوحة البوث ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('print')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'print'
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/70'
            }`}
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={2} />
            <span>طباعة QR</span>
          </button>
        </nav>

        {/* Persistence + Live Sync Status */}
        <div className="hidden md:flex items-center gap-3 text-xs shrink-0">
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[#059669] font-semibold">
              <ShieldCheck className="w-4 h-4" strokeWidth={2} />
              <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#475569]">
            <GlassIcon tone={syncTone} size="sm" className="!w-6 !h-6 !rounded-lg">
              <Radio className="w-3 h-3" strokeWidth={2} />
            </GlassIcon>
            <span>{syncLabel}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
