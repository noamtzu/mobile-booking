import { type Slot, formatLocalDate, formatLocalTime } from '@booking/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimeZone } from '@/lib/clock';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { AppText, Banner, Button } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDuration, formatPrice } from '@/lib/format';
import { useBookSlot, useService, useSlots } from '@/lib/queries';
import { groupSlotsByDay } from '@/lib/slots';
import { radius, spacing, useColors } from '@/theme/colors';

export default function ServiceSlotsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const timeZone = useTimeZone();

  const service = useService(id);
  const slots = useSlots(id);
  const book = useBookSlot(id);
  const [selected, setSelected] = useState<Slot | null>(null);

  const days = useMemo(() => groupSlotsByDay(slots.data ?? [], timeZone), [slots.data, timeZone]);

  if (service.isPending || slots.isPending) return <LoadingState label="Loading times" />;
  if (service.isError || slots.isError) {
    return (
      <ErrorState
        error={service.error ?? slots.error}
        onRetry={() => {
          void service.refetch();
          void slots.refetch();
        }}
      />
    );
  }

  const openCount = slots.data.filter((s) => s.available).length;
  const taken = book.error instanceof ApiError && book.error.code === 'SLOT_TAKEN';

  const onBook = () => {
    if (!selected) return;
    book.mutate(selected.id, {
      onSuccess: (booking) => router.replace(`/booking/${booking.id}`),
      onError: () => setSelected(null),
    });
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: service.data.name }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={slots.isRefetching} onRefresh={() => void slots.refetch()} />}
      >
        <View style={styles.header}>
          <AppText variant="muted">
            {formatDuration(service.data.durationMinutes)} · {formatPrice(service.data.priceCents)}
          </AppText>
          {service.data.description ? <AppText>{service.data.description}</AppText> : null}
        </View>

        {book.isError ? (
          <Banner tone="error">{taken ? 'Someone just booked that time. Please pick another.' : errorMessage(book.error)}</Banner>
        ) : null}

        {openCount === 0 ? (
          <EmptyState title="No open times" message="All times for this service are booked. Pull down to refresh." />
        ) : (
          days.map((day) => (
            <View key={day.key} style={styles.day}>
              <AppText variant="heading" accessibilityRole="header">
                {day.label}
              </AppText>
              <View style={styles.grid}>
                {day.slots.map((slot) => (
                  <SlotChip
                    key={slot.id}
                    slot={slot}
                    timeZone={timeZone}
                    selected={selected?.id === slot.id}
                    onPress={() => setSelected(slot)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
        <AppText variant="small">Times are shown in your time zone ({timeZone}).</AppText>
      </ScrollView>

      {selected ? (
        <View style={[styles.footer, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText style={styles.flex} accessibilityLiveRegion="polite">
            {formatLocalDate(selected.startsAt, timeZone)}, {formatLocalTime(selected.startsAt, timeZone)}
          </AppText>
          <Button label="Book this time" busy={book.isPending} onPress={onBook} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SlotChip({
  slot,
  timeZone,
  selected,
  onPress,
}: {
  slot: Slot;
  timeZone: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const time = formatLocalTime(slot.startsAt, timeZone);
  const disabled = !slot.available;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${time}, booked` : time}
      accessibilityState={{ disabled, selected }}
      style={[
        styles.chip,
        {
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.primary : disabled ? 'transparent' : c.surface,
        },
      ]}
    >
      <AppText
        style={{
          color: selected ? c.onPrimary : disabled ? c.textMuted : c.text,
          textDecorationLine: disabled ? 'line-through' : 'none',
          fontWeight: '600',
        }}
      >
        {time}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },
  day: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minWidth: 96, minHeight: 44, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
