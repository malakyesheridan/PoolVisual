import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal, ModalVariant } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  const modalVariant: ModalVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'confirm' : 'info';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      variant={modalVariant}
      size="sm"
      loading={loading}
      primaryAction={{
        label: confirmLabel,
        onClick: handleConfirm,
        variant: variant === 'danger' ? 'destructive' : 'default',
      }}
      secondaryAction={{
        label: cancelLabel,
        onClick: handleCancel,
      }}
      closeOnEscape={!loading}
      closeOnOverlayClick={!loading}
    >
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            {icon}
          </div>
        </div>
      )}
      <p className="text-sm text-slate-600 text-center">{description}</p>
    </Modal>
  );
}

