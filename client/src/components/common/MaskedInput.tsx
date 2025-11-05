import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type MaskType = 'phone' | 'currency' | 'date' | 'custom';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  mask?: MaskType | string; // 'phone', 'currency', 'date', or custom pattern
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

// Phone mask: (###) ###-#### or +## ### ### ####
const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.startsWith('+')) {
    // International format: +## ### ### ####
    if (cleaned.length <= 2) return `+${cleaned.slice(1)}`;
    if (cleaned.length <= 5) return `+${cleaned.slice(1, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 8) return `+${cleaned.slice(1, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    return `+${cleaned.slice(1, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 13)}`;
  }
  
  // US format: (###) ###-####
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

// Currency mask: $###,###.##
const formatCurrency = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Split into dollars and cents
  const parts = cleaned.split('.');
  let dollars = parts[0] || '';
  let cents = parts[1] || '';
  
  // Limit cents to 2 digits
  if (cents.length > 2) {
    cents = cents.slice(0, 2);
  }
  
  // Add commas to dollars
  dollars = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (cents) {
    return `$${dollars}.${cents}`;
  }
  
  return dollars ? `$${dollars}` : '';
};

// Date mask: MM/DD/YYYY
const formatDate = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
};

// Custom mask pattern (e.g., "###-###-####")
const formatCustom = (value: string, pattern: string): string => {
  const cleaned = value.replace(/\D/g, '');
  let formatted = '';
  let cleanedIndex = 0;
  
  for (let i = 0; i < pattern.length && cleanedIndex < cleaned.length; i++) {
    if (pattern[i] === '#') {
      formatted += cleaned[cleanedIndex];
      cleanedIndex++;
    } else {
      formatted += pattern[i];
    }
  }
  
  return formatted;
};

const unformatValue = (formatted: string): string => {
  // Remove all formatting characters, keep only numbers
  return formatted.replace(/[^0-9]/g, '');
};

export function MaskedInput({
  mask = 'phone',
  value = '',
  onChange,
  className,
  placeholder,
  ...props
}: MaskedInputProps) {
  const [displayValue, setDisplayValue] = React.useState<string>(value || '');

  React.useEffect(() => {
    if (value !== undefined) {
      // Format the incoming value
      let formatted = value;
      
      if (mask === 'phone') {
        formatted = formatPhone(value);
      } else if (mask === 'currency') {
        formatted = formatCurrency(value);
      } else if (mask === 'date') {
        formatted = formatDate(value);
      } else if (mask !== 'custom' && mask !== 'text') {
        // Custom pattern
        formatted = formatCustom(value, mask);
      }
      
      setDisplayValue(formatted);
    }
  }, [value, mask]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Determine cursor position
    const cursorPosition = e.target.selectionStart || 0;
    const previousLength = displayValue.length;
    
    let formatted: string;
    
    if (mask === 'phone') {
      formatted = formatPhone(inputValue);
    } else if (mask === 'currency') {
      formatted = formatCurrency(inputValue);
    } else if (mask === 'date') {
      formatted = formatDate(inputValue);
    } else if (mask !== 'custom' && mask !== 'text') {
      // Custom pattern
      formatted = formatCustom(inputValue, mask);
    } else {
      formatted = inputValue;
    }
    
    setDisplayValue(formatted);
    
    // Get raw value (without formatting)
    const rawValue = unformatValue(formatted);
    
    // Calculate new cursor position
    const lengthDiff = formatted.length - previousLength;
    const newCursorPosition = Math.max(0, Math.min(cursorPosition + lengthDiff, formatted.length));
    
    // Update cursor position after render
    setTimeout(() => {
      e.target.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
    
    // Call onChange with raw value
    if (onChange) {
      onChange(rawValue);
    }
  };

  // Set default placeholder based on mask
  const defaultPlaceholder = React.useMemo(() => {
    if (placeholder) return placeholder;
    if (mask === 'phone') return '(555) 123-4567';
    if (mask === 'currency') return '$0.00';
    if (mask === 'date') return 'MM/DD/YYYY';
    return placeholder || '';
  }, [mask, placeholder]);

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={handleChange}
      placeholder={defaultPlaceholder}
      className={className}
    />
  );
}

