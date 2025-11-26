import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalVariant = 'default' | 'confirm' | 'form' | 'info' | 'danger';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: ModalVariant;
  size?: ModalSize;
  loading?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    variant?: 'default' | 'destructive';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

const variantIcons: Record<ModalVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  confirm: AlertTriangle,
  form: Info,
  info: Info,
  danger: AlertCircle,
};

const variantColors: Record<ModalVariant, string> = {
  default: 'text-slate-900',
  confirm: 'text-yellow-600',
  form: 'text-primary',
  info: 'text-primary',
  danger: 'text-red-600',
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  variant = 'default',
  size = 'md',
  loading = false,
  children,
  footer,
  primaryAction,
  secondaryAction,
  showCloseButton = true,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  className,
}: ModalProps) {
  const VariantIcon = variantIcons[variant];
  const variantColor = variantColors[variant];

  const handlePrimaryAction = async () => {
    if (primaryAction?.onClick && !loading) {
      await primaryAction.onClick();
    }
  };

  const handleSecondaryAction = () => {
    if (secondaryAction?.onClick && !loading) {
      secondaryAction.onClick();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      onOpenChange(newOpen);
    }
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!open || loading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        handleOpenChange(false);
      }
      // Enter key triggers primary action (only if no form is focused)
      if (e.key === 'Enter' && primaryAction && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (
          activeElement &&
          (activeElement.tagName === 'BODY' || activeElement.getAttribute('role') === 'dialog')
        ) {
          e.preventDefault();
          handlePrimaryAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, primaryAction, closeOnEscape]);

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleOpenChange}
    >
      <DialogContent 
        className={cn(sizeClasses[size], className)}
        onInteractOutside={(e) => {
          if (!closeOnOverlayClick || loading) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!closeOnEscape || loading) {
            e.preventDefault();
          }
        }}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant !== 'default' && variant !== 'form' && (
              <VariantIcon className={cn('w-5 h-5 flex-shrink-0', variantColor)} />
            )}
            <DialogTitle className={variantColor}>{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className={cn('py-4', loading && 'opacity-50 pointer-events-none')}>
          {children}
        </div>

        {/* Footer */}
        {(footer || primaryAction || secondaryAction) && (
          <DialogFooter>
            {footer ? (
              <div className="w-full">{footer}</div>
            ) : (
              <div className="flex justify-end gap-2 w-full">
                {secondaryAction && (
                  <Button
                    variant="outline"
                    onClick={handleSecondaryAction}
                    disabled={loading || secondaryAction.disabled}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant || 'default'}
                    onClick={handlePrimaryAction}
                    disabled={loading || primaryAction.disabled}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      primaryAction.label
                    )}
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

