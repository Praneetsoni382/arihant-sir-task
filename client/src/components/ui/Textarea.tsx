import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-[#172033]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={4}
          className={cn(
            'w-full px-3 py-2 text-sm text-[#172033] bg-white border rounded-lg resize-y',
            'placeholder:text-[#667085]',
            'focus:outline-none focus:ring-2 focus:ring-[#3157A4] focus:border-[#3157A4]',
            'transition-colors',
            error
              ? 'border-[#D64545]'
              : 'border-[#E4E8EF] hover:border-[#c1c9d6]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#D64545]">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

