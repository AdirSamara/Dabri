import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useDabriStore } from '../store';
import { useTheme } from '../utils/theme';

const NAV_APP_OPTIONS = [
  { id: 'waze' as const, label: 'Waze', sublabel: 'ניווט בזמן אמת עם דיווחי תנועה' },
  { id: 'google_maps' as const, label: 'Google Maps', sublabel: 'מפות גוגל עם ניווט קולי' },
];

export function NavigationSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    preferredNavApp, setPreferredNavApp,
    homeAddress, setHomeAddress,
    workAddress, setWorkAddress,
  } = useDabriStore();

  const [homeInput, setHomeInput] = useState(homeAddress);
  const [workInput, setWorkInput] = useState(workAddress);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
        },
        content: {
          padding: 20,
          gap: 24,
        },
        description: {
          fontSize: 15,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 22,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
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
        inputLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 8,
        },
        textInput: {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        inputHint: {
          fontSize: 12,
          color: theme.textTertiary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginTop: 4,
        },
      }),
    [theme],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.description}>
        בחר את אפליקציית הניווט המועדפת והגדר כתובות בית ועבודה לניווט מהיר.
      </Text>

      {/* Default Navigation App */}
      <View>
        <Text style={styles.sectionTitle}>אפליקציית ניווט ברירת מחדל</Text>
        <View style={styles.optionsContainer}>
          {NAV_APP_OPTIONS.map((option) => {
            const isActive = preferredNavApp === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionButton, isActive && styles.optionButtonActive]}
                onPress={() => setPreferredNavApp(option.id)}
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

      {/* Home Address */}
      <View>
        <Text style={styles.inputLabel}>כתובת בית</Text>
        <TextInput
          style={styles.textInput}
          value={homeInput}
          onChangeText={setHomeInput}
          onEndEditing={() => setHomeAddress(homeInput.trim())}
          placeholder='לדוגמה: רחוב הרצל 5, תל אביב'
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
        />
        <Text style={styles.inputHint}>
          כשתאמר "נווט הביתה" הניווט יפתח לכתובת זו
        </Text>
      </View>

      {/* Work Address */}
      <View>
        <Text style={styles.inputLabel}>כתובת עבודה</Text>
        <TextInput
          style={styles.textInput}
          value={workInput}
          onChangeText={setWorkInput}
          onEndEditing={() => setWorkAddress(workInput.trim())}
          placeholder='לדוגמה: רחוב רוטשילד 1, תל אביב'
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
        />
        <Text style={styles.inputHint}>
          כשתאמר "נווט לעבודה" הניווט יפתח לכתובת זו
        </Text>
      </View>
    </ScrollView>
  );
}
