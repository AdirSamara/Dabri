// Global mocks for React Native NativeModules
const { NativeModules } = require('react-native');

// SMS Module
NativeModules.SmsModule = {
  readInbox: jest.fn().mockResolvedValue([]),
  sendSms: jest.fn().mockResolvedValue(true),
};

// Phone Module
NativeModules.PhoneModule = {
  directCall: jest.fn().mockResolvedValue(true),
};

// Assistant Module
NativeModules.AssistantModule = {
  isDefaultAssistant: jest.fn().mockResolvedValue(false),
  openAssistantSettings: jest.fn().mockResolvedValue(true),
  wasLaunchedFromAssist: jest.fn().mockResolvedValue(false),
};

// Reminder Module
NativeModules.ReminderModule = {
  createNotificationChannel: jest.fn().mockResolvedValue(true),
  checkPermissions: jest.fn().mockResolvedValue({
    canScheduleExact: true,
    canPostNotifications: true,
  }),
  requestExactAlarmPermission: jest.fn().mockResolvedValue(true),
  requestNotificationPermission: jest.fn().mockResolvedValue(true),
  scheduleReminder: jest.fn().mockResolvedValue(true),
  cancelReminder: jest.fn().mockResolvedValue(true),
  snoozeReminder: jest.fn().mockResolvedValue(true),
  getDebugState: jest.fn().mockResolvedValue(null),
};

// NotificationBridge (not yet implemented natively)
NativeModules.NotificationBridge = {
  getRecentNotifications: jest.fn().mockResolvedValue([]),
  isListenerEnabled: jest.fn().mockResolvedValue(false),
  openNotificationListenerSettings: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// Set Platform.OS to 'android' since Dabri is Android-only
const { Platform } = require('react-native');
Platform.OS = 'android';

// Mock NativePermissionsAndroid (needed when Platform.OS='android' and PermissionsAndroid.request is called)
NativeModules.PermissionsAndroid = {
  requestPermission: jest.fn().mockResolvedValue('granted'),
  shouldShowRequestPermissionRationale: jest.fn().mockResolvedValue(false),
  checkPermission: jest.fn().mockResolvedValue(true),
  requestMultiplePermissions: jest.fn().mockResolvedValue({}),
};

// Mock Linking.openURL
const { Linking } = require('react-native');
if (Linking) {
  Linking.openURL = jest.fn().mockResolvedValue(undefined);
}

// Silence console.log in tests to reduce noise
jest.spyOn(console, 'log').mockImplementation(() => {});
