import { useColorScheme } from 'react-native';

/**
 * Two palettes checked against WCAG AA: body text is at least 7:1 on its
 * background, secondary text and the primary button at least 4.5:1.
 */
export const palettes = {
  light: {
    background: '#F6F7FB',
    surface: '#FFFFFF',
    border: '#D9DEE8',
    text: '#0F172A',
    textMuted: '#475569',
    primary: '#1F4ED8',
    onPrimary: '#FFFFFF',
    primarySoft: '#E6EDFF',
    success: '#15803D',
    successSoft: '#E7F6EC',
    danger: '#B91C1C',
    dangerSoft: '#FDECEC',
    disabled: '#94A3B8',
  },
  dark: {
    background: '#0B1220',
    surface: '#141C2E',
    border: '#2A3550',
    text: '#F1F5F9',
    textMuted: '#A9B6CC',
    primary: '#7EA2FF',
    onPrimary: '#0B1220',
    primarySoft: '#1C2A4D',
    success: '#4ADE80',
    successSoft: '#12301F',
    danger: '#F87171',
    dangerSoft: '#3A1717',
    disabled: '#5B6781',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['light']]: string };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
