import { baseTokens } from './base';

export const yellowBlackTheme = {
  ...baseTokens,
  name: 'yellow-black',
  
  semantic: {
    // Основные цвета интерфейса
    primary: baseTokens.colors.primary[400],
    primaryHover: baseTokens.colors.primary[500],
    surface: baseTokens.colors.gray[50],
    surfaceVariant: baseTokens.colors.gray[100],
    onSurface: baseTokens.colors.gray[900],
    onPrimary: baseTokens.colors.gray[900],
    
    // Компоненты
    appBar: {
      background: baseTokens.colors.primary[400],
      text: baseTokens.colors.gray[900]
    },
    sidebar: {
      background: '#ffffff',
      border: baseTokens.colors.gray[200],
      active: baseTokens.colors.primary[100]
    },
    card: {
      background: '#ffffff',
      border: baseTokens.colors.gray[200]
    }
  }
}