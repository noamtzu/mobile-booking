import type { Service } from '@booking/shared';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { AppText, Card } from '@/components/ui';
import { formatDuration, formatPrice } from '@/lib/format';
import { useServices } from '@/lib/queries';
import { spacing, useColors } from '@/theme/colors';

export default function ServicesScreen() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useServices();

  if (isPending) return <LoadingState label="Loading services" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (data.length === 0) {
    return <EmptyState title="No services yet" message="Check back soon. New sessions are added every week." />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListHeaderComponent={<AppText variant="muted">Pick a service to see open times.</AppText>}
      renderItem={({ item }) => <ServiceCard service={item} onPress={() => router.push(`/service/${item.id}`)} />}
    />
  );
}

function ServiceCard({ service, onPress }: { service: Service; onPress: () => void }) {
  const c = useColors();
  const summary = `${formatDuration(service.durationMinutes)} · ${formatPrice(service.priceCents)}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${summary}`}
      accessibilityHint="Shows available times"
    >
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.85 : 1 }}>
          <View style={styles.row}>
            <AppText variant="heading" style={styles.flex}>
              {service.name}
            </AppText>
            <AppText style={{ color: c.primary, fontWeight: '600' }}>{formatPrice(service.priceCents)}</AppText>
          </View>
          {service.description ? <AppText variant="muted">{service.description}</AppText> : null}
          <AppText variant="small">{formatDuration(service.durationMinutes)}</AppText>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
