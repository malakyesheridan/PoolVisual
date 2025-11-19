// client/src/design-tokens/tokens.ts
export const designTokens = {
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    base: '1rem',    // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },
  colors: {
    light: {
      primary: {
        DEFAULT: 'hsl(203.8863 88.2845% 53.1373%)',
        hover: 'hsl(203.8863 88.2845% 48%)',
        active: 'hsl(203.8863 88.2845% 43%)',
        foreground: 'hsl(0 0% 100%)',
      },
      surface: {
        canvas: 'hsl(240, 4.8%, 95.9%)',
        panel: 'hsl(0 0% 100%)',
        toolbar: 'hsl(0 0% 100%)',
        sidebar: 'hsl(0 0% 100%)',
        footer: 'hsl(0 0% 100%)',
      },
      border: {
        DEFAULT: 'hsl(201.4286 30.4348% 90.9804%)',
        divider: 'hsl(220 13% 91%)',
        focus: 'hsl(202.8169 89.1213% 53.1373%)',
      },
    },
    dark: {
      primary: {
        DEFAULT: 'hsl(203.8863 88.2845% 53.1373%)',
        hover: 'hsl(203.8863 88.2845% 58%)',
        active: 'hsl(203.8863 88.2845% 48%)',
        foreground: 'hsl(0 0% 100%)',
      },
      surface: {
        canvas: 'hsl(240, 5.9%, 10%)',
        panel: 'hsl(240, 5.9%, 12%)',
        toolbar: 'hsl(240, 5.9%, 12%)',
        sidebar: 'hsl(240, 5.9%, 12%)',
        footer: 'hsl(240, 5.9%, 12%)',
      },
      border: {
        DEFAULT: 'hsl(240, 3.7%, 15.9%)',
        divider: 'hsl(240, 3.7%, 15.9%)',
        focus: 'hsl(202.8169 89.1213% 53.1373%)',
      },
    },
    highContrast: {
      light: {
        foreground: 'hsl(0, 0%, 0%)',
        background: 'hsl(0, 0%, 100%)',
        border: 'hsl(0, 0%, 0%)',
        focus: 'hsl(0, 0%, 0%)',
      },
      dark: {
        foreground: 'hsl(0, 0%, 100%)',
        background: 'hsl(0, 0%, 0%)',
        border: 'hsl(0, 0%, 100%)',
        focus: 'hsl(0, 0%, 100%)',
      },
    },
  },
  elevation: {
    none: 'none',
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  motion: {
    duration: {
      fast: '150ms',
      base: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
} as const;

export type DesignTokens = typeof designTokens;

