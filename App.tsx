import React from 'react';
import { I18nManager, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AssistantSettingsScreen } from './src/screens/AssistantSettingsScreen';
import { ApiKeySettingsScreen } from './src/screens/ApiKeySettingsScreen';
import { VoiceSpeedSettingsScreen } from './src/screens/VoiceSpeedSettingsScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { initializeServices } from './src/services';

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
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HamburgerIcon(): React.JSX.Element {
  return (
    <View style={{ justifyContent: 'center', gap: 4 }}>
      <View style={{ width: 18, height: 2, backgroundColor: '#666' }} />
      <View style={{ width: 18, height: 2, backgroundColor: '#666' }} />
      <View style={{ width: 18, height: 2, backgroundColor: '#666' }} />
    </View>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ headerBackTitle: 'חזרה' }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              headerTitle: '',
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Settings')}
                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <HamburgerIcon />
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
