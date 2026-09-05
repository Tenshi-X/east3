import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore } from '../../stores/habitStore';
import { useFinanceStore } from '../../stores/financeStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import {
  Card, SectionHeader, ProgressBar, Skeleton, EmptyState, Badge,
} from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface TodayData {
  events: any[];
  priorities: any[];
  morningBrief: string | null;
  briefLoading: boolean;
}

export function TodayDashboardScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const { habits, todayLogs, fetchHabits, fetchTodayLogs, logHabit } = useHabitStore();
  const { getTotalExpense, getTotalIncome, budgets, fetchTransactions, fetchBudgets } = useFinanceStore();
  const { plans, fetchPlans } = useWorkoutStore();

  const [data, setData] = useState<TodayData>({
    events: [], priorities: [], morningBrief: null, briefLoading: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });

  const loadAll = async () => {
    const [eventsRes, prioritiesRes, briefRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time'),
      supabase
        .from('priorities')
        .select('*')
        .eq('date', today)
        .order('order_index'),
      supabase
        .from('morning_briefs')
        .select('content')
        .eq('date', today)
        .single(),
    ]);

    setData({
      events: eventsRes.data ?? [],
      priorities: prioritiesRes.data ?? [],
      morningBrief: briefRes.data?.content ?? null,
      briefLoading: false,
    });

    await Promise.all([
      fetchHabits(),
      fetchTransactions(),
      fetchBudgets(),
      fetchPlans(),
    ]);
    await fetchTodayLogs(today);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const generateBrief = async () => {
    setData(d => ({ ...d, briefLoading: true }));
    try {
      const proxyUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(`${proxyUrl}/api/ai-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'morning_brief', date: today }),
      });
      const result = await res.json();
      if (result.brief) {
        setData(d => ({ ...d, morningBrief: result.brief }));
      }
    } catch (e) {
      console.error('Brief generation error:', e);
    } finally {
      setData(d => ({ ...d, briefLoading: false }));
    }
  };

  const togglePriority = async (id: string, isDone: boolean) => {
    await supabase.from('priorities').update({ is_done: !isDone }).eq('id', id);
    setData(d => ({
      ...d,
      priorities: d.priorities.map(p => p.id === id ? { ...p, is_done: !isDone } : p),
    }));
  };

  const totalExpense = getTotalExpense();
  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const todayWorkoutPlan = plans.find(p =>
    p.day_of_week?.includes(new Date().getDay())
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <DashboardSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[Colors.primaryDark + '44', 'transparent']}
          style={styles.header}
        >
          <View>
            <Text style={styles.greeting}>
              Selamat {getGreeting()}, {profile?.display_name?.split(' ')[0] ?? 'kamu'} 👋
            </Text>
            <Text style={styles.dateLabel}>{todayLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.profileInitial}>
              {profile?.display_name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Morning Brief */}
        <View style={styles.section}>
          <SectionHeader
            title="Ringkasan Hari Ini"
            icon="🌅"
            action={{ label: data.briefLoading ? '...' : 'Generate', onPress: generateBrief }}
          />
          <Card glow>
            {data.briefLoading ? (
              <View style={{ gap: 8 }}>
                <Skeleton height={14} />
                <Skeleton height={14} width="80%" />
                <Skeleton height={14} width="60%" />
              </View>
            ) : data.morningBrief ? (
              <Text style={styles.briefText}>{data.morningBrief}</Text>
            ) : (
              <TouchableOpacity onPress={generateBrief} style={styles.briefEmpty}>
                <Text style={styles.briefEmptyIcon}>🤖</Text>
                <Text style={styles.briefEmptyTitle}>Generate Morning Brief</Text>
                <Text style={styles.briefEmptyText}>Tap untuk membuat ringkasan hari ini dengan AI</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* Today's Events */}
        <View style={styles.section}>
          <SectionHeader
            title="Jadwal Hari Ini"
            icon="📅"
            action={{ label: 'Semua', onPress: () => navigation.navigate('Calendar') }}
          />
          {data.events.length === 0 ? (
            <Card>
              <EmptyState icon="📭" title="Tidak ada jadwal" subtitle="Tambah via AI Chat atau Kalender" />
            </Card>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {data.events.map(event => (
                <Card key={event.id} onPress={() => navigation.navigate('Calendar')}>
                  <View style={styles.eventRow}>
                    <View style={[styles.eventDot, { backgroundColor: event.color ?? Colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventTime}>
                        {format(new Date(event.start_time), 'HH:mm')} —{' '}
                        {format(new Date(event.end_time), 'HH:mm')}
                      </Text>
                    </View>
                    {event.source === 'ai' && <Badge label="AI" size="sm" />}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Priorities */}
        <View style={styles.section}>
          <SectionHeader
            title="Prioritas Utama"
            icon="🎯"
            action={{ label: 'Tambah', onPress: () => navigation.navigate('AddPriority') }}
          />
          <Card>
            {data.priorities.length === 0 ? (
              <EmptyState icon="✅" title="Belum ada prioritas hari ini" />
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {data.priorities.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.priorityRow}
                    onPress={() => togglePriority(p.id, p.is_done)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, p.is_done && styles.checkboxDone]}>
                      {p.is_done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.priorityText, p.is_done && styles.priorityTextDone]}>
                      {p.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </View>

        {/* Finance Snapshot */}
        <View style={styles.section}>
          <SectionHeader
            title="Keuangan Bulan Ini"
            icon="💰"
            action={{ label: 'Detail', onPress: () => navigation.navigate('Finance') }}
          />
          <Card onPress={() => navigation.navigate('Finance')}>
            <View style={styles.financeRow}>
              <View>
                <Text style={styles.financeLabel}>Total Pengeluaran</Text>
                <Text style={[styles.financeValue, { color: Colors.danger }]}>
                  {formatIDR(totalExpense)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.financeLabel}>Budget</Text>
                <Text style={[styles.financeValue, { color: Colors.success }]}>
                  {formatIDR(totalBudget)}
                </Text>
              </View>
            </View>
            {totalBudget > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <ProgressBar
                  progress={totalExpense / totalBudget}
                  color={totalExpense > totalBudget ? Colors.danger : Colors.primary}
                  showLabel
                />
              </View>
            )}
          </Card>
        </View>

        {/* Workout Today */}
        <View style={styles.section}>
          <SectionHeader
            title="Workout Hari Ini"
            icon="💪"
            action={{ label: 'Log', onPress: () => navigation.navigate('Workout') }}
          />
          <Card onPress={() => navigation.navigate('Workout')}>
            {todayWorkoutPlan ? (
              <View style={styles.workoutRow}>
                <View style={[
                  styles.splitBadge,
                  { backgroundColor: getSplitColor(todayWorkoutPlan.split_type) + '22' },
                ]}>
                  <Text style={[styles.splitLabel, { color: getSplitColor(todayWorkoutPlan.split_type) }]}>
                    {todayWorkoutPlan.split_type.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{todayWorkoutPlan.name}</Text>
                  <Text style={styles.workoutSub}>
                    {(todayWorkoutPlan.exercises as any[])?.length ?? 0} exercises
                  </Text>
                </View>
                <Text style={styles.workoutArrow}>›</Text>
              </View>
            ) : (
              <EmptyState icon="🏖️" title="Rest day" subtitle="Tidak ada workout terjadwal hari ini" />
            )}
          </Card>
        </View>

        {/* Habits */}
        <View style={styles.section}>
          <SectionHeader
            title="Habit Hari Ini"
            icon="⚡"
            action={{ label: 'Kelola', onPress: () => navigation.navigate('Habits') }}
          />
          {habits.length === 0 ? (
            <Card>
              <EmptyState
                icon="🌱"
                title="Belum ada habit"
                action={{ label: 'Buat habit pertama', onPress: () => navigation.navigate('Habits') }}
              />
            </Card>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {habits.slice(0, 5).map(habit => {
                const log = todayLogs.find(l => l.habit_id === habit.id);
                const progress = log ? (log.value / habit.target_value) : 0;
                return (
                  <Card key={habit.id} onPress={() => logHabit(habit.id, habit.target_value)}>
                    <View style={styles.habitRow}>
                      <Text style={styles.habitIcon}>{habit.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.habitTitleRow}>
                          <Text style={styles.habitName}>{habit.name}</Text>
                          <Text style={[
                            styles.habitStatus,
                            { color: log?.is_completed ? Colors.success : Colors.textMuted },
                          ]}>
                            {log?.is_completed ? '✓ Done' : `${log?.value ?? 0}/${habit.target_value} ${habit.unit}`}
                          </Text>
                        </View>
                        <ProgressBar
                          progress={progress}
                          color={habit.color ?? Colors.primary}
                          height={4}
                        />
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ gap: Spacing.lg, padding: Spacing.base }}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{ gap: 8 }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={80} />
        </View>
      ))}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Pagi';
  if (h < 15) return 'Siang';
  if (h < 18) return 'Sore';
  return 'Malam';
}

function getSplitColor(split: string) {
  const map: Record<string, string> = {
    push: Colors.danger,
    pull: Colors.info,
    legs: Colors.success,
    upper: '#A855F7',
    lower: '#F59E0B',
    full_body: '#EC4899',
    custom: Colors.primaryLight,
  };
  return map[split] ?? Colors.primary;
}

function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing['5xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.lg,
  },
  greeting: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.textPrimary },
  dateLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.textInverse },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.lg },
  briefText: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 22 },
  briefEmpty: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  briefEmptyIcon: { fontSize: 32 },
  briefEmptyTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary },
  briefEmptyText: { fontSize: Typography.size.sm, color: Colors.textMuted, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
  eventTime: { fontSize: Typography.size.sm, color: Colors.textMuted },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.primary },
  checkmark: { color: Colors.textInverse, fontSize: 12, fontWeight: '800' },
  priorityText: { fontSize: Typography.size.base, color: Colors.textPrimary, flex: 1 },
  priorityTextDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financeLabel: { fontSize: Typography.size.sm, color: Colors.textMuted },
  financeValue: { fontSize: Typography.size.xl, fontWeight: '800', marginTop: 2 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  splitBadge: { borderRadius: BorderRadius.md, padding: Spacing.sm },
  splitLabel: { fontSize: Typography.size.sm, fontWeight: '800' },
  workoutName: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary },
  workoutSub: { fontSize: Typography.size.sm, color: Colors.textMuted },
  workoutArrow: { fontSize: 24, color: Colors.textMuted },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  habitIcon: { fontSize: 24 },
  habitTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  habitName: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
  habitStatus: { fontSize: Typography.size.sm, fontWeight: '600' },
});
