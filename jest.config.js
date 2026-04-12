module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^react-native-tts$': '<rootDir>/__mocks__/react-native-tts.js',
    '^react-native-contacts$': '<rootDir>/__mocks__/react-native-contacts.js',
    '^@react-native-voice/voice$': '<rootDir>/__mocks__/@react-native-voice/voice.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    '^@react-native-community/datetimepicker$':
      '<rootDir>/__mocks__/@react-native-community/datetimepicker.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-community|zustand)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/declarations.d.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '__tests__/fixtures/'],
};
