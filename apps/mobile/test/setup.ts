import { useLocalSearchParams } from './expo-router-mock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must use require
jest.mock('expo-router', () => require('./expo-router-mock'));

// jest-expo 58 has no native mock for Switch on RN 0.88. A host element keeps its
// props (label, value, onValueChange), which is all the tests need.
jest.mock('react-native/Libraries/Components/Switch/Switch', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: (props: object) => createElement('RCTSwitch', props) };
});

// Screens talk to the API only through `api`; tests replace each call.
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: {
      requestCode: jest.fn(),
      verifyCode: jest.fn(),
      me: jest.fn(),
      services: jest.fn(),
      service: jest.fn(),
      slots: jest.fn(),
      bookings: jest.fn(),
      booking: jest.fn(),
      book: jest.fn(),
      cancel: jest.fn(),
      admin: {
        services: jest.fn(),
        createService: jest.fn(),
        updateService: jest.fn(),
        addAvailability: jest.fn(),
        deleteSlot: jest.fn(),
      },
    },
  };
});

jest.mock('@/lib/notifications', () => ({
  REMINDER_MINUTES_BEFORE: 60,
  configureNotifications: jest.fn(),
  scheduleBookingReminder: jest.fn(),
  cancelBookingReminder: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  // Reset implementations too, so a queued mockResolvedValueOnce never leaks into the next test.
  jest.resetAllMocks();
  useLocalSearchParams.mockReturnValue({});
});
