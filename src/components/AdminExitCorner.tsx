import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { ADMIN_UNLOCK_PIN } from '../data/safestepData';
import { GlassIcon } from './GlassIcon';

interface AdminExitCornerProps {
  onAuthorizedExit: () => void;
}

export function AdminExitCorner({ onAuthorizedExit }: AdminExitCornerProps) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (pin.trim() === ADMIN_UNLOCK_PIN) {
      setOpen(false);
      setPin('');
      setError(false);
      onAuthorizedExit();
    } else {
      setError(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setPin('');
          setError(false);
        }}
        aria-label="خروج المشرف"
        className="no-print fixed bottom-3 left-3 z-30 w-8 h-8 rounded-full bg-white/50 hover:bg-white/90 backdrop-blur-md border border-white/80 flex items-center justify-center text-[#64748B] opacity-40 hover:opacity-100 transition-all duration-300 cursor-pointer"
      >
        <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="no-print fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="glass-panel rounded-2xl p-5 max-w-xs w-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GlassIcon tone="neutral" size="sm">
                  <Lock className="w-4 h-4" strokeWidth={1.75} />
                </GlassIcon>
                <span className="text-sm font-bold text-[#0F172A]">
                  عودة للوحة البوث
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-900/5 flex items-center justify-center text-[#475569] cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="رمز المشرف (1234)"
              className="w-full h-11 px-3 text-center text-base font-bold tracking-[0.35em] bg-white/80 border border-slate-200 rounded-xl tabular-nums focus:outline-none focus:border-[#0EA5E9]"
            />

            {error && (
              <p className="text-xs font-bold text-[#DC2626] text-center">
                الرمز غير صحيح
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full h-10 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer"
            >
              تأكيد
            </button>
          </div>
        </div>
      )}
    </>
  );
}
