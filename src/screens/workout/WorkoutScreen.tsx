import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, SectionHeader, EmptyState, Button, Badge } from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

const SPLIT_COLORS: Record<string, string> = {
  push: Colors.danger,
  pull: '#3B82F6',
  legs: Colors.success,
  upper: '#A855F7',
  lower: '#F59E0B',
  full_body: '#EC4899',
  custom: Colors.primaryLight,
};

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function WorkoutScreen({ navigation }: any) {
  const { session } = useAuthStore();
  const { plans, logs, fetchPlans, fetchLogs, createPlan, deletePlan, startWorkoutLog, addSet } = useWorkoutStore();

  const [activeTab, setActiveTab] = useState<'plans' | 'log' | 'history'>('plans');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState<{
    name: string;
    split_type: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom';
    day_of_week: number[];
    exercises: { name: string; defaultSets: number; defaultReps: number }[];
  }>({
    name: '',
    split_type: 'custom',
    day_of_week: [],
    exercises: [{ name: '', defaultSets: 3, defaultReps: 10 }],
  });

  const [setForm, setSetForm] = useState({
    exercise_name: '',
    weight: '',
    reps: '',
    set_number: 1,
    rpe: '',
  });

  useEffect(() => {
    fetchPlans();
    fetchLogs(20);
  }, []);

  const handleCreatePlan = async () => {
    if (!planForm.name) {
      Alert.alert('Error', 'Nama workout plan wajib diisi');
      return;
    }
    if (!session?.user) return;

    const { error } = await createPlan({
      user_id: session.user.id,
      name: planForm.name,
      split_type: planForm.split_type,
      day_of_week: planForm.day_of_week,
      exercises: planForm.exercises.filter(e => e.name),
    });

    if (error) { Alert.alert('Error', error); return; }
    setShowPlanModal(false);
    setPlanForm({ name: '', split_type: 'custom', day_of_week: [], exercises: [{ name: '', defaultSets: 3, defaultReps: 10 }] });
  };

  const handleStartWorkout = async (planId: string) => {
    const { id, error } = await startWorkoutLog(planId);
    if (error || !id) { Alert.alert('Error', error ?? 'Gagal memulai workout'); return; }
    setActiveLogId(id);
    setSelectedPlan(planId);
    setShowLogModal(true);
  };

  const handleAddSet = async () => {
    if (!activeLogId || !setForm.exercise_name) {
      Alert.alert('Error', 'Nama exercise wajib diisi');
      return;
    }

    const { error } = await addSet({
      workout_log_id: activeLogId,
      exercise_name: setForm.exercise_name,
      weight: setForm.weight ? Number(setForm.weight) : null,
      reps: setForm.reps ? Number(setForm.reps) : null,
      set_number: setForm.set_number,
      rpe: setForm.rpe ? Number(setForm.rpe) : null,
    });

    if (error) { Alert.alert('Error', error); return; }

    setSetForm(f => ({
      ...f,
      set_number: f.set_number + 1,
      weight: f.weight,
      reps: f.reps,
      rpe: '',
    }));
  };

  const toggleDay = (day: number) => {
    setPlanForm(f => ({
      ...f,
      day_of_week: f.day_of_week.includes(day)
        ? f.day_of_week.filter(d => d !== day)
        : [...f.day_of_week, day],
    }));
  };

  const addExercise = () => {
    setPlanForm(f => ({
      ...f,
      exercises: [...f.exercises, { name: '', defaultSets: 3, defaultReps: 10 }],
    }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout</Text>
        <Text style={styles.subtitle}>
          {format(new Date(), "EEEE, d MMMM", { locale: idLocale })}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'plans', label: '📋 Plan' },
          { key: 'log', label: '💪 Log' },
          { key: 'history', label: '📈 Riwayat' },
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
        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <View style={{ gap: Spacing.md }}>
            <SectionHeader
              title="Workout Plans"
              icon="📋"
              action={{ label: '+ Buat Plan', onPress: () => setShowPlanModal(true) }}
            />

            {plans.length === 0 ? (
              <Card style={{ marginHorizontal: Spacing.base }}>
                <EmptyState
                  icon="🏋️"
                  title="Belum ada workout plan"
                  subtitle="Buat push/pull/legs atau rencana custom"
                  action={{ label: 'Buat Plan', onPress: () => setShowPlanModal(true) }}
                />
              </Card>
            ) : (
              plans.map(plan => {
                const color = SPLIT_COLORS[plan.split_type] ?? Colors.primary;
                const isToday = plan.day_of_week?.includes(new Date().getDay());
                return (
                  <Card key={plan.id} style={{ marginHorizontal: Spacing.base }}>
                    <View style={styles.planHeader}>
                      <View style={[styles.splitBadge, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.splitLabel, { color }]}>
                          {plan.split_type.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planName}>{plan.name}</Text>
                          {isToday && <Badge label="Hari Ini" color={Colors.success} size="sm" />}
                        </View>
                        <Text style={styles.planDays}>
                          {plan.day_of_week?.map(d => DAY_NAMES[d]).join(' · ') || 'Semua hari'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Hapus Plan', 'Yakin hapus plan ini?', [
                          { text: 'Batal', style: 'cancel' },
                          { text: 'Hapus', style: 'destructive', onPress: () => deletePlan(plan.id) },
                        ])}
                        style={styles.deleteBtn}
                      >
                        <Text style={{ color: Colors.danger }}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Exercises list */}
                    <View style={styles.exerciseList}>
                      {(plan.exercises as any[])?.slice(0, 4).map((ex: any, i: number) => (
                        <Text key={i} style={styles.exerciseItem}>• {ex.name}</Text>
                      ))}
                      {(plan.exercises as any[])?.length > 4 && (
                        <Text style={styles.exerciseMore}>
                          +{(plan.exercises as any[]).length - 4} exercise lainnya
                        </Text>
                      )}
                    </View>

                    <Button
                      label="🏃 Mulai Workout"
                      onPress={() => handleStartWorkout(plan.id)}
                      size="sm"
                      style={{ marginTop: Spacing.md }}
                    />
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* Log Tab */}
        {activeTab === 'log' && (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.md }}>
            <SectionHeader title="Log Workout Hari Ini" icon="💪" />

            {plans.length === 0 ? (
              <Card>
                <EmptyState icon="📝" title="Buat plan dulu" subtitle="Pilih tab Plan untuk membuat workout plan" />
              </Card>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.sectionNote}>Pilih plan untuk mulai logging set</Text>
                {plans.map(plan => {
                  const color = SPLIT_COLORS[plan.split_type] ?? Colors.primary;
                  return (
                    <Card key={plan.id} onPress={() => handleStartWorkout(plan.id)}>
                      <View style={styles.planRowCompact}>
                        <View style={[styles.splitBadge, { backgroundColor: color + '22' }]}>
                          <Text style={[styles.splitLabel, { color }]}>
                            {plan.split_type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.startArrow}>›</Text>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.md }}>
            <SectionHeader title="Riwayat Workout" icon="📈" />
            {logs.length === 0 ? (
              <Card>
                <EmptyState icon="📊" title="Belum ada riwayat workout" />
              </Card>
            ) : (
              logs.map(log => {
                const plan = plans.find(p => p.id === log.plan_id);
                const color = plan ? SPLIT_COLORS[plan.split_type] : Colors.primary;
                const totalSets = log.sets?.length ?? 0;
                const totalVolume = log.sets?.reduce((s: number, set: any) =>
                  s + (Number(set.weight ?? 0) * (set.reps ?? 0)), 0) ?? 0;

                return (
                  <Card key={log.id}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyDate}>
                          {format(new Date(log.date), 'EEEE, d MMM', { locale: idLocale })}
                        </Text>
                        {plan && (
                          <Badge label={plan.split_type.toUpperCase()} color={color} size="sm" />
                        )}
                      </View>
                      <View style={styles.historyStats}>
                        <Text style={styles.historyStatValue}>{totalSets}</Text>
                        <Text style={styles.historyStatLabel}>sets</Text>
                      </View>
                      <View style={styles.historyStats}>
                        <Text style={styles.historyStatValue}>{Math.round(totalVolume)}kg</Text>
                        <Text style={styles.historyStatLabel}>volume</Text>
                      </View>
                    </View>
                    {log.sets?.slice(0, 3).map((s: any) => (
                      <Text key={s.id} style={styles.setDetail}>
                        {s.exercise_name} — {s.weight}kg × {s.reps} reps
                      </Text>
                    ))}
                  </Card>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Plan Modal */}
      <Modal visible={showPlanModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Buat Workout Plan</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nama Plan *</Text>
                <TextInput
                  style={styles.formInput}
                  value={planForm.name}
                  onChangeText={t => setPlanForm(f => ({ ...f, name: t }))}
                  placeholder="Push Day A, PPL Monday..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Split Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {(['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'] as const).map(s => {
                      const c = SPLIT_COLORS[s];
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.splitChip,
                            planForm.split_type === s && { backgroundColor: c + '33', borderColor: c },
                          ]}
                          onPress={() => setPlanForm(f => ({ ...f, split_type: s }))}
                        >
                          <Text style={[
                            styles.splitChipText,
                            planForm.split_type === s && { color: c },
                          ]}>
                            {s.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hari</Text>
                <View style={styles.daysRow}>
                  {DAY_NAMES.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dayBtn,
                        planForm.day_of_week.includes(i) && styles.dayBtnSelected,
                      ]}
                      onPress={() => toggleDay(i)}
                    >
                      <Text style={[
                        styles.dayBtnText,
                        planForm.day_of_week.includes(i) && styles.dayBtnTextSelected,
                      ]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.formLabel}>Exercises</Text>
                  <TouchableOpacity onPress={addExercise}>
                    <Text style={styles.addExerciseBtn}>+ Tambah</Text>
                  </TouchableOpacity>
                </View>
                {planForm.exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <TextInput
                      style={[styles.formInput, { flex: 1 }]}
                      value={ex.name}
                      onChangeText={t => {
                        const exercises = [...planForm.exercises];
                        exercises[i] = { ...exercises[i], name: t };
                        setPlanForm(f => ({ ...f, exercises }));
                      }}
                      placeholder={`Exercise ${i + 1}`}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label="Batal" onPress={() => setShowPlanModal(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Simpan" onPress={handleCreatePlan} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Log Set Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log Set #{setForm.set_number}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Exercise *</Text>
              {selectedPlan && plans.find(p => p.id === selectedPlan)?.exercises?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(plans.find(p => p.id === selectedPlan)?.exercises as any[])?.map((ex: any, i: number) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.exChip,
                          setForm.exercise_name === ex.name && styles.exChipSelected,
                        ]}
                        onPress={() => setSetForm(f => ({ ...f, exercise_name: ex.name }))}
                      >
                        <Text style={[
                          styles.exChipText,
                          setForm.exercise_name === ex.name && { color: Colors.primary },
                        ]}>
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              <TextInput
                style={styles.formInput}
                value={setForm.exercise_name}
                onChangeText={t => setSetForm(f => ({ ...f, exercise_name: t }))}
                placeholder="Bench Press, Squat..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Berat (kg)</Text>
                <TextInput
                  style={styles.formInput}
                  value={setForm.weight}
                  onChangeText={t => setSetForm(f => ({ ...f, weight: t }))}
                  placeholder="80"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Reps</Text>
                <TextInput
                  style={styles.formInput}
                  value={setForm.reps}
                  onChangeText={t => setSetForm(f => ({ ...f, reps: t }))}
                  placeholder="8"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>RPE</Text>
                <TextInput
                  style={styles.formInput}
                  value={setForm.rpe}
                  onChangeText={t => setSetForm(f => ({ ...f, rpe: t }))}
                  placeholder="7"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button label="Selesai" onPress={() => setShowLogModal(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="✓ Log Set" onPress={handleAddSet} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title: { fontSize: Typography.size['3xl'], fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.size.base, color: Colors.textSecondary },
  tabs: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.base, marginBottom: Spacing.md },
  tab: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.size.sm, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.textInverse },
  scroll: { paddingBottom: 100 },
  sectionNote: { fontSize: Typography.size.sm, color: Colors.textMuted },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  planName: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary },
  planDays: { fontSize: Typography.size.xs, color: Colors.textMuted, marginTop: 2 },
  splitBadge: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  splitLabel: { fontSize: Typography.size.xs, fontWeight: '900' },
  deleteBtn: { padding: Spacing.xs },
  exerciseList: { gap: 2 },
  exerciseItem: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  exerciseMore: { fontSize: Typography.size.xs, color: Colors.textMuted },
  planRowCompact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  startArrow: { fontSize: 24, color: Colors.textMuted },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.sm },
  historyDate: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  historyStats: { alignItems: 'center' },
  historyStatValue: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.primary },
  historyStatLabel: { fontSize: Typography.size.xs, color: Colors.textMuted },
  setDetail: { fontSize: Typography.size.sm, color: Colors.textMuted },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    maxHeight: '85%',
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
  splitChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  splitChipText: { fontSize: Typography.size.xs, color: Colors.textMuted, fontWeight: '700' },
  daysRow: { flexDirection: 'row', gap: Spacing.xs },
  dayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  dayBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  dayBtnTextSelected: { color: Colors.textInverse },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addExerciseBtn: { color: Colors.primary, fontSize: Typography.size.sm, fontWeight: '600' },
  exerciseRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 8 },
  exChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated,
  },
  exChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  exChipText: { fontSize: Typography.size.xs, color: Colors.textSecondary },
});
