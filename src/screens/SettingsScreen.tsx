import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useDabriStore } from '../store';
import AssistantBridge from '../native/AssistantBridge';
import { SPEED_OPTIONS } from './VoiceSpeedSettingsScreen';
import { RootStackParamList } from '../../App';

interface SettingsRowProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  dotColor?: string;
}

function SettingsRow({ title, subtitle, onPress, dotColor }: SettingsRowProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Left: chevron */}
      <Text style={styles.chevron}>{'<'}</Text>

      {/* Right: content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTitleLine}>
          {dotColor ? (
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
          ) : null}
          <Text style={styles.rowTitle}>{title}</Text>
        </View>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { geminiApiKey, ttsSpeed } = useDabriStore();
  const [isDefaultAssistant, setIsDefaultAssistant] = useState(false);

  const checkAssistantStatus = async () => {
    if (!AssistantBridge) { return; }
    try {
      const isDefault = await AssistantBridge.isDefaultAssistant();
      setIsDefaultAssistant(isDefault);
    } catch (e) {
      console.log('Error checking assistant status:', e);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SettingsRow
        title="עוזרת ברירת מחדל"
        subtitle={isDefaultAssistant ? 'פעיל' : 'לא פעיל'}
        dotColor={isDefaultAssistant ? '#4CAF50' : '#F44336'}
        onPress={() => navigation.navigate('AssistantSettings')}
      />
      <SettingsRow
        title="מפתח API"
        subtitle={geminiApiKey ? 'פעיל' : 'לא מוגדר'}
        onPress={() => navigation.navigate('ApiKeySettings')}
      />
      <SettingsRow
        title="מהירות דיבור"
        subtitle={SPEED_OPTIONS.find(o => o.value === ttsSpeed)?.label ?? ttsSpeed.toFixed(1)}
        onPress={() => navigation.navigate('VoiceSpeedSettings')}
      />
      <SettingsRow
        title="אודות"
        subtitle="1.0.0"
        onPress={() => navigation.navigate('About')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingTop: 8,
  },
  row: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chevron: {
    fontSize: 16,
    color: '#aaa',
    marginLeft: 4,
  },
  rowContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666666',
    writingDirection: 'rtl',
    textAlign: 'right',
    marginTop: 2,
  },
});
