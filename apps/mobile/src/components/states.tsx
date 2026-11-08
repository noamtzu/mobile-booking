import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { spacing, useColors } from '@/theme/colors';
import { AppText, Button } from './ui';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const c = useColors();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="muted" style={styles.text}>
        {message}
      </AppText>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <AppText variant="heading">Couldn&apos;t load this</AppText>
      <AppText variant="muted" style={styles.text}>
        {errorMessage(error)}
      </AppText>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  text: { textAlign: 'center', maxWidth: 320 },
});
