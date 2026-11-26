import {
  LayoutDashboard,
  Printer,
  Radio,
  Shield,
  Smartphone,
  Watch,
} from 'lucide-react';
import { MainTabId, SyncStatus } from '../types/safestep';
import { GlassIcon } from './GlassIcon';

interface TopNavProps {
  activeTab: MainTabId;
  onSelectTab: (tab: MainTabId) => void;
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

  const navItems: {
    id: MainTabId;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    {
      id: 'booth',
      label: `البوث وغرفة التحكم`,
      icon: LayoutDashboard,
    },
    {
      id: 'parent',
      label: 'موبايل ولي الأمر',
      icon: Smartphone,
    },
    {
      id: 'band',
      label: 'وحدة السوار الذكي',
      icon: Watch,
    },
    {
      id: 'print',
      label: 'طباعة أكواد QR',
      icon: Printer,
    },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/75 backdrop-blur-xl border-b border-white/85 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onSelectTab('booth')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <GlassIcon tone="track" size="sm">
            <Shield className="w-4 h-4" strokeWidth={2} />
          </GlassIcon>
          <div className="text-right">
            <span className="text-sm sm:text-base font-bold text-[#0F172A] block leading-none">
              SafeStep
            </span>
            <span className="text-[10px] font-semibold text-[#64748B] tabular-nums">
              أساور نشطة: {activeCount}
            </span>
          </div>
        </button>

        {/* 4 Instant 1-Click Views */}
        <nav
          aria-label="التنقل الرئيسي"
          className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`px-3 sm:px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Sync Indicator */}
        <div className="hidden xl:flex items-center gap-2 text-xs shrink-0">
          <GlassIcon tone={syncTone} size="sm" className="!w-7 !h-7 !rounded-lg">
            <Radio className="w-3.5 h-3.5" strokeWidth={2} />
          </GlassIcon>
          <span className="font-bold text-[#475569]">{syncLabel}</span>
        </div>
      </div>
    </header>
  );
}
