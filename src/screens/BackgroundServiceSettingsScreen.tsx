import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  ToastAndroid,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useDabriStore } from '../store';
import DabriServiceBridge, { ServicePermissionStatus } from '../native/DabriServiceBridge';
import { useTheme } from '../utils/theme';

export function BackgroundServiceSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { isBackgroundServiceEnabled, setBackgroundServiceEnabled } = useDabriStore();

  const [permissions, setPermissions] = useState<ServicePermissionStatus | null>(null);
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const pendingOverlayResume = useRef(false);

  const checkStatus = useCallback(async () => {
    if (!DabriServiceBridge) return;
    try {
      const [perms, running] = await Promise.all([
        DabriServiceBridge.checkServicePermissions(),
        DabriServiceBridge.isServiceRunning(),
      ]);
      setPermissions(perms);
      setIsServiceRunning(running);
    } catch (e) {
      console.log('Error checking service status:', e);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await checkStatus();
        // If we were waiting for overlay permission from system settings, continue the flow
        if (pendingOverlayResume.current) {
          pendingOverlayResume.current = false;
          const perms = await DabriServiceBridge?.checkServicePermissions();
          if (perms?.overlay) {
            continueAfterOverlay();
          }
        }
      }
    });
    return () => subscription.remove();
  }, [checkStatus]);

  const continueAfterOverlay = async () => {
    if (!DabriServiceBridge) return;
    ToastAndroid.show('\u2713 \u05D4\u05E8\u05E9\u05D0\u05EA \u05D4\u05E6\u05D2\u05D4 \u05DE\u05E2\u05DC \u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D5\u05EA \u05D0\u05D5\u05E9\u05E8\u05D4', ToastAndroid.SHORT);

    // Step 3: Notifications
    const perms = await DabriServiceBridge.checkServicePermissions();
    if (!perms.notifications) {
      await DabriServiceBridge.requestNotificationPermission();
    }
    ToastAndroid.show('\u2713 \u05D4\u05E8\u05E9\u05D0\u05EA \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05D0\u05D5\u05E9\u05E8\u05D4', ToastAndroid.SHORT);

    // All good - start service
    ToastAndroid.show('\u05D0\u05DE\u05D5\u05E8 \u05D4\u05D9\u05D9 \u05D3\u05D1\u05E8\u05D9! \uD83C\uDFA4', ToastAndroid.LONG);
    await DabriServiceBridge.startService();
    setBackgroundServiceEnabled(true);
    setIsServiceRunning(true);
    await checkStatus();
  };

  const handleEnable = async () => {
    if (!DabriServiceBridge) return;

    // Step 1: Microphone
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (!micGranted) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    ToastAndroid.show('\u2713 \u05D4\u05E8\u05E9\u05D0\u05EA \u05DE\u05D9\u05E7\u05E8\u05D5\u05E4\u05D5\u05DF \u05D0\u05D5\u05E9\u05E8\u05D4', ToastAndroid.SHORT);

    // Step 2: Overlay
    const perms = await DabriServiceBridge.checkServicePermissions();
    if (!perms.overlay) {
      pendingOverlayResume.current = true;
      await DabriServiceBridge.requestOverlayPermission();
      // User needs to come back from settings - we'll recheck on resume
      return;
    }
    ToastAndroid.show('\u2713 \u05D4\u05E8\u05E9\u05D0\u05EA \u05D4\u05E6\u05D2\u05D4 \u05DE\u05E2\u05DC \u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D5\u05EA \u05D0\u05D5\u05E9\u05E8\u05D4', ToastAndroid.SHORT);

    // Step 3: Notifications
    if (!perms.notifications) {
      await DabriServiceBridge.requestNotificationPermission();
    }
    ToastAndroid.show('\u2713 \u05D4\u05E8\u05E9\u05D0\u05EA \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05D0\u05D5\u05E9\u05E8\u05D4', ToastAndroid.SHORT);

    // All good - start service
    ToastAndroid.show('\u05D0\u05DE\u05D5\u05E8 \u05D4\u05D9\u05D9 \u05D3\u05D1\u05E8\u05D9! \uD83C\uDFA4', ToastAndroid.LONG);
    await DabriServiceBridge.startService();
    setBackgroundServiceEnabled(true);
    setIsServiceRunning(true);
    await checkStatus();
  };

  const handleDisable = async () => {
    if (!DabriServiceBridge) return;
    await DabriServiceBridge.stopService();
    setBackgroundServiceEnabled(false);
    setIsServiceRunning(false);
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
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    permIcon: { fontSize: 16 },
    permLabel: {
      fontSize: 15,
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
  }), [theme]);

  if (!DabriServiceBridge) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.cardBody}>{'\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E8\u05E7\u05E2 \u05D0\u05D9\u05E0\u05D5 \u05D6\u05DE\u05D9\u05DF \u05D1\u05D2\u05E8\u05E1\u05D4 \u05D6\u05D5.'}</Text>
      </View>
    );
  }

  const permissionItems = permissions ? [
    { label: '\u05DE\u05D9\u05E7\u05E8\u05D5\u05E4\u05D5\u05DF', granted: permissions.microphone },
    { label: '\u05D4\u05E6\u05D2\u05D4 \u05DE\u05E2\u05DC \u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D5\u05EA', granted: permissions.overlay },
    { label: '\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA', granted: permissions.notifications },
  ] : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status */}
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {isServiceRunning ? '\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E8\u05E7\u05E2 \u05E4\u05E2\u05D9\u05DC' : '\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E8\u05E7\u05E2 \u05DB\u05D1\u05D5\u05D9'}
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
        onPress={isServiceRunning ? handleDisable : handleEnable}
      >
        <Text style={styles.toggleButtonText}>
          {isServiceRunning ? '\u05DB\u05D1\u05D4 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05E7\u05E2' : '\u05D4\u05E4\u05E2\u05DC \u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05E7\u05E2'}
        </Text>
      </TouchableOpacity>

      {/* Explanation Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'\u05DE\u05D4 \u05D6\u05D4 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05E7\u05E2?'}</Text>
        <Text style={styles.cardBody}>
          {'\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E8\u05E7\u05E2 \u05DE\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D3\u05D1\u05E8\u05D9 \u05DC\u05D4\u05E7\u05E9\u05D9\u05D1 \u05DC\u05DE\u05D9\u05DC\u05EA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D2\u05DD \u05DB\u05E9\u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05E1\u05D2\u05D5\u05E8\u05D4.\n\u05DB\u05E9\u05EA\u05D2\u05D9\u05D3 "\u05D4\u05D9\u05D9 \u05D3\u05D1\u05E8\u05D9", \u05D1\u05D5\u05E2\u05D4 \u05E7\u05D8\u05E0\u05D4 \u05EA\u05D5\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05DE\u05E1\u05DA \u05D5\u05EA\u05D5\u05DB\u05DC \u05DC\u05EA\u05EA \u05E4\u05E7\u05D5\u05D3\u05D5\u05EA \u05E7\u05D5\u05DC\u05D9\u05D5\u05EA.\n\n\u05D4\u05E9\u05D9\u05E8\u05D5\u05EA \u05E8\u05E5 \u05D1\u05E8\u05E7\u05E2 \u05E2\u05DD \u05E6\u05E8\u05D9\u05DB\u05EA \u05E1\u05D5\u05DC\u05DC\u05D4 \u05DE\u05D9\u05E0\u05D9\u05DE\u05DC\u05D9\u05EA.'}
        </Text>
      </View>

      {/* Permission Status */}
      {permissions && (
        <>
          <Text style={styles.sectionTitle}>{'\u05D4\u05E8\u05E9\u05D0\u05D5\u05EA'}</Text>
          {permissionItems.map((item) => (
            <View key={item.label} style={styles.permRow}>
              <Text style={styles.permLabel}>{item.label}</Text>
              <Text style={styles.permIcon}>{item.granted ? '\u2705' : '\u274C'}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
