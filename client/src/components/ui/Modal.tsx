import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div
        className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} max-h-[92vh] flex flex-col z-10`}
        style={{ border: '1px solid #E4E8EF' }}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E4E8EF]">
          <h2 className="text-sm sm:text-base font-semibold text-[#172033] pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F5F7FA] text-[#667085] hover:text-[#172033] transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="p-3.5 sm:p-4 border-t border-[#E4E8EF] flex flex-wrap sm:flex-nowrap justify-end gap-2.5 sm:gap-3 bg-[#FBFBFC] rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
