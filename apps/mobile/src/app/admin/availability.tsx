import {
  type AvailabilityInput,
  availabilityInputSchema,
  formatLocalDate,
  formatLocalTime,
  localDayKey,
} from '@booking/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNow, useTimeZone } from '@/lib/clock';
import { ErrorState, LoadingState } from '@/components/states';
import { AppText, Banner, Button, Card, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAddAvailability, useDeleteSlot, useSlots } from '@/lib/queries';
import { radius, spacing, useColors } from '@/theme/colors';

const TIME_OPTIONS = Array.from({ length: 27 }, (_, i) => {
  const minutes = 7 * 60 + i * 30; // 07:00 to 20:00
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export default function AvailabilityScreen() {
  const { serviceId = '', name } = useLocalSearchParams<{ serviceId: string; name?: string }>();
  const c = useColors();
  const zone = useTimeZone();
  const now = useNow();
  const tomorrow = localDayKey(new Date(now + 86_400_000).toISOString(), zone);

  const slots = useSlots(serviceId);
  const add = useAddAvailability();
  const remove = useDeleteSlot(serviceId);

  const { control, handleSubmit, formState, setValue } = useForm<AvailabilityInput>({
    resolver: zodResolver(availabilityInputSchema),
    defaultValues: { serviceId, date: tomorrow, times: [], timeZone: zone },
  });

  const onSubmit = handleSubmit((v) => add.mutate(v, { onSuccess: () => setValue('times', []) }));

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: name ? `${name}` : 'Availability' }} />
      <Card style={styles.form}>
        <AppText variant="heading" accessibilityRole="header">
          Add open times
        </AppText>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <TextField label="Date" hint="YYYY-MM-DD" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.date?.message} />
          )}
        />
        <Controller
          control={control}
          name="timeZone"
          render={({ field }) => (
            <TextField
              label="Time zone"
              hint="The zone you work in. Times are saved in UTC and shown to each customer in theirs."
              autoCapitalize="none"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.timeZone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="times"
          render={({ field }) => (
            <View style={styles.timesBlock}>
              <AppText style={styles.label}>Start times</AppText>
              <View style={styles.grid} accessibilityRole="list">
                {TIME_OPTIONS.map((t) => {
                  const on = field.value.includes(t);
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t}
                      onPress={() => field.onChange(on ? field.value.filter((x) => x !== t) : [...field.value, t].sort())}
                      style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
                    >
                      <AppText style={{ color: on ? c.onPrimary : c.text, fontWeight: '600' }}>{t}</AppText>
                    </Pressable>
                  );
                })}
              </View>
              {formState.errors.times ? (
                <AppText accessibilityRole="alert" style={{ color: c.danger }}>
                  {formState.errors.times.message}
                </AppText>
              ) : null}
            </View>
          )}
        />
        {add.isError ? <Banner tone="error">{errorMessage(add.error)}</Banner> : null}
        {add.isSuccess ? <Banner tone="success">Added {add.data.length} open times.</Banner> : null}
        <Button label="Add times" busy={add.isPending} onPress={() => void onSubmit()} />
      </Card>

      <AppText variant="heading" accessibilityRole="header">
        Upcoming slots
      </AppText>
      {slots.isPending ? (
        <LoadingState />
      ) : slots.isError ? (
        <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
      ) : slots.data.length === 0 ? (
        <AppText variant="muted">No upcoming slots.</AppText>
      ) : (
        slots.data.map((slot) => {
          const when = `${formatLocalDate(slot.startsAt, zone)} · ${formatLocalTime(slot.startsAt, zone)}`;
          return (
            <Card key={slot.id} style={styles.slotRow}>
              <View style={styles.flex}>
                <AppText>{when}</AppText>
                <AppText variant="small">{slot.available ? 'Open' : 'Booked'}</AppText>
              </View>
              {slot.available ? (
                <Button
                  label="Remove"
                  variant="danger"
                  compact
                  busy={remove.isPending && remove.variables === slot.id}
                  accessibilityLabel={`Remove ${when}`}
                  onPress={() => remove.mutate(slot.id)}
                />
              ) : null}
            </Card>
          );
        })
      )}
      {remove.isError ? <Banner tone="error">{errorMessage(remove.error)}</Banner> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  form: { gap: spacing.lg },
  label: { fontWeight: '600' },
  timesBlock: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minWidth: 72, minHeight: 40, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
