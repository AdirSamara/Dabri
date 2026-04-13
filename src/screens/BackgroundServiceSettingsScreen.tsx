import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Modal,
  Alert,
} from 'react-native';
import { useDabriStore } from '../store';
import DabriServiceBridge, { ServicePermissionStatus } from '../native/DabriServiceBridge';
import { useTheme } from '../utils/theme';

const SENSITIVITY_OPTIONS = [
  { id: 'low' as const, label: 'נמוכה', sublabel: 'פחות זיהויים שגויים, צריך לדבר ברור' },
  { id: 'medium' as const, label: 'בינונית', sublabel: 'איזון בין דיוק לרגישות' },
  { id: 'high' as const, label: 'גבוהה', sublabel: 'מזהה בקלות, עלול להפעיל בטעות' },
];

function PermissionRow({
  label,
  granted,
  onFix,
  theme,
}: {
  label: string;
  granted: boolean;
  onFix?: () => void;
  theme: any;
}): React.JSX.Element {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {!granted && onFix && (
          <TouchableOpacity
            onPress={onFix}
            style={{
              backgroundColor: theme.primary || '#2196F3',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 6,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>תקן</Text>
          </TouchableOpacity>
        )}
        <Text style={{
          fontSize: 13,
          color: granted ? '#4CAF50' : '#F44336',
          marginLeft: 8,
        }}>
          {granted ? 'מאושר' : 'נדרש אישור'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{
          fontSize: 15,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
        }}>
          {label}
        </Text>
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: granted ? '#4CAF50' : '#F44336',
        }} />
      </View>
    </View>
  );
}

