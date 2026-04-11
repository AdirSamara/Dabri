import React, { useState, useEffect } from 'react';
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

export function AssistantSettingsScreen(): React.JSX.Element {
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

  const handleSetAsDefault = async () => {
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

      {!isDefaultAssistant && (
        <TouchableOpacity style={styles.button} onPress={handleSetAsDefault}>
          <Text style={styles.buttonText}>הגדר כעוזרת ברירת מחדל</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.description}>
        {isDefaultAssistant
          ? 'לחץ לחיצה ארוכה על כפתור הבית כדי להפעיל את דברי מכל מקום'
          : 'לחיצה ארוכה על כפתור הבית תפעיל את דברי אוטומטית'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  unavailableText: {
    fontSize: 16,
    color: '#666666',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  description: {
    fontSize: 13,
    color: '#666666',
    writingDirection: 'rtl',
    textAlign: 'right',
    lineHeight: 20,
  },
});
