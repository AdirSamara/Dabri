import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  StyleSheet,
  AppState,
} from 'react-native';
import { Linking } from 'react-native';
import AssistantBridge from '../native/AssistantBridge';
import { useTheme } from '../utils/theme';

export function AssistantSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20, gap: 16 },
    unavailable: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    unavailableText: {
      fontSize: 16,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 16, fontWeight: '600', writingDirection: 'rtl', textAlign: 'right' },
    benefitCard: {
      backgroundColor: theme.benefitCardBackground,
      borderRadius: 14,
      padding: 16,
      gap: 8,
    },
    benefitTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.benefitCardTitle,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    benefitBody: {
      fontSize: 14,
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'right',
      lineHeight: 22,
    },
    buttonPrimary: {
      backgroundColor: '#2196F3',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonPrimaryText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      writingDirection: 'rtl',
    },
    configuredContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    successBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    successIcon: { fontSize: 20, color: '#4CAF50', fontWeight: '700' },
    successText: { fontSize: 16, fontWeight: '700', color: '#4CAF50', writingDirection: 'rtl' },
    buttonGhost: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.surfaceVariant,
    },
    buttonGhostText: { color: theme.textSecondary, fontSize: 13, writingDirection: 'rtl' },
    hint: {
      fontSize: 12,
      color: theme.textTertiary,
      writingDirection: 'rtl',
      textAlign: 'right',
      lineHeight: 18,
    },
  }), [theme]);

  const [isDefaultAssistant, setIsDefaultAssistant] = useState(false);
  const [checkingAssistantStatus, setCheckingAssistantStatus] = useState(true);

  const checkAssistantStatus = async () => {
    if (!AssistantBridge) {
      setCheckingAssistantStatus(false);
      return;
    }
    try {
      const isDefault = await AssistantBridge.isDefaultAssistant();
      setIsDefaultAssistant(isDefault);
    } catch (e) {
      console.log('Error checking assistant status:', e);
    } finally {
      setCheckingAssistantStatus(false);
    }
  };

  useEffect(() => {
    checkAssistantStatus();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAssistantStatus();
      }
    });

    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssistantSettings = async () => {
    try {
      await Linking.sendIntent('android.settings.MANAGE_DEFAULT_APPS_SETTINGS');
    } catch {
      try {
        await Linking.sendIntent('android.settings.SETTINGS');
      } catch {
        ToastAndroid.show('לא ניתן לפתוח הגדרות', ToastAndroid.SHORT);
      }
    }
  };

  if (!AssistantBridge) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>לא זמין במכשיר זה</Text>
      </View>
    );
  }

  if (checkingAssistantStatus) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isDefaultAssistant ? '#4CAF50' : '#F44336' },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: isDefaultAssistant ? '#4CAF50' : '#F44336' },
          ]}
        >
          {isDefaultAssistant
            ? 'דברי מוגדרת כעוזרת ברירת המחדל'
            : 'דברי אינה העוזרת ברירת המחדל'}
        </Text>
      </View>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>למה כדאי להפעיל?</Text>
        <Text style={styles.benefitBody}>
          כשדברי מוגדרת כעוזרת ברירת המחדל, לחיצה ארוכה על כפתור ההפעלה{' '}
          תפתח אותה אוטומטית — בלי לחפש את האפליקציה.{'\n\n'}
          פשוט לחץ לחיצה ארוכה ➜ דברי נפתחת ➜ דבר אליה.{'\n\n'}
          מושלם בזמן נהיגה, בישול, או כשהידיים עסוקות.
        </Text>
      </View>

      {isDefaultAssistant ? (
        <View style={styles.configuredContainer}>
          <View style={styles.successBadge}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>מוגדר בהצלחה</Text>
          </View>
          <TouchableOpacity style={styles.buttonGhost} onPress={openAssistantSettings}>
            <Text style={styles.buttonGhostText}>שנה עוזרת</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.buttonPrimary} onPress={openAssistantSettings}>
            <Text style={styles.buttonPrimaryText}>הגדר כעוזרת ברירת מחדל</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>לאחר הלחיצה תוכל לבחור את דברי מרשימת העוזרות</Text>
        </>
      )}
    </ScrollView>
  );
}
