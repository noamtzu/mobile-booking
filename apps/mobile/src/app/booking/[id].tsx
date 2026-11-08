import { formatLocalDate, formatLocalTime } from '@booking/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTimeZone } from '@/lib/clock';
import { ErrorState, LoadingState } from '@/components/states';
import { AppText, Banner, Button, Card } from '@/components/ui';
import { formatDuration, formatPrice } from '@/lib/format';
import { type ReminderResult, scheduleBookingReminder } from '@/lib/notifications';
import { useBooking } from '@/lib/queries';
import { radius, spacing, useColors } from '@/theme/colors';

const reminderCopy: Record<ReminderResult, { tone: 'success' | 'info' | 'error'; text: string }> = {
  scheduled: { tone: 'success', text: "Reminder set. We'll notify you 1 hour before." },
  denied: { tone: 'error', text: 'Notifications are turned off for this app. You can enable them in Settings.' },
  'too-late': { tone: 'info', text: 'This starts in less than an hour, so no reminder is needed.' },
  unsupported: { tone: 'info', text: 'Reminders are available in the iOS and Android apps.' },
};

export default function BookingConfirmationScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const timeZone = useTimeZone();
  const { data: booking, isPending, isError, error, refetch } = useBooking(id);
  const [reminder, setReminder] = useState<ReminderResult | null>(null);
  const [scheduling, setScheduling] = useState(false);

  if (isPending) return <LoadingState label="Loading booking" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const confirmed = booking.status === 'confirmed';

  const onRemind = async () => {
    setScheduling(true);
    try {
      setReminder(await scheduleBookingReminder(booking));
    } finally {
      setScheduling(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: confirmed ? c.successSoft : c.dangerSoft }]}>
          <AppText style={{ color: confirmed ? c.success : c.danger, fontSize: 32 }} importantForAccessibility="no">
            {confirmed ? '✓' : '✕'}
          </AppText>
        </View>
        <AppText variant="title" accessibilityRole="header">
          {confirmed ? "You're booked" : 'Booking cancelled'}
        </AppText>
      </View>

      <Card>
        <AppText variant="heading">{booking.service.name}</AppText>
        <AppText>
          {formatLocalDate(booking.slot.startsAt, timeZone)} · {formatLocalTime(booking.slot.startsAt, timeZone)} to{' '}
          {formatLocalTime(booking.slot.endsAt, timeZone)}
        </AppText>
        <AppText variant="muted">
          {formatDuration(booking.service.durationMinutes)} · {formatPrice(booking.service.priceCents)}
        </AppText>
        <AppText variant="small">Time zone: {timeZone}</AppText>
      </Card>

      {reminder ? <Banner tone={reminderCopy[reminder].tone}>{reminderCopy[reminder].text}</Banner> : null}

      <View style={styles.actions}>
        {confirmed && reminder !== 'scheduled' ? (
          <Button label="Remind me 1 hour before" variant="secondary" busy={scheduling} onPress={onRemind} />
        ) : null}
        <Button label="Done" onPress={() => router.replace('/bookings')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  badge: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.md },
});
