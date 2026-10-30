import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#172033]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm text-[#172033] bg-white border rounded-lg',
            'placeholder:text-[#667085]',
            'focus:outline-none focus:ring-2 focus:ring-[#3157A4] focus:border-[#3157A4]',
            'transition-colors',
            error
              ? 'border-[#D64545] focus:ring-[#D64545]'
              : 'border-[#E4E8EF] hover:border-[#c1c9d6]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#D64545]">{error}</p>}
        {helperText && !error && <p className="text-xs text-[#667085]">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

