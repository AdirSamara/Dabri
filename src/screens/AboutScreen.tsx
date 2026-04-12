import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../utils/theme';
import { AppIcon } from '../components/AppIcon';

export function AboutScreen(): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    iconContainer: {
      marginBottom: 24,
      shadowColor: '#1565C0',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    appName: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 18,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'center',
      marginBottom: 8,
    },
    version: {
      fontSize: 14,
      color: theme.textTertiary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <AppIcon size={120} />
      </View>
      <Text style={styles.appName}>דברי</Text>
      <Text style={styles.description}>העוזרת הקולית בעברית</Text>
      <Text style={styles.version}>גרסה 1.0.0</Text>
    </View>
  );
}
