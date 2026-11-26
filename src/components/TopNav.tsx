import { ShieldCheck } from 'lucide-react';
import { MainTab, SyncStatus } from '../types/safestep';

interface TopNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  syncStatus: SyncStatus;
  hasActiveAlarm: boolean;
  hasActiveSessions: boolean;
}

const TABS: { id: MainTab; label: string }[] = [
  { id: 'booth', label: 'تسليم السوار' },
  { id: 'parent', label: 'متابعة طفلي' },
  { id: 'print', label: 'طباعة QR' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  syncStatus,
  hasActiveAlarm,
  hasActiveSessions,
}: TopNavProps) {
  const statusLabel =
    syncStatus === 'connected'
      ? 'مزامنة مباشرة'
      : syncStatus === 'connecting'
      ? 'جارٍ الاتصال'
      : 'وضع محلي';

  const statusDotColor =
    syncStatus === 'connected'
      ? 'bg-[#0D9488]'
      : syncStatus === 'connecting'
      ? 'bg-[#D97706]'
      : 'bg-[#64748B]';

  return (
    <header className="no-print sticky top-0 z-30 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <span className="text-base font-bold text-[#0F172A] whitespace-nowrap shrink-0">
          SafeStep
        </span>

        <nav aria-label="الأقسام الرئيسية" className="flex items-center gap-1 sm:gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const alertDot = tab.id === 'parent' && hasActiveAlarm;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                <span>{tab.label}</span>
                {alertDot && (
                  <span
                    aria-label="تنبيه نشط"
                    className="inline-block w-2 h-2 rounded-full bg-[#DC2626] mr-1.5 align-middle"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3 text-xs whitespace-nowrap shrink-0">
          {hasActiveSessions && (
            <span className="inline-flex items-center gap-1 text-[#0D9488] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
              <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-medium text-[#475569]">
            <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
            <span>{statusLabel}</span>
          </span>
        </div>
      </div>

      {/* Subtle persistence notice on small screens when active sessions exist */}
      {hasActiveSessions && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-1.5 flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-[#0D9488] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
            <span>الجلسة محفوظة تلقائياً حتى تسليم السوار</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[#475569] font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
            <span>{statusLabel}</span>
          </span>
        </div>
      )}
    </header>
  );
}
