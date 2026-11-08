import { type RequestCodeInput, type VerifyCodeInput, requestCodeSchema, verifyCodeSchema } from '@booking/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing, useColors } from '@/theme/colors';

export default function SignInScreen() {
  const c = useColors();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">
              Book a session
            </AppText>
            <AppText variant="muted">
              {email ? `We sent a 6-digit code to ${email}.` : 'Sign in with your email. No password needed.'}
            </AppText>
          </View>
          {email ? (
            <CodeStep email={email} onChangeEmail={() => setEmail(null)} />
          ) : (
            <EmailStep onSent={setEmail} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const { control, handleSubmit, formState } = useForm<RequestCodeInput>({
    resolver: zodResolver(requestCodeSchema),
    defaultValues: { email: '' },
  });
  const request = useMutation({
    mutationFn: api.requestCode,
    onSuccess: (_data, input) => onSent(input.email),
  });
  const submit = () => void handleSubmit((v) => request.mutate(v))();

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={submit}
            error={formState.errors.email?.message}
          />
        )}
      />
      {request.isError ? <Banner tone="error">{errorMessage(request.error)}</Banner> : null}
      <Button label="Email me a code" busy={request.isPending} onPress={submit} />
    </View>
  );
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { signIn } = useAuth();
  const { control, handleSubmit, formState } = useForm<VerifyCodeInput>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { email, code: '' },
  });
  const verify = useMutation({
    mutationFn: api.verifyCode,
    onSuccess: (res) => signIn(res),
  });
  const resend = useMutation({ mutationFn: () => api.requestCode({ email }) });
  const submit = () => void handleSubmit((v) => verify.mutate(v))();

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Sign-in code"
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={submit}
            error={formState.errors.code?.message}
            hint={__DEV__ ? 'Development: the code is printed in the API console.' : undefined}
          />
        )}
      />
      {verify.isError ? <Banner tone="error">{errorMessage(verify.error)}</Banner> : null}
      {resend.isSuccess ? <Banner tone="success">A new code is on its way.</Banner> : null}
      <Button label="Sign in" busy={verify.isPending} onPress={submit} />
      <View style={styles.row}>
        <Button label="Use another email" variant="secondary" compact onPress={onChangeEmail} />
        <Button label="Resend code" variant="secondary" compact busy={resend.isPending} onPress={() => resend.mutate()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
