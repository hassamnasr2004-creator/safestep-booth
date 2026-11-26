import React from 'react';

export type GlassTone = 'safe' | 'track' | 'warn' | 'alert' | 'neutral';

interface GlassIconProps {
  tone?: GlassTone;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<GlassTone, string> = {
  safe: 'bg-[#10B981]/15 text-[#059669] border-[#10B981]/25',
  track: 'bg-[#0EA5E9]/15 text-[#0284C7] border-[#0EA5E9]/25',
  warn: 'bg-[#F59E0B]/15 text-[#D97706] border-[#F59E0B]/25',
  alert: 'bg-[#EF4444]/20 text-[#DC2626] border-[#EF4444]/30',
  neutral: 'bg-slate-900/[0.06] text-[#0F172A] border-white/80',
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
};

export function GlassIcon({
  tone = 'neutral',
  size = 'md',
  children,
  className = '',
}: GlassIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 backdrop-blur-md border shadow-[inset_0_1px_1px_rgba(255,255,255,0.85),0_4px_12px_rgba(15,23,42,0.05)] transition-all duration-300 ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {children}
    </span>
  );
}
