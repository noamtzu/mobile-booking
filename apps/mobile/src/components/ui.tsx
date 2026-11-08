import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import { radius, spacing, useColors } from '@/theme/colors';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small';

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const c = useColors();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  return <Text {...rest} style={[styles[variant], { color }, style]} />;
}

export function Card({ style, ...rest }: ViewProps) {
  const c = useColors();
  return <View {...rest} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]} />;
}

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  compact?: boolean;
}

export function Button({ label, variant = 'primary', busy = false, disabled, compact, ...rest }: ButtonProps) {
  const c = useColors();
  const isDisabled = disabled || busy;
  const bg = variant === 'primary' ? (isDisabled ? c.disabled : c.primary) : 'transparent';
  const fg =
    variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.danger : isDisabled ? c.disabled : c.primary;
  const borderColor = variant === 'primary' ? bg : variant === 'danger' ? c.danger : c.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy }}
      disabled={isDisabled}
      hitSlop={compact ? 8 : 0}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, borderColor, opacity: pressed ? 0.85 : 1 },
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, style, ...rest }: FieldProps) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.small, { color: c.danger }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.small, { color: c.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = useColors();
  const map = {
    error: { bg: c.dangerSoft, fg: c.danger },
    success: { bg: c.successSoft, fg: c.success },
    info: { bg: c.primarySoft, fg: c.text },
  } as const;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: map[tone].bg }]}
    >
      <Text style={[styles.body, { color: map[tone].fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: spacing.md },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  field: { gap: spacing.xs },
  label: { fontSize: 15, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  banner: { borderRadius: radius.md, padding: spacing.md },
});
