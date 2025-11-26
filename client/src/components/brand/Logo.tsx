/**
 * EasyFlow Studio Logo Component
 * 
 * Reusable logo component with multiple variants
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface LogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

export function Logo({ 
  variant = 'full', 
  size = 'md', 
  className,
  showBorder = false 
}: LogoProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-20',
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 36,
    xl: 44,
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const iconSize = iconSizes[size];
  const textSize = textSizes[size];

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center justify-center', sizeClasses[size], className)}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground"
        >
          {/* Circular arrow symbol with dollar sign */}
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          {/* Bottom-left to top-right arrow */}
          <path
            d="M 20 75 Q 30 50, 50 50 L 70 50"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 65 45 L 70 50 L 65 55"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Top-right to bottom-left arrow */}
          <path
            d="M 80 25 Q 70 50, 50 50 L 30 50"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 35 45 L 30 50 L 35 55"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Dollar sign in center */}
          <text
            x="50"
            y="55"
            fontSize="32"
            fontWeight="bold"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Arial, sans-serif"
          >
            $
          </text>
        </svg>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={cn('flex flex-col', className)}>
        <span className={cn('font-bold', textSize)}>EasyFlow</span>
        <span className={cn('text-xs uppercase tracking-wider', textSize === 'text-sm' ? 'text-[10px]' : '')}>
          STUDIO
        </span>
      </div>
    );
  }

  // Full logo (icon + text)
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        showBorder && 'border border-border rounded-lg p-2',
        className
      )}
    >
      <div className={cn('flex items-center justify-center', sizeClasses[size])}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground"
        >
          {/* Circular arrow symbol with dollar sign */}
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          {/* Bottom-left to top-right arrow */}
          <path
            d="M 20 75 Q 30 50, 50 50 L 70 50"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 65 45 L 70 50 L 65 55"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Top-right to bottom-left arrow */}
          <path
            d="M 80 25 Q 70 50, 50 50 L 30 50"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 35 45 L 30 50 L 35 55"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Dollar sign in center */}
          <text
            x="50"
            y="55"
            fontSize="32"
            fontWeight="bold"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Arial, sans-serif"
          >
            $
          </text>
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={cn('font-bold text-foreground', textSize)}>EasyFlow</span>
        <span className={cn('text-xs uppercase tracking-wider text-foreground/80', textSize === 'text-sm' ? 'text-[10px]' : '')}>
          STUDIO
        </span>
      </div>
    </div>
  );
}

