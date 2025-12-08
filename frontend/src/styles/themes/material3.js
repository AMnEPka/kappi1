// Material Design 3 Theme Tokens
// Based on Material Design 3 specification

export const material3Tokens = {
  // Color System - Material Design 3
  colors: {
    // Primary colors (Yellow theme)
    primary: {
      0: '#000000',
      10: '#1C1B00',
      20: '#333200',
      30: '#4A4900',
      40: '#636000',
      50: '#7D7900',
      60: '#979200',
      70: '#B2AD00',
      80: '#CEC800',
      90: '#EBE500',
      95: '#F9F300',
      99: '#FFFBFF',
      100: '#FFFFFF',
    },
    
    // Secondary colors
    secondary: {
      0: '#000000',
      10: '#1C1B00',
      20: '#333200',
      30: '#4A4900',
      40: '#636000',
      50: '#7D7900',
      60: '#979200',
      70: '#B2AD00',
      80: '#CEC800',
      90: '#EBE500',
      95: '#F9F300',
      99: '#FFFBFF',
      100: '#FFFFFF',
    },
    
    // Tertiary colors
    tertiary: {
      0: '#000000',
      10: '#1C1B00',
      20: '#333200',
      30: '#4A4900',
      40: '#636000',
      50: '#7D7900',
      60: '#979200',
      70: '#B2AD00',
      80: '#CEC800',
      90: '#EBE500',
      95: '#F9F300',
      99: '#FFFBFF',
      100: '#FFFFFF',
    },
    
    // Error colors
    error: {
      0: '#000000',
      10: '#410002',
      20: '#690005',
      30: '#93000A',
      40: '#BA1A1A',
      50: '#DE3730',
      60: '#FF5449',
      70: '#FF897D',
      80: '#FFB4AB',
      90: '#FFDAD6',
      95: '#FFEDEA',
      99: '#FFFBFF',
      100: '#FFFFFF',
    },
    
    // Neutral colors
    neutral: {
      0: '#000000',
      4: '#0F0F0F',
      6: '#141414',
      10: '#1A1A1A',
      12: '#1F1F1F',
      17: '#2A2A2A',
      20: '#303030',
      22: '#353535',
      24: '#3A3A3A',
      30: '#474747',
      40: '#5F5F5F',
      50: '#787878',
      60: '#919191',
      70: '#ABABAB',
      80: '#C6C6C6',
      87: '#DEDEDE',
      90: '#E3E3E3',
      92: '#E8E8E8',
      94: '#EDEDED',
      95: '#F0F0F0',
      96: '#F2F2F2',
      98: '#FAFAFA',
      99: '#FDFDFD',
      100: '#FFFFFF',
    },
    
    // Neutral variant colors
    neutralVariant: {
      0: '#000000',
      10: '#1C1C1E',
      20: '#313033',
      30: '#48464A',
      40: '#605D62',
      50: '#79767A',
      60: '#938F94',
      70: '#AEA9AE',
      80: '#CAC5CA',
      90: '#E6E1E6',
      95: '#F5EFF5',
      99: '#FFFBFF',
      100: '#FFFFFF',
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      display: "'Roboto', system-ui, -apple-system, sans-serif",
      body: "'Roboto', system-ui, -apple-system, sans-serif",
      mono: "'Roboto Mono', 'Courier New', monospace",
    },
    fontSize: {
      display: {
        large: { size: '3.5625rem', lineHeight: '4rem', weight: 400 },
        medium: { size: '2.8125rem', lineHeight: '3.25rem', weight: 400 },
        small: { size: '2.25rem', lineHeight: '2.75rem', weight: 400 },
      },
      headline: {
        large: { size: '2rem', lineHeight: '2.5rem', weight: 400 },
        medium: { size: '1.75rem', lineHeight: '2.25rem', weight: 400 },
        small: { size: '1.5rem', lineHeight: '2rem', weight: 400 },
      },
      title: {
        large: { size: '1.375rem', lineHeight: '1.75rem', weight: 500 },
        medium: { size: '1rem', lineHeight: '1.5rem', weight: 500 },
        small: { size: '0.875rem', lineHeight: '1.25rem', weight: 500 },
      },
      label: {
        large: { size: '0.875rem', lineHeight: '1.25rem', weight: 500 },
        medium: { size: '0.75rem', lineHeight: '1rem', weight: 500 },
        small: { size: '0.6875rem', lineHeight: '1rem', weight: 500 },
      },
      body: {
        large: { size: '1rem', lineHeight: '1.5rem', weight: 400 },
        medium: { size: '0.875rem', lineHeight: '1.25rem', weight: 400 },
        small: { size: '0.75rem', lineHeight: '1rem', weight: 400 },
      },
    },
  },
  
  // Spacing
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    7: '1.75rem',   // 28px
    8: '2rem',      // 32px
    9: '2.25rem',   // 36px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.75rem',   // 28px
    '2xl': '2rem',   // 32px
    full: '9999px',
  },
  
  // Elevation (Shadows)
  elevation: {
    0: 'none',
    1: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
    2: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
    3: '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
    4: '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
    5: '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
  },
  
  // Motion (Animation)
  motion: {
    duration: {
      short1: '50ms',
      short2: '100ms',
      short3: '150ms',
      short4: '200ms',
      medium1: '250ms',
      medium2: '300ms',
      medium3: '350ms',
      medium4: '400ms',
      long1: '450ms',
      long2: '500ms',
      long3: '550ms',
      long4: '600ms',
      extraLong1: '700ms',
      extraLong2: '800ms',
      extraLong3: '900ms',
      extraLong4: '1000ms',
    },
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      emphasized: 'cubic-bezier(0.2, 0, 1, 0.1)',
      emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
      standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
      standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    },
  },
};

