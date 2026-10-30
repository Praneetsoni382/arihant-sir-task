import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-[#172033]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-3 py-2 text-sm text-[#172033] bg-white border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-[#3157A4] focus:border-[#3157A4]',
            'transition-colors',
            error
              ? 'border-[#D64545]'
              : 'border-[#E4E8EF] hover:border-[#c1c9d6]',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-[#D64545]">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

