import type { Service } from '@booking/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { AppText, Banner, Button, Card, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatPrice } from '@/lib/format';
import { type ServiceFormIn, type ServiceFormOut, serviceFormSchema } from '@/lib/forms';
import { useAdminServices, useSaveService } from '@/lib/queries';
import { spacing, useColors } from '@/theme/colors';

export default function AdminScreen() {
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'admin';
  const services = useAdminServices(isAdmin);

  if (!isAdmin) {
    return <EmptyState title="Admins only" message="This area is for the business owner." />;
  }
  if (services.isPending) return <LoadingState label="Loading services" />;
  if (services.isError) return <ErrorState error={services.error} onRetry={() => void services.refetch()} />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="heading" accessibilityRole="header">
        Services
      </AppText>
      {services.data.length === 0 ? (
        <AppText variant="muted">No services yet. Add your first one below.</AppText>
      ) : (
        services.data.map((s) => <AdminServiceRow key={s.id} service={s} />)
      )}
      <NewServiceForm />
    </ScrollView>
  );
}

function AdminServiceRow({ service }: { service: Service }) {
  const router = useRouter();
  const save = useSaveService();
  const c = useColors();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="heading">{service.name}</AppText>
          <AppText variant="muted">
            {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
          </AppText>
        </View>
        <Switch
          value={service.active}
          onValueChange={(active) => save.mutate({ id: service.id, input: { active } })}
          disabled={save.isPending}
          accessibilityLabel={`${service.name} visible to customers`}
          trackColor={{ true: c.primary, false: c.border }}
        />
      </View>
      {save.isError ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
      <Button
        label="Manage availability"
        variant="secondary"
        compact
        accessibilityLabel={`Manage availability for ${service.name}`}
        onPress={() => router.push({ pathname: '/admin/availability', params: { serviceId: service.id, name: service.name } })}
      />
    </Card>
  );
}

function NewServiceForm() {
  const save = useSaveService();
  const { control, handleSubmit, reset, formState } = useForm<ServiceFormIn, unknown, ServiceFormOut>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: { name: '', description: '', duration: '60', price: '' },
  });

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { input: { name: v.name, description: v.description, durationMinutes: v.duration, priceCents: v.price } },
      { onSuccess: () => reset() },
    ),
  );

  return (
    <Card style={styles.form}>
      <AppText variant="heading" accessibilityRole="header">
        New service
      </AppText>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField label="Name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.name?.message} />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField label="Description" multiline value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.description?.message} />
        )}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="duration"
            render={({ field }) => (
              <TextField label="Minutes" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.duration?.message} />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="price"
            render={({ field }) => (
              <TextField label="Price (USD)" keyboardType="decimal-pad" placeholder="0 for free" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.price?.message} />
            )}
          />
        </View>
      </View>
      {save.isError ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
      {save.isSuccess ? <Banner tone="success">Saved.</Banner> : null}
      <Button label="Add service" busy={save.isPending} onPress={() => void onSubmit()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
});
