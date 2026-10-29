import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontSize, radius, spacing, useTheme } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------- Screen ------------------------------- */

export function Screen({
  children,
  scroll = true,
  title,
  onBack,
  right,
  maxWidth = 680,
  bottomInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  maxWidth?: number;
  bottomInset?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const header = title || onBack ? (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="返回"
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        {title ? <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;

  const content = (
    <View
      style={[
        styles.inner,
        {
          maxWidth,
          paddingTop: title || onBack ? spacing.md : insets.top + spacing.md,
          paddingBottom: bottomInset
            ? Platform.OS === 'web'
              ? spacing.xxl
              : insets.bottom + 80
            : spacing.lg,
        },
      ]}
    >
      {header}
      {children}
    </View>
  );

  if (scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {content}
    </View>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = true,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const { colors } = useTheme();

  const bg = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: '#FFFFFF',
  }[variant];
  const border = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        !fullWidth && styles.btnAuto,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* -------------------------------- Field ------------------------------- */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  error,
  suffix,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'decimal-pad' | 'numeric';
  error?: string | null;
  suffix?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.fieldInputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          accessibilityLabel={label}
          style={[
            styles.fieldInput,
            { color: colors.text },
            multiline && styles.fieldInputMultiline,
          ]}
        />
        {suffix ? (
          <Text style={[styles.fieldSuffix, { color: colors.textMuted }]}>{suffix}</Text>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

/* -------------------------------- Chip -------------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IoniconName;
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  const bg = selected ? accent : colors.surfaceAlt;
  const fg = selected ? colors.onPrimary : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: selected ? accent : colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------- Badge ------------------------------- */

export function Badge({
  label,
  color,
  icon,
}: {
  label: string;
  color?: string;
  icon?: IoniconName;
}) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: `${c}1A` }]}>
      {icon ? <Ionicons name={icon} size={12} color={c} /> : null}
      <Text style={[styles.badgeText, { color: c }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------ EmptyState ---------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: IoniconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} icon="add" style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

/* ----------------------------- SectionTitle --------------------------- */

export function SectionTitle({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text style={[styles.sectionTitleText, { color: colors.text }]}>{title}</Text>
      {right}
    </View>
  );
}

/* ------------------------------- StatTile ----------------------------- */

export function StatTile({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: IoniconName;
}) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.tileTop}>
        {icon ? <Ionicons name={icon} size={15} color={c} /> : null}
        <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, { color: c }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={[styles.tileSub, { color: colors.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

/* ------------------------------- Styles ------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 36,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  btnAuto: { alignSelf: 'flex-start' },
  btnText: { fontSize: fontSize.md, fontWeight: '600' },
  field: { gap: spacing.sm, marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600' },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  fieldInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  fieldSuffix: { fontSize: fontSize.sm, marginLeft: spacing.sm },
  fieldError: { fontSize: fontSize.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: '500' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptyDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitleText: { fontSize: fontSize.lg, fontWeight: '700' },
  tile: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 4,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: fontSize.sm, fontWeight: '500' },
  tileValue: { fontSize: fontSize.xxl, fontWeight: '800' },
  tileSub: { fontSize: fontSize.xs },
});
