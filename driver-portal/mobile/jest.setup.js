require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => ({
    getToken: jest.fn().mockResolvedValue('mock-fcm-token-12345678901234567890'),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    deleteToken: jest.fn().mockResolvedValue(undefined),
  }));
  return { __esModule: true, default: messaging };
});
