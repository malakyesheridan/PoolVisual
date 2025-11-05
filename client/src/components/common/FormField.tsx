import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface FormFieldProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'textarea';
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
  rows?: number; // For textarea
  icon?: React.ReactNode; // For icon prefix
  testId?: string; // Optional custom test ID (overrides default)
  showCharacterCount?: boolean; // Show character counter for text fields
  maxLength?: number; // Max length for character counter
  showSuccessState?: boolean; // Show success indicator when valid and touched
  asyncValidation?: boolean; // Show loading indicator during async validation
  // Allow passing through all other input props
  [key: string]: any;
}

export function FormField({
  name,
  label,
  description,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
  className,
  autoComplete,
  rows,
  icon,
  testId,
  showCharacterCount = false,
  maxLength,
  showSuccessState = false,
  asyncValidation = false,
  ...inputProps
}: FormFieldProps) {
  const { control, formState, watch } = useFormContext();
  const error = formState.errors[name];
  const fieldValue = watch(name) || '';
  const isTouched = formState.touchedFields[name];
  const isValid = !error && isTouched && showSuccessState;
  const hasError = !!error;
  const isAsyncValidating = asyncValidation && formState.isValidating;

  // Calculate character count
  const currentLength = React.useMemo(() => {
    if (typeof fieldValue === 'string') {
      return fieldValue.length;
    }
    return 0;
  }, [fieldValue]);

  const inputClassName = cn(
    icon && "pl-10", // Add padding for icon
    hasError && "border-red-500 focus:border-red-500 focus:ring-red-500",
    isValid && "border-green-500 focus:border-green-500 focus:ring-green-500",
    className
  );

  return (
    <FormItem>
      <FormLabel>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </FormLabel>
      {description && (
        <FormDescription>{description}</FormDescription>
      )}
      <FormControl>
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 z-10 pointer-events-none">
              {icon}
            </div>
          )}
          <Controller
            name={name}
            control={control}
            render={({ field }) => {
              const baseProps = {
                ...field,
                ...inputProps,
                placeholder,
                disabled: disabled || formState.isSubmitting,
                autoComplete,
                className: inputClassName,
                maxLength: maxLength || inputProps.maxLength,
              };

              const testIdValue = testId || `input-${name}`;

              if (type === 'textarea') {
                return (
                  <Textarea
                    {...baseProps}
                    rows={rows || 3}
                    data-testid={testIdValue}
                  />
                );
              }

              return (
                <Input
                  {...baseProps}
                  type={type}
                  data-testid={testIdValue}
                />
              );
            }}
          />
          {/* Success/Error/Loading Indicator */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
            {isAsyncValidating && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            )}
            {hasError && !isAsyncValidating && (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
            {isValid && !isAsyncValidating && !hasError && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
        </div>
      </FormControl>
      {/* Character Counter */}
      {showCharacterCount && maxLength && (
        <div className="text-xs text-slate-500 text-right mt-1">
          {fieldValue?.toString().length || 0} / {maxLength}
        </div>
      )}
      {hasError && (
        <FormMessage>
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            <span>{error.message as string}</span>
          </div>
        </FormMessage>
      )}
    </FormItem>
  );
}

