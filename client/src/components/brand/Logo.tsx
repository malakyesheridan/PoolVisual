/**
 * EasyFlow Studio Logo Component
 * 
 * Reusable logo component with multiple variants
 * Uses the actual EasyFlow Studio logo image
 */

import { cn } from '@/lib/utils';

export interface LogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

// Logo image path - update this when the actual logo file is added
const LOGO_IMAGE_PATH = '/logo/easyflow-logo.png';
const LOGO_ICON_PATH = '/logo/easyflow-logo-icon.png';

export function Logo({ 
  variant = 'full', 
  size = 'md', 
  className,
  showBorder = false 
}: LogoProps) {
  const sizeClasses = {
    sm: 'h-8',    // 32px - small
    md: 'h-10',   // 40px - medium (for navigation)
    lg: 'h-16',   // 64px - large
    xl: 'h-24',   // 96px - extra large (for login page)
  };

  const iconSizes = {
    sm: 32,   // 32px
    md: 40,   // 40px
    lg: 64,   // 64px
    xl: 96,   // 96px
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
        <img
          src={LOGO_ICON_PATH}
          alt="EasyFlow Studio"
          className={cn('object-contain', sizeClasses[size])}
          onError={(e) => {
            // Fallback to SVG if image not found
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.innerHTML = `
              <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-foreground">
                <rect x="5" y="5" width="90" height="90" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M 20 75 Q 30 50, 50 50 L 70 50" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>
                <path d="M 65 45 L 70 50 L 65 55" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <path d="M 80 25 Q 70 50, 50 50 L 30 50" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>
                <path d="M 35 45 L 30 50 L 35 55" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <text x="50" y="55" font-size="32" font-weight="bold" text-anchor="middle" fill="currentColor" font-family="Arial, sans-serif">$</text>
              </svg>
            `;
            target.parentElement?.appendChild(fallback.firstChild as Node);
          }}
        />
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

  // Full logo - just the image, no text
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        showBorder && 'border border-border rounded-lg p-2',
        className
      )}
    >
      <img
        src={LOGO_IMAGE_PATH}
        alt="EasyFlow Studio"
        className={cn('object-contain', sizeClasses[size])}
        onError={(e) => {
          // Fallback to SVG if image not found
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.innerHTML = `
            <svg width="${iconSizes[size]}" height="${iconSizes[size]}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-foreground">
              <rect x="5" y="5" width="90" height="90" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M 20 75 Q 30 50, 50 50 L 70 50" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>
              <path d="M 65 45 L 70 50 L 65 55" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M 80 25 Q 70 50, 50 50 L 30 50" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>
              <path d="M 35 45 L 30 50 L 35 55" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <text x="50" y="55" font-size="32" font-weight="bold" text-anchor="middle" fill="currentColor" font-family="Arial, sans-serif">$</text>
            </svg>
          `;
          target.parentElement?.appendChild(fallback.firstChild as Node);
        }}
      />
    </div>
  );
}

