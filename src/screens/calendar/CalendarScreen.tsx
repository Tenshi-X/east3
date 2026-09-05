import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Switch,
} from 'react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Card, SectionHeader, Badge, EmptyState, Button } from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type CalendarEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color: string;
  source: string;
  recurrence_rule?: string;
};

export function CalendarScreen({ navigation }: any) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<'month' | 'day'>('month');

  // Add event form
  const [form, setForm] = useState<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    color: string;
    isRecurring: boolean;
    recurrenceRule: string;
  }>({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    color: Colors.primary,
    isRecurring: false,
    recurrenceRule: '',
  });

  const fetchEvents = async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time');

    setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [currentMonth]);

  const getEventsForDay = (date: Date) => {
    return events.filter(e => isSameDay(parseISO(e.start_time), date));
  };

  const selectedDayEvents = getEventsForDay(selectedDate);

  const handleAddEvent = async () => {
    if (!form.title) {
      Alert.alert('Error', 'Judul event wajib diisi');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startTime = `${form.date}T${form.startTime}:00`;
    const endTime = `${form.date}T${form.endTime}:00`;

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        title: form.title,
        start_time: startTime,
        end_time: endTime,
        color: form.color,
        recurrence_rule: form.isRecurring ? form.recurrenceRule : null,
        source: 'manual',
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (data) setEvents(prev => [...prev, data]);
    setShowAddModal(false);
    setForm(f => ({ ...f, title: '', recurrenceRule: '' }));
  };

  const deleteEvent = async (id: string) => {
    Alert.alert('Hapus Event', 'Yakin ingin menghapus event ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          await supabase.from('events').delete().eq('id', id);
          setEvents(prev => prev.filter(e => e.id !== id));
        },
      },
    ]);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDayOfWeek = startOfMonth(currentMonth).getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);
  const EVENT_COLORS = ['#088395', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EC4899', '#EF4444'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentMonth(m => subMonths(m, 1))} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
        </Text>
        <TouchableOpacity onPress={() => setCurrentMonth(m => addMonths(m, 1))} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={styles.viewToggle}>
        {(['month', 'day'] as const).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.viewTab, view === v && styles.viewTabActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
              {v === 'month' ? 'Bulan' : 'Hari'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Day names */}
        <View style={styles.dayNamesRow}>
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
            <Text key={d} style={styles.dayName}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {paddingDays.map((_, i) => <View key={`pad-${i}`} style={styles.dayCell} />)}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  isToday && !isSelected && styles.dayNumberToday,
                  !isCurrentMonth && styles.dayNumberOther,
                ]}>
                  {format(day, 'd')}
                </Text>
                {dayEvents.length > 0 && (
                  <View style={styles.eventDots}>
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <View
                        key={i}
                        style={[styles.eventDot, { backgroundColor: e.color ?? Colors.primary }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        <View style={styles.selectedDay}>
          <SectionHeader
            title={format(selectedDate, "EEEE, d MMMM", { locale: idLocale })}
            icon="📅"
            action={{ label: '+ Tambah', onPress: () => {
              setForm(f => ({ ...f, date: format(selectedDate, 'yyyy-MM-dd') }));
              setShowAddModal(true);
            }}}
          />

          {selectedDayEvents.length === 0 ? (
            <Card>
              <EmptyState
                icon="📭"
                title="Tidak ada jadwal"
                action={{ label: 'Tambah event', onPress: () => setShowAddModal(true) }}
              />
            </Card>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {selectedDayEvents.map(event => (
                <Card key={event.id}>
                  <View style={styles.eventCard}>
                    <View style={[styles.eventStripe, { backgroundColor: event.color }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {event.source === 'ai' && <Badge label="AI" size="sm" />}
                        {event.recurrence_rule && <Badge label="Berulang" size="sm" color={Colors.warning} />}
                      </View>
                      <Text style={styles.eventTime}>
                        {format(parseISO(event.start_time), 'HH:mm')} —{' '}
                        {format(parseISO(event.end_time), 'HH:mm')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteEvent(event.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Event Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tambah Event</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Judul *</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.title}
                  onChangeText={t => setForm(f => ({ ...f, title: t }))}
                  placeholder="Meeting, gym, dll."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tanggal</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.date}
                  onChangeText={t => setForm(f => ({ ...f, date: t }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Mulai</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.startTime}
                    onChangeText={t => setForm(f => ({ ...f, startTime: t }))}
                    placeholder="09:00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Selesai</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.endTime}
                    onChangeText={t => setForm(f => ({ ...f, endTime: t }))}
                    placeholder="10:00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Warna</Text>
                <View style={styles.colorRow}>
                  {EVENT_COLORS.map(color => (
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

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.formLabel}>Event Berulang</Text>
                  <Switch
                    value={form.isRecurring}
                    onValueChange={v => setForm(f => ({ ...f, isRecurring: v }))}
                    trackColor={{ true: Colors.primary }}
                    thumbColor={Colors.textPrimary}
                  />
                </View>
                {form.isRecurring && (
                  <TextInput
                    style={[styles.formInput, { marginTop: 8 }]}
                    value={form.recurrenceRule}
                    onChangeText={t => setForm(f => ({ ...f, recurrenceRule: t }))}
                    placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                    placeholderTextColor={Colors.textMuted}
                  />
                )}
              </View>

              <View style={styles.modalActions}>
                <Button
                  label="Batal"
                  onPress={() => setShowAddModal(false)}
                  variant="secondary"
                  style={{ flex: 1 }}
                />
                <Button
                  label="Simpan"
                  onPress={handleAddEvent}
                  style={{ flex: 1 }}
                />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  navBtn: { padding: Spacing.sm },
  navBtnText: { fontSize: 28, color: Colors.primary, fontWeight: '300' },
  monthLabel: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.textPrimary },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  viewTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  viewTabActive: { backgroundColor: Colors.primary },
  viewTabText: { fontSize: Typography.size.sm, color: Colors.textMuted, fontWeight: '600' },
  viewTabTextActive: { color: Colors.textInverse },
  scroll: { paddingBottom: 100 },
  dayNamesRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: BorderRadius.md,
    marginVertical: 1,
  },
  dayCellSelected: { backgroundColor: Colors.primary },
  dayCellToday: { backgroundColor: Colors.primary + '22' },
  dayNumber: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '500' },
  dayNumberSelected: { color: Colors.textInverse, fontWeight: '800' },
  dayNumberToday: { color: Colors.primary, fontWeight: '800' },
  dayNumberOther: { color: Colors.textMuted },
  eventDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  selectedDay: { paddingHorizontal: Spacing.base },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eventStripe: { width: 4, height: '100%', borderRadius: 2, minHeight: 40 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  eventTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary },
  eventTime: { fontSize: Typography.size.sm, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: Spacing.sm },
  deleteBtnText: { color: Colors.danger, fontSize: Typography.size.base },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: Colors.textInverse, fontSize: 28, fontWeight: '300', lineHeight: 34 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: Typography.size.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
  formGroup: { marginBottom: Spacing.md },
  formRow: { flexDirection: 'row', gap: Spacing.md },
  formLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  formInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
  },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.textPrimary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
});
