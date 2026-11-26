import { CheckCircle2, AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';
import { ToastMessage } from '../types/safestep';

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 z-40 flex flex-col gap-2 max-w-xs w-[calc(100vw-2rem)]"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0" strokeWidth={2} />,
          warning: <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" strokeWidth={2} />,
          error: <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0" strokeWidth={2} />,
          info: <Info className="w-4 h-4 text-[#1E3A8A] shrink-0" strokeWidth={2} />,
        };
        return (
          <div
            key={toast.id}
            className="bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 shadow-md flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              {iconMap[toast.type]}
              <span className="text-xs font-bold text-[#0F172A] truncate">
                {toast.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="إغلاق"
              className="text-[#475569] hover:text-[#0F172A] cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
