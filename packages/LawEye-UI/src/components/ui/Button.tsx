import * as React from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800':
              variant === 'default',
            'border border-bytebot-bronze-light-7 bg-white text-bytebot-bronze-light-12 shadow-sm hover:bg-bytebot-bronze-light-2':
              variant === 'outline',
            'text-bytebot-bronze-light-12 hover:bg-bytebot-bronze-light-3':
              variant === 'ghost',
            'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800':
              variant === 'destructive',
            'h-9 px-4 text-sm': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-6 text-base': size === 'lg',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button };

