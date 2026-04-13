import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Linking,
  ToastAndroid,
} from 'react-native';
import { useDabriStore } from '../store';
import BackgroundServiceBridge, { PermissionStatus } from '../native/BackgroundServiceBridge';
import { useTheme } from '../utils/theme';

function PermissionRow({
  label,
  description,
  granted,
  onPress,
  theme,
}: {
  label: string;
  description: string;
  granted: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.JSX.Element {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        rowContent: { flex: 1, alignItems: 'flex-end', marginLeft: 12 },
        rowLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        rowDescription: {
          fontSize: 12,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginTop: 2,
        },
        dot: { width: 10, height: 10, borderRadius: 5 },
        settingsButton: {
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 6,
          backgroundColor: theme.surfaceVariant,
        },
        settingsButtonText: {
          fontSize: 12,
          color: theme.textSecondary,
          writingDirection: 'rtl',
        },
      }),
    [theme],
  );

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {!granted && (
        <TouchableOpacity style={styles.settingsButton} onPress={onPress}>
          <Text style={styles.settingsButtonText}>הגדר</Text>
        </TouchableOpacity>
      )}
      <View style={styles.rowContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={[
              styles.dot,
              { backgroundColor: granted ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function BackgroundServiceSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        content: { padding: 20, gap: 16 },
        statusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        },
        statusDot: { width: 10, height: 10, borderRadius: 5 },
        statusText: {
          fontSize: 16,
          fontWeight: '600',
          writingDirection: 'rtl',
          textAlign: 'right',
        },
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
        permissionsCard: {
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 16,
        },
        permissionsTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 8,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: 12,
        },
        buttonPrimary: {
          flex: 1,
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
        buttonDanger: {
          flex: 1,
          backgroundColor: '#F4433615',
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
        },
        buttonDangerText: {
          color: '#F44336',
          fontSize: 16,
          fontWeight: '600',
          writingDirection: 'rtl',
        },
        buttonDisabled: {
          flex: 1,
          backgroundColor: theme.surfaceVariant,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
        },
        buttonDisabledText: {
          color: theme.textTertiary,
          fontSize: 16,
          fontWeight: '600',
          writingDirection: 'rtl',
        },
        batteryHintCard: {
          backgroundColor: '#FFF3E0',
          borderRadius: 14,
          padding: 16,
          gap: 8,
        },
        batteryHintText: {
          fontSize: 13,
          color: '#E65100',
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 20,
        },
        batteryHintButton: {
          backgroundColor: '#FF980020',
          borderRadius: 8,
          paddingVertical: 8,
          alignItems: 'center',
        },
        batteryHintButtonText: {
          color: '#E65100',
          fontSize: 13,
          fontWeight: '600',
          writingDirection: 'rtl',
        },
        hint: {
          fontSize: 12,
          color: theme.textTertiary,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 18,
        },
      }),
    [theme],
  );

  const { backgroundServiceState } = useDabriStore();
  const [permissions, setPermissions] = useState<PermissionStatus>({
    overlayGranted: false,
    notificationsGranted: false,
    microphoneGranted: false,
  });

  const allPermissionsGranted =
    permissions.overlayGranted &&
    permissions.notificationsGranted &&
    permissions.microphoneGranted;

  const isRunning = backgroundServiceState === 'running' ||
    backgroundServiceState === 'listening' ||
    backgroundServiceState === 'processing' ||
    backgroundServiceState === 'speaking';
  const isPaused = backgroundServiceState === 'paused';
  const isStopped = backgroundServiceState === 'stopped';

  const checkPermissions = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      const status = await BackgroundServiceBridge.checkAllPermissions();
      setPermissions(status);
    } catch (e) {
      console.log('[BackgroundServiceSettings] Permission check error:', e);
    }
  }, []);

  useEffect(() => {
    checkPermissions();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPermissions();
      }
    });

    return () => subscription.remove();
  }, [checkPermissions]);

  const handleStart = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      await BackgroundServiceBridge.startService();
    } catch (e: any) {
      ToastAndroid.show(
        e?.code === 'OVERLAY_PERMISSION_REQUIRED'
          ? 'יש לאשר הרשאת תצוגה מעל אפליקציות'
          : 'שגיאה בהפעלת השירות',
        ToastAndroid.SHORT,
      );
    }
  }, []);

  const handleStop = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      await BackgroundServiceBridge.stopService();
    } catch (e) {
      console.log('[BackgroundServiceSettings] Stop error:', e);
    }
  }, []);

  const handlePause = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      await BackgroundServiceBridge.pauseService();
    } catch (e) {
      console.log('[BackgroundServiceSettings] Pause error:', e);
    }
  }, []);

  const handleResume = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      await BackgroundServiceBridge.resumeService();
    } catch (e) {
      console.log('[BackgroundServiceSettings] Resume error:', e);
    }
  }, []);

  const openOverlaySettings = useCallback(async () => {
    if (!BackgroundServiceBridge) return;
    try {
      await BackgroundServiceBridge.requestOverlayPermission();
    } catch {
      ToastAndroid.show('לא ניתן לפתוח הגדרות', ToastAndroid.SHORT);
    }
  }, []);

  const openAppSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      ToastAndroid.show('לא ניתן לפתוח הגדרות', ToastAndroid.SHORT);
    }
  }, []);

  const openBatterySettings = useCallback(async () => {
    try {
      await Linking.sendIntent('android.settings.BATTERY_SAVER_SETTINGS');
    } catch {
      try {
        await Linking.sendIntent('android.settings.SETTINGS');
      } catch {
        ToastAndroid.show('לא ניתן לפתוח הגדרות', ToastAndroid.SHORT);
      }
    }
  }, []);

  const getStatusColor = () => {
    if (isRunning) return '#4CAF50';
    if (isPaused) return '#FF9800';
    return '#9E9E9E';
  };

  const getStatusText = () => {
    if (isRunning) return 'שירות פעיל';
    if (isPaused) return 'שירות מושהה';
    return 'שירות כבוי';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status */}
      <View style={styles.statusRow}>
        <View
          style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
        />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Explanation */}
      <View style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>מה זה שירות רקע?</Text>
        <Text style={styles.benefitBody}>
          הפעל את דברי כשירות רקע כדי לגשת לעוזרת הקולית שלך מכל מקום, בכל
          זמן. אייקון קטן יופיע על המסך ותוכל לדבר עם דברי בלי לפתוח את
          האפליקציה.
        </Text>
      </View>

      {/* Permissions */}
      <View style={styles.permissionsCard}>
        <Text style={styles.permissionsTitle}>הרשאות נדרשות</Text>
        <PermissionRow
          label="תצוגה מעל אפליקציות"
          description="נדרש להצגת הבועה הצפה על המסך"
          granted={permissions.overlayGranted}
          onPress={openOverlaySettings}
          theme={theme}
        />
        <PermissionRow
          label="התראות"
          description="נדרש להצגת התראה שדברי פועלת ברקע"
          granted={permissions.notificationsGranted}
          onPress={openAppSettings}
          theme={theme}
        />
        <PermissionRow
          label="מיקרופון"
          description="נדרש להאזנה לפקודות קוליות"
          granted={permissions.microphoneGranted}
          onPress={openAppSettings}
          theme={theme}
        />
      </View>

      {/* Action buttons */}
      {isStopped && allPermissionsGranted && (
        <TouchableOpacity style={styles.buttonPrimary} onPress={handleStart}>
          <Text style={styles.buttonPrimaryText}>הפעל שירות רקע</Text>
        </TouchableOpacity>
      )}

      {isStopped && !allPermissionsGranted && (
        <View style={styles.buttonDisabled}>
          <Text style={styles.buttonDisabledText}>הפעל שירות רקע</Text>
        </View>
      )}

      {isRunning && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.buttonDanger} onPress={handleStop}>
            <Text style={styles.buttonDangerText}>כבה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonPrimary} onPress={handlePause}>
            <Text style={styles.buttonPrimaryText}>השהה</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPaused && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.buttonDanger} onPress={handleStop}>
            <Text style={styles.buttonDangerText}>כבה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleResume}>
            <Text style={styles.buttonPrimaryText}>המשך</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Battery optimization hint */}
      <View style={styles.batteryHintCard}>
        <Text style={styles.batteryHintText}>
          אם השירות נעצר באופן אוטומטי, ודא שדברי לא מוגבלת בהגדרות הסוללה
          של המכשיר. הוסף את דברי לרשימת האפליקציות שלא יוגבלו ברקע.
        </Text>
        <TouchableOpacity
          style={styles.batteryHintButton}
          onPress={openBatterySettings}
        >
          <Text style={styles.batteryHintButtonText}>פתח הגדרות סוללה</Text>
        </TouchableOpacity>
      </View>

      {/* How to stop */}
      <Text style={styles.hint}>
        ניתן לכבות את השירות מההתראה, ממסך ההגדרות, או מהמסך הראשי של דברי.
      </Text>
    </ScrollView>
  );
}
