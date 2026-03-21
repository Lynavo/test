/**
 * Mobile-safe hex equivalents of @syncflow/design-tokens OKLCH palette.
 * React Native does not support OKLCH, so we convert to hex.
 */
export const colors = {
  // Base
  background: '#f2f5f8',
  foreground: '#1a2a3c',
  card: '#fafbfc',
  cardForeground: '#1a2a3c',

  // Semantic
  primary: '#2a6cb5',
  primaryForeground: '#ffffff',
  secondary: '#e4edf4',
  secondaryForeground: '#304a64',
  muted: '#e8eff4',
  mutedForeground: '#6b8299',
  accent: '#b8d4ec',
  accentForeground: '#1e3854',
  destructive: '#e53935',
  destructiveForeground: '#ffffff',

  // Border / Input
  border: '#d6e2ec',
  input: '#d8e4ee',
  ring: '#2a6cb5',

  // Status
  success: '#2e9960',
  successForeground: '#ffffff',
  warning: '#d4960a',
  warningForeground: '#3a2e10',

  // Screen background (light blue tint used by placeholder screens)
  screenBackground: '#daeef8',
  screenTitle: '#1a3a5c',
} as const;