export function BackgroundServiceSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const {
    isBackgroundServiceEnabled, setBackgroundServiceEnabled,
    wakeWordSensitivity, setWakeWordSensitivity,
    autoStartOnBoot, setAutoStartOnBoot,
    showOnLockScreen, setShowOnLockScreen,
  } = useDabriStore();

  const [permissions, setPermissions] = useState<ServicePermissionStatus | null>(null);
  const [isSamsung, setIsSamsung] = useState(false);
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const checkStatus = useCallback(async () => {
    if (!DabriServiceBridge) return;
    try {
      const [perms, running, samsung] = await Promise.all([
        DabriServiceBridge.checkServicePermissions(),
        DabriServiceBridge.isServiceRunning(),
        DabriServiceBridge.isSamsungDevice(),
      ]);
      setPermissions(perms);
      setIsServiceRunning(running);
      setIsSamsung(samsung);
    } catch (e) {
      console.log('Error checking service status:', e);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkStatus();
    });
    return () => subscription.remove();
  }, [checkStatus]);

  const handleToggleService = async () => {
    if (!DabriServiceBridge) return;

    if (isServiceRunning) {
      await DabriServiceBridge.stopService();
      setBackgroundServiceEnabled(false);
      setIsServiceRunning(false);
    } else {
      // Check critical permissions
      const perms = await DabriServiceBridge.checkServicePermissions();
      setPermissions(perms);

      if (!perms.microphone || !perms.overlay || !perms.notifications) {
        setOnboardingStep(0);
        setShowOnboarding(true);
        return;
      }

      try {
        await DabriServiceBridge.startService();
        setBackgroundServiceEnabled(true);
        setIsServiceRunning(true);
      } catch (e) {
        Alert.alert('שגיאה', 'שגיאה בהפעלת שירות הרקע. נסה שוב.');
      }
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { paddingTop: 8, paddingBottom: 32 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: 16,
      gap: 8,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      writingDirection: 'rtl',
    },
    toggleButton: {
      marginHorizontal: 16,
      marginBottom: 16,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    toggleButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
    card: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.surfaceVariant || theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'right',
      marginBottom: 8,
    },
    cardBody: {
      fontSize: 14,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      lineHeight: 22,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      marginHorizontal: 16,
      marginTop: 20,
      marginBottom: 8,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    optionContent: { flex: 1, alignItems: 'flex-end' },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      writingDirection: 'rtl',
    },
    optionSublabel: {
      fontSize: 12,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      marginTop: 2,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      marginLeft: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioInner: { width: 10, height: 10, borderRadius: 5 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    toggleLabel: {
      fontSize: 15,
      color: theme.text,
      writingDirection: 'rtl',
    },
    toggleValue: {
      fontSize: 13,
      fontWeight: '600',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '85%',
      borderRadius: 16,
      padding: 24,
      backgroundColor: theme.background,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'center',
      marginBottom: 12,
    },
    modalBody: {
      fontSize: 15,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    modalButton: {
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 8,
    },
    modalButtonText: { fontSize: 16, fontWeight: '600' },
  }), [theme]);

  const onboardingSteps = [
    {
      title: 'הפעלת שירות רקע',
      body: 'נפעיל כמה הרשאות כדי שדברי תוכל לפעול ברקע ולהקשיב למילת ההפעלה.',
      action: null,
    },
    {
      title: 'הרשאת מיקרופון',
      body: 'נדרש כדי לזהות את מילת ההפעלה ולהקשיב לפקודות קוליות.',
      action: () => {},
      skip: permissions?.microphone,
    },
    {
      title: 'הצגה מעל אפליקציות',
      body: 'נדרש כדי להציג את הבועה וחלון השיחה מעל אפליקציות אחרות.',
      action: () => DabriServiceBridge?.requestOverlayPermission(),
      skip: permissions?.overlay,
    },
    {
      title: 'התראות',
      body: 'נדרש כדי להציג התראה קבועה שהשירות פעיל.',
      action: () => DabriServiceBridge?.requestNotificationPermission(),
      skip: permissions?.notifications,
    },
    {
      title: 'אופטימיזציית סוללה',
      body: 'נדרש כדי שהמערכת לא תעצור את השירות ברקע.',
      action: () => DabriServiceBridge?.requestBatteryOptimizationExemption(),
      skip: permissions?.batteryOptimization,
    },
    ...(isSamsung ? [{
      title: 'הגדרת סמסונג',
      body: 'מכשירי סמסונג עוצרים אפליקציות רקע באופן אגרסיבי. מומלץ מאוד להוסיף את דברי לרשימת "אפליקציות שאינן במצב שינה".',
      action: () => DabriServiceBridge?.openSamsungBatterySettings(),
      skip: false,
    }] : []),
    {
      title: 'הכל מוכן!',
      body: 'שירות הרקע מופעל. תוכל לומר "היי דברי" בכל עת.',
      action: null,
      isFinal: true,
    },
  ];

  const visibleSteps = onboardingSteps.filter(s => !('skip' in s && s.skip));

  const handleOnboardingNext = async () => {
    const step = visibleSteps[onboardingStep];

    if ((step as any).isFinal) {
      setShowOnboarding(false);
      try {
        await DabriServiceBridge?.startService();
        setBackgroundServiceEnabled(true);
        setIsServiceRunning(true);
      } catch (e) {
        Alert.alert('שגיאה', 'שגיאה בהפעלת שירות הרקע.');
      }
      return;
    }

    if (step.action) {
      await step.action();
    }

    if (onboardingStep < visibleSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    }
  };

  if (!DabriServiceBridge) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.cardBody}>שירות הרקע אינו זמין בגרסה זו.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status */}
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {isServiceRunning ? 'שירות הרקע פעיל' : 'שירות הרקע כבוי'}
        </Text>
        <View style={[styles.statusDot, {
          backgroundColor: isServiceRunning ? '#4CAF50' : '#F44336',
        }]} />
      </View>

      {/* Toggle Button */}
      <TouchableOpacity
        style={[styles.toggleButton, {
          backgroundColor: isServiceRunning ? '#F44336' : '#4CAF50',
        }]}
        onPress={handleToggleService}
      >
        <Text style={styles.toggleButtonText}>
          {isServiceRunning ? 'כבה שירות רקע' : 'הפעל שירות רקע'}
        </Text>
      </TouchableOpacity>

      {/* Explanation Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>מה זה שירות רקע?</Text>
        <Text style={styles.cardBody}>
          שירות הרקע מאפשר לדברי להקשיב למילת ההפעלה גם כשהאפליקציה סגורה.
          כשתגיד "היי דברי", בועה קטנה תופיע על המסך ותוכל לתת פקודות קוליות.
          {'\n\n'}
          השירות רץ ברקע עם צריכת סוללה מינימלית.
        </Text>
      </View>

      {/* Permissions Dashboard */}
      {permissions && (
        <>
          <Text style={styles.sectionTitle}>הרשאות נדרשות</Text>
          <PermissionRow
            label="מיקרופון"
            granted={permissions.microphone}
            theme={theme}
          />
          <PermissionRow
            label="הצגה מעל אפליקציות"
            granted={permissions.overlay}
            onFix={() => DabriServiceBridge?.requestOverlayPermission()}
            theme={theme}
          />
          <PermissionRow
            label="התראות"
            granted={permissions.notifications}
            onFix={() => DabriServiceBridge?.requestNotificationPermission()}
            theme={theme}
          />
          <PermissionRow
            label="ביטול אופטימיזציית סוללה"
            granted={permissions.batteryOptimization}
            onFix={() => DabriServiceBridge?.requestBatteryOptimizationExemption()}
            theme={theme}
          />
          {isSamsung && (
            <PermissionRow
              label="אפליקציות שאינן במצב שינה (סמסונג)"
              granted={false}
              onFix={() => DabriServiceBridge?.openSamsungBatterySettings()}
              theme={theme}
            />
          )}
        </>
      )}

      {/* Advanced Settings */}
      <Text style={styles.sectionTitle}>הגדרות מתקדמות</Text>

      {/* Wake Word Sensitivity */}
      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>רגישות מילת הפעלה</Text>
      {SENSITIVITY_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={styles.optionCard}
          onPress={() => setWakeWordSensitivity(opt.id)}
        >
          <View style={[styles.radio, {
            borderColor: wakeWordSensitivity === opt.id ? '#2196F3' : theme.border,
          }]}>
            {wakeWordSensitivity === opt.id && (
              <View style={[styles.radioInner, { backgroundColor: '#2196F3' }]} />
            )}
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Auto-start toggle */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setAutoStartOnBoot(!autoStartOnBoot)}
      >
        <Text style={[styles.toggleValue, {
          backgroundColor: autoStartOnBoot ? '#E8F5E9' : '#FFEBEE',
          color: autoStartOnBoot ? '#2E7D32' : '#C62828',
        }]}>
          {autoStartOnBoot ? 'פעיל' : 'כבוי'}
        </Text>
        <Text style={styles.toggleLabel}>הפעלה אוטומטית עם הטלפון</Text>
      </TouchableOpacity>

      {/* Show on lock screen */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setShowOnLockScreen(!showOnLockScreen)}
      >
        <Text style={[styles.toggleValue, {
          backgroundColor: showOnLockScreen ? '#E8F5E9' : '#FFEBEE',
          color: showOnLockScreen ? '#2E7D32' : '#C62828',
        }]}>
          {showOnLockScreen ? 'פעיל' : 'כבוי'}
        </Text>
        <Text style={styles.toggleLabel}>הצגה במסך נעילה</Text>
      </TouchableOpacity>

      {/* Onboarding Modal */}
      <Modal visible={showOnboarding} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {visibleSteps[onboardingStep]?.title}
            </Text>
            <Text style={styles.modalBody}>
              {visibleSteps[onboardingStep]?.body}
            </Text>
            <Text style={{
              fontSize: 12,
              color: theme.textSecondary,
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {`שלב ${onboardingStep + 1} מתוך ${visibleSteps.length}`}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
              onPress={handleOnboardingNext}
            >
              <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                {(visibleSteps[onboardingStep] as any)?.isFinal ? 'סיום' : 'הבא'}
              </Text>
            </TouchableOpacity>
            {!(visibleSteps[onboardingStep] as any)?.isFinal && (
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: 'transparent' }]}
                onPress={() => setShowOnboarding(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>ביטול</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
