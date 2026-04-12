import React from 'react';
import { I18nManager, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AssistantSettingsScreen } from './src/screens/AssistantSettingsScreen';
import { ApiKeySettingsScreen } from './src/screens/ApiKeySettingsScreen';
import { VoiceSpeedSettingsScreen } from './src/screens/VoiceSpeedSettingsScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { SilenceTimeoutSettingsScreen } from './src/screens/SilenceTimeoutSettingsScreen';
import { initializeServices } from './src/services';
import { useDabriStore } from './src/store';
import { lightTheme, darkTheme } from './src/utils/theme';

// Force RTL for Hebrew UI
if(!I18nManager.isRTL) {
    I18nManager.forceRTL(true);
    I18nManager.allowRTL(true);
}
// Initialize all action handlers and native listeners
initializeServices();

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  AssistantSettings: undefined;
  ApiKeySettings: undefined;
  VoiceSpeedSettings: undefined;
  Reminders: undefined;
  SilenceTimeoutSettings: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HamburgerIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={{ justifyContent: 'center', gap: 4 }}>
      <View style={{ width: 18, height: 2, backgroundColor: color }} />
      <View style={{ width: 18, height: 2, backgroundColor: color }} />
      <View style={{ width: 18, height: 2, backgroundColor: color }} />
    </View>
  );
}

function App(): React.JSX.Element {
  const { isDarkMode, setDarkMode } = useDabriStore();
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerBackTitle: 'חזרה',
            headerStyle: { backgroundColor: theme.headerBackground },
            headerTintColor: theme.headerText,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              headerTitle: '',
              headerRight: () => (
                <TouchableOpacity
                  testID="settings-button"
                  onPress={() => navigation.navigate('Settings')}
                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <HamburgerIcon color={theme.text} />
                </TouchableOpacity>
              ),
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => setDarkMode(!isDarkMode)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: theme.text,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    {isDarkMode && (
                      <View style={{
                        width: 7,
                        height: 7,
                        borderRadius: 3.5,
                        backgroundColor: theme.text,
                      }} />
                    )}
                  </View>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerTitle: 'הגדרות' }}
          />
          <Stack.Screen
            name="AssistantSettings"
            component={AssistantSettingsScreen}
            options={{ headerTitle: 'עוזרת ברירת מחדל' }}
          />
          <Stack.Screen
            name="ApiKeySettings"
            component={ApiKeySettingsScreen}
            options={{ headerTitle: 'מפתח API' }}
          />
          <Stack.Screen
            name="VoiceSpeedSettings"
            component={VoiceSpeedSettingsScreen}
            options={{ headerTitle: 'מהירות דיבור' }}
          />
          <Stack.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{ headerTitle: 'תזכורות' }}
          />
          <Stack.Screen
            name="SilenceTimeoutSettings"
            component={SilenceTimeoutSettingsScreen}
            options={{ headerTitle: 'זמן שתיקה לעצירה' }}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{ headerTitle: 'אודות' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
