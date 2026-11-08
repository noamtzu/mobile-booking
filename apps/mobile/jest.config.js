/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@booking/.*)',
  ],
};
