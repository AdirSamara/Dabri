import { useDabriStore } from '../store';

export interface AppTheme {
  background: string;
  surface: string;
  surfaceVariant: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  success: string;
  error: string;
  warning: string;
  // specific tokens
  headerBackground: string;
  headerText: string;
  chipBackground: string;
  overlayCard: string;
  transcriptBackground: string;
  transcriptText: string;
  placeholderText: string;
  geminiBadgeBackground: string;
  geminiBadgeText: string;
  speedBoxBackground: string;
  speedBoxText: string;
  benefitCardBackground: string;
  benefitCardTitle: string;
}

export const lightTheme: AppTheme = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceVariant: '#F0F0F0',
  border: '#F0F0F0',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#AAAAAA',
  primary: '#2196F3',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  headerBackground: '#FFFFFF',
  headerText: '#000000',
  chipBackground: '#F8F9FA',
  overlayCard: '#FFFFFF',
  transcriptBackground: '#F8F9FA',
  transcriptText: '#2C3E50',
  placeholderText: '#BDC3C7',
  geminiBadgeBackground: '#EDE7F6',
  geminiBadgeText: '#7C4DFF',
  speedBoxBackground: '#EDE7F6',
  speedBoxText: '#7C4DFF',
  benefitCardBackground: '#F0F7FF',
  benefitCardTitle: '#1565C0',
};

export const darkTheme: AppTheme = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceVariant: '#2A2A2A',
  border: '#2A2A2A',
  text: '#F0F0F0',
  textSecondary: '#999999',
  textTertiary: '#666666',
  primary: '#2196F3',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  headerBackground: '#121212',
  headerText: '#F0F0F0',
  chipBackground: '#2A2A2A',
  overlayCard: '#1E1E1E',
  transcriptBackground: '#2A2A2A',
  transcriptText: '#E0E0E0',
  placeholderText: '#555555',
  geminiBadgeBackground: '#2D1F4E',
  geminiBadgeText: '#B39DDB',
  speedBoxBackground: '#2D1F4E',
  speedBoxText: '#B39DDB',
  benefitCardBackground: '#1A2740',
  benefitCardTitle: '#90CAF9',
};

export function useTheme(): AppTheme {
  const isDarkMode = useDabriStore((s) => s.isDarkMode);
  return isDarkMode ? darkTheme : lightTheme;
}
