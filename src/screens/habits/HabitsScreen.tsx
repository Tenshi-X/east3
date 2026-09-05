import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, SectionHeader, ProgressBar, EmptyState, Button } from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

const HABIT_ICONS = ['✅', '💧', '🏃', '📚', '🧘', '🍎', '💊', '💪', '🛌', '🧠', '✍️', '🎯'];
const HABIT_COLORS = [Colors.primary, '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EC4899', Colors.danger];
const FREQUENCIES = [
  { key: 'daily', label: 'Setiap Hari' },
  { key: 'weekly', label: 'Mingguan' },
] as const;

export function HabitsScreen({ navigation }: any) {
  const { session } = useAuthStore();
  const { habits, todayLogs, loading, fetchHabits, fetchTodayLogs, createHabit, deleteHabit, logHabit, getStreak } = useHabitStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'today' | 'manage'>('today');

  const [form, setForm] = useState<{
    name: string;
    description: string;
    target_value: string;
    unit: string;
    frequency: 'daily' | 'weekly';
    icon: string;
    color: string;
  }>({
    name: '',
    description: '',
    target_value: '1',
    unit: 'kali',
    frequency: 'daily',
    icon: '✅',
    color: Colors.primary,
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchHabits().then(() => fetchTodayLogs(today));
  }, []);

  useEffect(() => {
    if (habits.length > 0) {
      // Load streaks for all habits
      Promise.all(
        habits.map(async h => ({ id: h.id, streak: await getStreak(h.id) }))
      ).then(results => {
        const s: Record<string, number> = {};
        results.forEach(r => { s[r.id] = r.streak; });
        setStreaks(s);
      });
    }
  }, [habits]);

  const handleCreateHabit = async () => {
    if (!form.name || !session?.user) {
      Alert.alert('Error', 'Nama habit wajib diisi');
      return;
    }

    const { error } = await createHabit({
      user_id: session.user.id,
      name: form.name,
      description: form.description || null,
      target_value: Number(form.target_value) || 1,
      unit: form.unit,
      frequency: form.frequency,
      icon: form.icon,
      color: form.color,
      is_active: true,
    });

    if (error) { Alert.alert('Error', error); return; }

    setShowAddModal(false);
    setForm({ name: '', description: '', target_value: '1', unit: 'kali', frequency: 'daily', icon: '✅', color: Colors.primary });
    await fetchTodayLogs(today);
  };

  const handleLog = async (habitId: string, currentValue: number, targetValue: number) => {
    const newValue = Math.min(currentValue + 1, targetValue);
    await logHabit(habitId, newValue, today);
  };

  const handleUnlog = async (habitId: string) => {
    await logHabit(habitId, 0, today);
  };

  const completedCount = todayLogs.filter(l => l.is_completed).length;
  const totalCount = habits.length;
  const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

  // Last 7 days for streak visualization
  const last7Days = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <Text style={styles.subtitle}>
          {format(new Date(), "EEEE, d MMMM", { locale: idLocale })}
        </Text>
      </View>

      {/* Daily Progress Summary */}
      {habits.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryValue}>{completedCount}/{totalCount}</Text>
              <Text style={styles.summaryLabel}>Habits selesai hari ini</Text>
            </View>
            <Text style={styles.summaryEmoji}>{completionRate === 1 ? '🔥' : completionRate > 0.5 ? '⚡' : '💪'}</Text>
          </View>
          <ProgressBar progress={completionRate} color={Colors.success} height={8} showLabel />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'today', label: '📅 Hari Ini' },
          { key: 'manage', label: '⚙️ Kelola' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Today Tab */}
        {activeTab === 'today' && (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}>
            {habits.length === 0 ? (
              <Card>
                <EmptyState
                  icon="🌱"
                  title="Belum ada habit"
                  subtitle="Mulai bangun kebiasaan positif"
                  action={{ label: 'Tambah Habit', onPress: () => setShowAddModal(true) }}
                />
              </Card>
            ) : (
              habits.map(habit => {
                const log = todayLogs.find(l => l.habit_id === habit.id);
                const currentValue = log?.value ?? 0;
                const progress = currentValue / habit.target_value;
                const streak = streaks[habit.id] ?? 0;
                const isDone = log?.is_completed ?? false;

                return (
                  <Card key={habit.id} style={isDone ? styles.habitCardDone : undefined}>
                    <View style={styles.habitRow}>
                      <TouchableOpacity
                        onPress={() => isDone ? handleUnlog(habit.id) : handleLog(habit.id, currentValue, habit.target_value)}
                        style={[
                          styles.habitCheck,
                          { borderColor: habit.color ?? Colors.primary },
                          isDone && { backgroundColor: habit.color ?? Colors.primary },
                        ]}
                      >
                        {isDone && <Text style={styles.habitCheckMark}>✓</Text>}
                      </TouchableOpacity>

                      <Text style={styles.habitIcon}>{habit.icon}</Text>

                      <View style={{ flex: 1 }}>
                        <View style={styles.habitTitleRow}>
                          <Text style={[styles.habitName, isDone && styles.habitNameDone]}>
                            {habit.name}
                          </Text>
                          {streak > 0 && (
                            <View style={styles.streakBadge}>
                              <Text style={styles.streakText}>🔥 {streak}</Text>
                            </View>
                          )}
                        </View>

                        {habit.target_value > 1 && (
                          <>
                            <View style={styles.progressRowInline}>
                              <ProgressBar
                                progress={progress}
                                color={habit.color ?? Colors.primary}
                                height={5}
                              />
                              <Text style={[styles.progressLabel, { color: habit.color ?? Colors.primary }]}>
                                {currentValue}/{habit.target_value} {habit.unit}
                              </Text>
                            </View>

                            {/* Increment buttons for quantity habits */}
                            {!isDone && (
                              <View style={styles.incrementRow}>
                                {[25, 50, 100].map(increment => (
                                  <TouchableOpacity
                                    key={increment}
                                    style={[styles.incrementBtn, { borderColor: habit.color + '66' }]}
                                    onPress={() => {
                                      const unitMap: Record<string, number> = {
                                        ml: increment * 10, // 250, 500, 1000 ml
                                        kali: 1,
                                        menit: 5,
                                      };
                                      const step = unitMap[habit.unit] ?? 1;
                                      const newVal = Math.min(currentValue + step, habit.target_value);
                                      logHabit(habit.id, newVal, today);
                                    }}
                                  >
                                    <Text style={[styles.incrementBtnText, { color: habit.color }]}>
                                      +{habit.unit === 'ml' ? increment * 10 : 1} {habit.unit}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}>
            <Button
              label="+ Tambah Habit"
              onPress={() => setShowAddModal(true)}
              variant="ghost"
            />
            {habits.map(habit => (
              <Card key={habit.id}>
                <View style={styles.manageRow}>
                  <Text style={styles.habitIcon}>{habit.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitMeta}>
                      Target: {habit.target_value} {habit.unit} · {habit.frequency === 'daily' ? 'Setiap hari' : 'Mingguan'}
                    </Text>
                  </View>
                  <View style={[styles.colorDotSmall, { backgroundColor: habit.color }]} />
                  <TouchableOpacity
                    onPress={() => Alert.alert('Hapus Habit', 'Yakin?', [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Hapus', style: 'destructive', onPress: () => deleteHabit(habit.id) },
                    ])}
                    style={styles.deleteBtn}
                  >
                    <Text style={{ color: Colors.danger }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tambah Habit</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nama Habit *</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.name}
                  onChangeText={t => setForm(f => ({ ...f, name: t }))}
                  placeholder="Minum air, Push up, Baca buku..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Target</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TextInput
                    style={[styles.formInput, { flex: 1 }]}
                    value={form.target_value}
                    onChangeText={t => setForm(f => ({ ...f, target_value: t }))}
                    placeholder="1"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.formInput, { flex: 2 }]}
                    value={form.unit}
                    onChangeText={t => setForm(f => ({ ...f, unit: t }))}
                    placeholder="kali, ml, menit..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Frekuensi</Text>
                <View style={styles.freqRow}>
                  {FREQUENCIES.map(f => (
                    <TouchableOpacity
                      key={f.key}
                      style={[
                        styles.freqBtn,
                        form.frequency === f.key && styles.freqBtnActive,
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, frequency: f.key }))}
                    >
                      <Text style={[
                        styles.freqBtnText,
                        form.frequency === f.key && styles.freqBtnTextActive,
                      ]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Icon</Text>
                <View style={styles.iconGrid}>
                  {HABIT_ICONS.map(icon => (
                    <TouchableOpacity
                      key={icon}
                      style={[styles.iconBtn, form.icon === icon && styles.iconBtnSelected]}
                      onPress={() => setForm(f => ({ ...f, icon }))}
                    >
                      <Text style={styles.iconBtnText}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Warna</Text>
                <View style={styles.colorRow}>
                  {HABIT_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorDot,
                        { backgroundColor: color },
                        form.color === color && styles.colorDotSelected,
                      ]}
                      onPress={() => setForm(f => ({ ...f, color }))}
                    />
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label="Batal" onPress={() => setShowAddModal(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Tambah" onPress={handleCreateHabit} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: Typography.size['3xl'], fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.size.base, color: Colors.textSecondary },
  summaryCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    gap: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryValue: { fontSize: Typography.size['2xl'], fontWeight: '900', color: Colors.textPrimary },
  summaryLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  summaryEmoji: { fontSize: 40 },
  tabs: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.base, marginBottom: Spacing.md },
  tab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.size.sm, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.textInverse },
  scroll: { paddingBottom: 100 },
  habitCardDone: { opacity: 0.7 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  habitCheck: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  habitCheckMark: { color: Colors.textInverse, fontSize: 14, fontWeight: '900' },
  habitIcon: { fontSize: 24 },
  habitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 },
  habitName: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
  habitNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  habitMeta: { fontSize: Typography.size.xs, color: Colors.textMuted },
  streakBadge: {
    backgroundColor: '#F59E0B22', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  progressRowInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressLabel: { fontSize: Typography.size.xs, fontWeight: '700', minWidth: 60 },
  incrementRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  incrementBtn: {
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  incrementBtnText: { fontSize: 11, fontWeight: '600' },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  colorDotSmall: { width: 12, height: 12, borderRadius: 6 },
  deleteBtn: { padding: Spacing.xs },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.size.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
  formGroup: { marginBottom: Spacing.md },
  formLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  formInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: Typography.size.base,
  },
  freqRow: { flexDirection: 'row', gap: Spacing.sm },
  freqBtn: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  freqBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  freqBtnText: { color: Colors.textMuted, fontWeight: '600' },
  freqBtnTextActive: { color: Colors.textInverse },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  iconBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  iconBtnText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: Spacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.textPrimary },
});
