import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDabriStore } from '../store';
import { useTheme } from '../utils/theme';

export const SILENCE_OPTIONS = [
  { label: '1 שנייה', sublabel: 'מהיר — מתאים לפקודות קצרות', value: 1000 },
  { label: '1.5 שניות', sublabel: 'מאוזן — מתאים לרוב המשתמשים', value: 1500 },
  { label: '2 שניות', sublabel: 'איטי — מתאים למשפטים ארוכים', value: 2000 },
];

export function SilenceTimeoutSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { silenceTimeout, setSilenceTimeout } = useDabriStore();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
          padding: 20,
        },
        description: {
          fontSize: 15,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 22,
          marginBottom: 24,
        },
        currentBox: {
          backgroundColor: theme.surfaceVariant,
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 24,
        },
        currentLabel: {
          fontSize: 13,
          color: theme.textSecondary,
          marginBottom: 4,
        },
        currentValue: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.text,
        },
        optionsContainer: {
          gap: 12,
        },
        optionButton: {
          backgroundColor: theme.surface,
          borderWidth: 2,
          borderColor: theme.border,
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 20,
        },
        optionButtonActive: {
          borderColor: theme.primary,
          backgroundColor: theme.primary + '10',
        },
        optionRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        optionLabel: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
        },
        optionLabelActive: {
          color: theme.primary,
        },
        optionSublabel: {
          fontSize: 13,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginTop: 4,
        },
        checkmark: {
          fontSize: 18,
          color: theme.primary,
          fontWeight: '700',
        },
      }),
    [theme],
  );

  const currentLabel = SILENCE_OPTIONS.find((o) => o.value === silenceTimeout)?.label ?? `${silenceTimeout}ms`;

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        כמה זמן לחכות אחרי שסיימת לדבר לפני שהמערכת מפסיקה להקשיב ומתחילה לעבד את הפקודה.
      </Text>

      <View style={styles.currentBox}>
        <Text style={styles.currentLabel}>הגדרה נוכחית</Text>
        <Text style={styles.currentValue}>{currentLabel}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {SILENCE_OPTIONS.map((option) => {
          const isActive = silenceTimeout === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionButton, isActive && styles.optionButtonActive]}
              onPress={() => setSilenceTimeout(option.value)}
              activeOpacity={0.7}>
              <View style={styles.optionRow}>
                {isActive && <Text style={styles.checkmark}>✓</Text>}
                <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                  {option.label}
                </Text>
              </View>
              <Text style={styles.optionSublabel}>{option.sublabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
