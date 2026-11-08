import { deviceTimeZone } from '@booking/shared';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet } from 'react-native';
import { AppText, Button, Card } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme/colors';

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <AppText variant="small">Signed in as</AppText>
        <AppText variant="heading">{session?.user.email}</AppText>
        <AppText variant="muted">{session?.user.role === 'admin' ? 'Admin' : 'Customer'}</AppText>
      </Card>
      <Card>
        <AppText variant="small">Time zone</AppText>
        <AppText>{deviceTimeZone()}</AppText>
        <AppText variant="small">All times in the app are shown in this zone.</AppText>
      </Card>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      <AppText variant="small" style={styles.footer}>
        Version {Constants.expoConfig?.version ?? '1.0.0'} · API {API_URL}
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  footer: { textAlign: 'center', marginTop: spacing.lg },
});
