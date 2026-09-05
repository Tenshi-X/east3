import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme';

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  glow?: boolean;
}

export function Card({ children, style, onPress, glow }: CardProps) {
  const content = (
    <View style={[styles.card, glow && styles.cardGlow, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ─────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color = Colors.primary, bg, size = 'md' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? color + '22' }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.badgeText, { color }, size === 'sm' && styles.badgeTextSm]}>
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  icon?: string;
}

export function SectionHeader({ title, action, icon }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && (
        <TouchableOpacity style={styles.emptyAction} onPress={action.onPress}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────────
interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ progress, color = Colors.primary, height = 6, showLabel }: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const isOver = progress > 1;

  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressTrack, { height }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${clamped * 100}%`,
              backgroundColor: isOver ? Colors.danger : color,
              height,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.progressLabel, { color: isOver ? Colors.danger : color }]}>
          {Math.round(progress * 100)}%
        </Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Chip
// ─────────────────────────────────────────────
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
}

export function Chip({ label, selected, onPress, color = Colors.primary, icon }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color + '33', borderColor: color }]}
      activeOpacity={0.7}
    >
      {icon && <Text style={styles.chipIcon}>{icon}</Text>}
      <Text style={[styles.chipText, selected && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// SkeletonLoader
// ─────────────────────────────────────────────
interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.surfaceElevated,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  color?: string;
  change?: string;
  onPress?: () => void;
}

export function StatCard({ label, value, icon, color = Colors.primary, change, onPress }: StatCardProps) {
  return (
    <Card onPress={onPress} style={styles.statCard}>
      <View style={[styles.statIconBg, { backgroundColor: color + '22' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {change && (
        <Text style={[
          styles.statChange,
          { color: change.startsWith('+') ? Colors.success : Colors.danger },
        ]}>
          {change}
        </Text>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  icon, loading, disabled, style,
}: ButtonProps) {
  const variantStyles = {
    primary: { bg: Colors.primary, text: Colors.textInverse, border: Colors.primary },
    secondary: { bg: Colors.surfaceElevated, text: Colors.textPrimary, border: Colors.surfaceBorder },
    ghost: { bg: 'transparent', text: Colors.primary, border: Colors.primary },
    danger: { bg: Colors.dangerBg, text: Colors.danger, border: Colors.danger },
  }[variant];

  const sizeStyles = {
    sm: { py: Spacing.xs, px: Spacing.md, fontSize: Typography.size.sm },
    md: { py: Spacing.md, px: Spacing.lg, fontSize: Typography.size.base },
    lg: { py: Spacing.lg, px: Spacing.xl, fontSize: Typography.size.md },
  }[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: variantStyles.bg,
          borderColor: variantStyles.border,
          paddingVertical: sizeStyles.py,
          paddingHorizontal: sizeStyles.px,
          opacity: (disabled || loading) ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon && <Text style={[styles.buttonIcon, { fontSize: sizeStyles.fontSize }]}>{icon}</Text>}
      <Text style={[styles.buttonText, { color: variantStyles.text, fontSize: sizeStyles.fontSize }]}>
        {loading ? 'Loading...' : label}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// AmountText
// ─────────────────────────────────────────────
interface AmountTextProps {
  amount: number;
  type?: 'income' | 'expense' | 'neutral';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: TextStyle;
}

export function AmountText({ amount, type = 'neutral', size = 'md', style }: AmountTextProps) {
  const color = type === 'income' ? Colors.success : type === 'expense' ? Colors.danger : Colors.textPrimary;
  const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 }[size];

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <Text style={[{ color, fontSize, fontWeight: '600' }, style]}>
      {prefix}{formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    ...Shadows.sm,
  },
  cardGlow: {
    borderColor: Colors.primary + '44',
    ...Shadows.glow,
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: Typography.size.sm, fontWeight: '600' },
  badgeTextSm: { fontSize: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: Typography.size.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionAction: { fontSize: Typography.size.sm, color: Colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.sm },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: Typography.size.base, color: Colors.textMuted, textAlign: 'center' },
  emptyAction: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  emptyActionText: { color: Colors.textInverse, fontWeight: '700' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressTrack: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: { borderRadius: BorderRadius.full },
  progressLabel: { fontSize: Typography.size.xs, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '500' },
  statCard: { flex: 1, alignItems: 'flex-start', gap: Spacing.xs },
  statIconBg: { borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: Typography.size.xl, fontWeight: '800' },
  statLabel: { fontSize: Typography.size.sm, color: Colors.textMuted },
  statChange: { fontSize: Typography.size.xs, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  buttonIcon: { },
  buttonText: { fontWeight: '700' },
});
