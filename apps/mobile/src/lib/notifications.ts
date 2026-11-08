import type { Booking } from '@booking/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local reminders only. Push (server-sent) notifications need a development
 * build plus an APNs/FCM setup and are out of scope for this demo; the call
 * sites would stay the same.
 */
const CHANNEL_ID = 'reminders';
export const REMINDER_MINUTES_BEFORE = 60;

export type ReminderResult = 'scheduled' | 'denied' | 'too-late' | 'unsupported';

let configured = false;

export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Booking reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleBookingReminder(
  booking: Booking,
  now: Date = new Date(),
): Promise<ReminderResult> {
  if (Platform.OS === 'web') return 'unsupported';
  const fireAt = new Date(Date.parse(booking.slot.startsAt) - REMINDER_MINUTES_BEFORE * 60_000);
  if (fireAt <= now) return 'too-late';
  if (!(await ensurePermission())) return 'denied';

  await Notifications.scheduleNotificationAsync({
    identifier: `booking-${booking.id}`,
    content: {
      title: `${booking.service.name} in 1 hour`,
      body: 'Tap to see the details of your booking.',
      data: { url: `/booking/${booking.id}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
  return 'scheduled';
}

export async function cancelBookingReminder(bookingId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(`booking-${bookingId}`);
}
