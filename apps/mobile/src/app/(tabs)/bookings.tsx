import { type Booking, formatLocalDate, formatLocalTime } from '@booking/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useNow, useTimeZone } from '@/lib/clock';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { AppText, Banner, Button, Card } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { cancelBookingReminder } from '@/lib/notifications';
import { useBookings, useCancelBooking } from '@/lib/queries';
import { spacing, useColors } from '@/theme/colors';

export default function BookingsScreen() {
  const router = useRouter();
  const timeZone = useTimeZone();
  const { data, isPending, isError, error, refetch, isRefetching } = useBookings();
  const cancel = useCancelBooking();

  const now = useNow();
  const sections = useMemo(() => {
    const all = data ?? [];
    const upcoming = all.filter((b) => b.status === 'confirmed' && Date.parse(b.slot.startsAt) > now);
    const history = all
      .filter((b) => !upcoming.includes(b))
      .sort((a, b) => Date.parse(b.slot.startsAt) - Date.parse(a.slot.startsAt));
    return [
      { title: 'Upcoming', data: upcoming },
      { title: 'Past and cancelled', data: history },
    ].filter((s) => s.data.length > 0);
  }, [data, now]);

  if (isPending) return <LoadingState label="Loading bookings" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (sections.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        message="When you book a session it will show up here."
        action={{ label: 'Browse services', onPress: () => router.navigate('/') }}
      />
    );
  }

  const onCancel = async (booking: Booking) => {
    const ok = await confirmAction(
      'Cancel this booking?',
      `${booking.service.name} on ${formatLocalDate(booking.slot.startsAt, timeZone)} at ${formatLocalTime(booking.slot.startsAt, timeZone)}`,
      'Cancel booking',
    );
    if (!ok) return;
    cancel.mutate(booking.id, { onSuccess: () => void cancelBookingReminder(booking.id) });
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListHeaderComponent={cancel.isError ? <Banner tone="error">{errorMessage(cancel.error)}</Banner> : undefined}
      renderSectionHeader={({ section }) => (
        <AppText variant="heading" accessibilityRole="header" style={styles.sectionHeader}>
          {section.title}
        </AppText>
      )}
      renderItem={({ item }) => (
        <BookingRow
          booking={item}
          timeZone={timeZone}
          now={now}
          cancelling={cancel.isPending && cancel.variables === item.id}
          onCancel={() => void onCancel(item)}
          onOpen={() => router.push(`/booking/${item.id}`)}
        />
      )}
    />
  );
}

function BookingRow({
  booking,
  timeZone,
  now,
  cancelling,
  onCancel,
  onOpen,
}: {
  booking: Booking;
  timeZone: string;
  now: number;
  cancelling: boolean;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const c = useColors();
  const upcoming = booking.status === 'confirmed' && Date.parse(booking.slot.startsAt) > now;
  const when = `${formatLocalDate(booking.slot.startsAt, timeZone)} · ${formatLocalTime(booking.slot.startsAt, timeZone)}`;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <AppText variant="heading" style={styles.flex}>
          {booking.service.name}
        </AppText>
        {booking.status === 'cancelled' ? <AppText style={{ color: c.danger }}>Cancelled</AppText> : null}
      </View>
      <AppText variant="muted">{when}</AppText>
      <View style={styles.actions}>
        <Button label="Details" variant="secondary" compact onPress={onOpen} accessibilityLabel={`Details for ${booking.service.name}, ${when}`} />
        {upcoming ? (
          <Button
            label="Cancel"
            variant="danger"
            compact
            busy={cancelling}
            onPress={onCancel}
            accessibilityLabel={`Cancel ${booking.service.name}, ${when}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  sectionHeader: { marginTop: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