// Material Design 3 Light Theme
export const material3LightTheme = {
  ...material3Tokens,
  name: 'material3-light',
  
  // Semantic color mappings
  semantic: {
    // Surface colors
    surface: material3Tokens.colors.neutral[99],
    surfaceDim: material3Tokens.colors.neutral[87],
    surfaceBright: material3Tokens.colors.neutral[98],
    surfaceContainerLowest: material3Tokens.colors.neutral[100],
    surfaceContainerLow: material3Tokens.colors.neutral[96],
    surfaceContainer: material3Tokens.colors.neutral[94],
    surfaceContainerHigh: material3Tokens.colors.neutral[92],
    surfaceContainerHighest: material3Tokens.colors.neutral[90],
    
    // On-surface colors
    onSurface: material3Tokens.colors.neutral[10],
    onSurfaceVariant: material3Tokens.colors.neutralVariant[30],
    inverseSurface: material3Tokens.colors.neutral[20],
    inverseOnSurface: material3Tokens.colors.neutral[95],
    
    // Primary colors
    primary: material3Tokens.colors.primary[40],
    onPrimary: material3Tokens.colors.primary[100],
    primaryContainer: material3Tokens.colors.primary[90],
    onPrimaryContainer: material3Tokens.colors.primary[10],
    inversePrimary: material3Tokens.colors.primary[80],
    
    // Secondary colors
    secondary: material3Tokens.colors.secondary[40],
    onSecondary: material3Tokens.colors.secondary[100],
    secondaryContainer: material3Tokens.colors.secondary[90],
    onSecondaryContainer: material3Tokens.colors.secondary[10],
    
    // Tertiary colors
    tertiary: material3Tokens.colors.tertiary[40],
    onTertiary: material3Tokens.colors.tertiary[100],
    tertiaryContainer: material3Tokens.colors.tertiary[90],
    onTertiaryContainer: material3Tokens.colors.tertiary[10],
    
    // Error colors
    error: material3Tokens.colors.error[40],
    onError: material3Tokens.colors.error[100],
    errorContainer: material3Tokens.colors.error[90],
    onErrorContainer: material3Tokens.colors.error[10],
    
    // Outline
    outline: material3Tokens.colors.neutralVariant[50],
    outlineVariant: material3Tokens.colors.neutralVariant[80],
    
    // Shadow
    shadow: material3Tokens.colors.neutral[0],
    scrim: material3Tokens.colors.neutral[0],
  },
};

// Material Design 3 Dark Theme
export const material3DarkTheme = {
  ...material3Tokens,
  name: 'material3-dark',
  
  // Semantic color mappings for dark theme
  semantic: {
    // Surface colors
    surface: material3Tokens.colors.neutral[6],
    surfaceDim: material3Tokens.colors.neutral[6],
    surfaceBright: material3Tokens.colors.neutral[24],
    surfaceContainerLowest: material3Tokens.colors.neutral[4],
    surfaceContainerLow: material3Tokens.colors.neutral[10],
    surfaceContainer: material3Tokens.colors.neutral[12],
    surfaceContainerHigh: material3Tokens.colors.neutral[17],
    surfaceContainerHighest: material3Tokens.colors.neutral[22],
    
    // On-surface colors
    onSurface: material3Tokens.colors.neutral[90],
    onSurfaceVariant: material3Tokens.colors.neutralVariant[80],
    inverseSurface: material3Tokens.colors.neutral[90],
    inverseOnSurface: material3Tokens.colors.neutral[20],
    
    // Primary colors
    primary: material3Tokens.colors.primary[80],
    onPrimary: material3Tokens.colors.primary[20],
    primaryContainer: material3Tokens.colors.primary[30],
    onPrimaryContainer: material3Tokens.colors.primary[90],
    inversePrimary: material3Tokens.colors.primary[40],
    
    // Secondary colors
    secondary: material3Tokens.colors.secondary[80],
    onSecondary: material3Tokens.colors.secondary[20],
    secondaryContainer: material3Tokens.colors.secondary[30],
    onSecondaryContainer: material3Tokens.colors.secondary[90],
    
    // Tertiary colors
    tertiary: material3Tokens.colors.tertiary[80],
    onTertiary: material3Tokens.colors.tertiary[20],
    tertiaryContainer: material3Tokens.colors.tertiary[30],
    onTertiaryContainer: material3Tokens.colors.tertiary[90],
    
    // Error colors
    error: material3Tokens.colors.error[80],
    onError: material3Tokens.colors.error[20],
    errorContainer: material3Tokens.colors.error[30],
    onErrorContainer: material3Tokens.colors.error[90],
    
    // Outline
    outline: material3Tokens.colors.neutralVariant[60],
    outlineVariant: material3Tokens.colors.neutralVariant[30],
    
    // Shadow
    shadow: material3Tokens.colors.neutral[0],
    scrim: material3Tokens.colors.neutral[0],
  },
};

