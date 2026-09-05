import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, FlatList,
} from 'react-native';
import { format, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useFinanceStore } from '../../stores/financeStore';
import { useAuthStore } from '../../stores/authStore';
import { FINANCE_CATEGORIES } from '../../theme';
import { Card, SectionHeader, ProgressBar, StatCard, EmptyState, AmountText, Badge, Button, Chip } from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

export function FinanceScreen({ navigation }: any) {
  const { session } = useAuthStore();
  const {
    transactions, budgets, loading,
    fetchTransactions, fetchBudgets,
    addTransaction, deleteTransaction, setBudget,
    getTotalIncome, getTotalExpense, getCategoryBreakdown, getBudgetStatus,
  } = useFinanceStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budget'>('overview');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: 'food',
    note: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const [budgetForm, setBudgetForm] = useState({
    category: 'food',
    limit: '',
  });

  const currentMonth = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    fetchTransactions(currentMonth);
    fetchBudgets(currentMonth);
  }, []);

  const totalIncome = getTotalIncome();
  const totalExpense = getTotalExpense();
  const netBalance = totalIncome - totalExpense;
  const breakdown = getCategoryBreakdown();

  const filteredTx = transactions.filter(t =>
    filterType === 'all' ? true : t.type === filterType
  );

  const handleAddTransaction = async () => {
    if (!form.amount || isNaN(Number(form.amount))) {
      Alert.alert('Error', 'Masukkan jumlah yang valid');
      return;
    }
    if (!session?.user) return;

    const { error } = await addTransaction({
      user_id: session.user.id,
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      note: form.note || null,
      occurred_at: `${form.date}T12:00:00`,
      source: 'manual',
    });

    if (error) { Alert.alert('Error', error); return; }
    setShowAddModal(false);
    setForm(f => ({ ...f, amount: '', note: '' }));
  };

  const handleSetBudget = async () => {
    if (!budgetForm.limit || isNaN(Number(budgetForm.limit))) {
      Alert.alert('Error', 'Masukkan jumlah limit yang valid');
      return;
    }
    if (!session?.user) return;

    const { error } = await setBudget({
      user_id: session.user.id,
      category: budgetForm.category,
      monthly_limit: Number(budgetForm.limit),
      month: currentMonth,
    });

    if (error) { Alert.alert('Error', error); return; }
    setShowBudgetModal(false);
    setBudgetForm(f => ({ ...f, limit: '' }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Keuangan</Text>
        <Text style={styles.subtitle}>{format(new Date(), 'MMMM yyyy', { locale: idLocale })}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="💸"
          label="Pengeluaran"
          value={formatIDR(totalExpense)}
          color={Colors.danger}
        />
        <StatCard
          icon="💰"
          label="Pemasukan"
          value={formatIDR(totalIncome)}
          color={Colors.success}
        />
        <StatCard
          icon="📊"
          label="Saldo Bersih"
          value={formatIDR(Math.abs(netBalance))}
          color={netBalance >= 0 ? Colors.primary : Colors.danger}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'overview', label: 'Ringkasan' },
          { key: 'transactions', label: 'Transaksi' },
          { key: 'budget', label: 'Budget' },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <View style={{ gap: Spacing.md }}>
            <SectionHeader title="Breakdown per Kategori" icon="🗂️" />
            {breakdown.length === 0 ? (
              <Card style={{ marginHorizontal: Spacing.base }}>
                <EmptyState icon="📊" title="Belum ada transaksi" />
              </Card>
            ) : (
              breakdown.map(({ category, amount, budget }) => {
                const cat = FINANCE_CATEGORIES.find(c => c.id === category);
                const progress = budget ? amount / budget : 0;
                return (
                  <Card key={category} style={{ marginHorizontal: Spacing.base }}>
                    <View style={styles.catRow}>
                      <Text style={styles.catIcon}>{cat?.icon ?? '📦'}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.catTitleRow}>
                          <Text style={styles.catName}>{cat?.label ?? category}</Text>
                          <AmountText amount={amount} type="expense" size="sm" />
                        </View>
                        {budget && (
                          <>
                            <ProgressBar
                              progress={progress}
                              color={cat?.color ?? Colors.primary}
                              height={5}
                            />
                            <Text style={styles.catBudget}>
                              Sisa: {formatIDR(budget - amount)} dari {formatIDR(budget)}
                            </Text>
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

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <View>
            <View style={styles.filterRow}>
              {(['all', 'income', 'expense'] as const).map(f => (
                <Chip
                  key={f}
                  label={{ all: 'Semua', income: 'Pemasukan', expense: 'Pengeluaran' }[f]}
                  selected={filterType === f}
                  onPress={() => setFilterType(f)}
                  color={f === 'income' ? Colors.success : f === 'expense' ? Colors.danger : Colors.primary}
                />
              ))}
            </View>

            {filteredTx.length === 0 ? (
              <Card style={{ margin: Spacing.base }}>
                <EmptyState
                  icon="💳"
                  title="Belum ada transaksi"
                  action={{ label: 'Catat Transaksi', onPress: () => setShowAddModal(true) }}
                />
              </Card>
            ) : (
              <View style={{ gap: Spacing.sm, paddingHorizontal: Spacing.base }}>
                {filteredTx.map(tx => {
                  const cat = FINANCE_CATEGORIES.find(c => c.id === tx.category);
                  return (
                    <Card key={tx.id}>
                      <View style={styles.txRow}>
                        <View style={[styles.txIconBg, { backgroundColor: (cat?.color ?? Colors.primary) + '22' }]}>
                          <Text style={styles.txIcon}>{cat?.icon ?? '📦'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txNote}>{tx.note || cat?.label || tx.category}</Text>
                          <Text style={styles.txDate}>
                            {format(new Date(tx.occurred_at), 'd MMM yyyy', { locale: idLocale })}
                            {tx.source === 'ai' ? ' · AI' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AmountText
                            amount={Number(tx.amount)}
                            type={tx.type}
                            size="sm"
                          />
                          <Text style={styles.txCategory}>{cat?.label ?? tx.category}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => Alert.alert('Hapus', 'Hapus transaksi ini?', [
                            { text: 'Batal', style: 'cancel' },
                            { text: 'Hapus', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
                          ])}
                          style={styles.txDelete}
                        >
                          <Text style={{ color: Colors.danger }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Budget Tab */}
        {activeTab === 'budget' && (
          <View style={{ gap: Spacing.sm, paddingHorizontal: Spacing.base }}>
            <Button
              label="+ Set Budget Kategori"
              onPress={() => setShowBudgetModal(true)}
              variant="ghost"
            />
            {FINANCE_CATEGORIES.filter(c => c.id !== 'salary' && c.id !== 'freelance').map(cat => {
              const status = getBudgetStatus(cat.id);
              const hasBudget = status.limit > 0;
              return (
                <Card key={cat.id}>
                  <View style={styles.catRow}>
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={styles.catTitleRow}>
                        <Text style={styles.catName}>{cat.label}</Text>
                        {hasBudget ? (
                          <Text style={styles.budgetLimit}>{formatIDR(status.limit)}/bln</Text>
                        ) : (
                          <Text style={styles.noBudget}>Belum diset</Text>
                        )}
                      </View>
                      {hasBudget && (
                        <>
                          <ProgressBar
                            progress={status.spent / status.limit}
                            color={cat.color}
                            height={5}
                          />
                          <Text style={styles.catBudget}>
                            Terpakai: {formatIDR(status.spent)} · Sisa: {formatIDR(status.remaining)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Catat Transaksi</Text>

            {/* Type selector */}
            <View style={styles.typeSelector}>
              {(['expense', 'income'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    form.type === t && {
                      backgroundColor: t === 'income' ? Colors.success : Colors.danger,
                    },
                  ]}
                  onPress={() => setForm(f => ({ ...f, type: t }))}
                >
                  <Text style={[
                    styles.typeBtnText,
                    form.type === t && { color: Colors.textInverse },
                  ]}>
                    {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Jumlah (Rp)</Text>
              <TextInput
                style={styles.formInput}
                value={form.amount}
                onChangeText={t => setForm(f => ({ ...f, amount: t }))}
                placeholder="50000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={styles.categoryScroll}>
                  {FINANCE_CATEGORIES.filter(c =>
                    form.type === 'income'
                      ? ['salary', 'freelance', 'investment', 'other'].includes(c.id)
                      : !['salary', 'freelance'].includes(c.id)
                  ).map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catChip,
                        form.category === cat.id && { backgroundColor: cat.color + '33', borderColor: cat.color },
                      ]}
                      onPress={() => setForm(f => ({ ...f, category: cat.id }))}
                    >
                      <Text>{cat.icon}</Text>
                      <Text style={[styles.catChipText, form.category === cat.id && { color: cat.color }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Catatan (opsional)</Text>
              <TextInput
                style={styles.formInput}
                value={form.note}
                onChangeText={t => setForm(f => ({ ...f, note: t }))}
                placeholder="Keterangan tambahan"
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

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button label="Batal" onPress={() => setShowAddModal(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Simpan" onPress={handleAddTransaction} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Set Budget Modal */}
      <Modal visible={showBudgetModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set Budget Bulanan</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryScroll}>
                  {FINANCE_CATEGORIES.filter(c => !['salary', 'freelance'].includes(c.id)).map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catChip,
                        budgetForm.category === cat.id && { backgroundColor: cat.color + '33', borderColor: cat.color },
                      ]}
                      onPress={() => setBudgetForm(f => ({ ...f, category: cat.id }))}
                    >
                      <Text>{cat.icon}</Text>
                      <Text style={styles.catChipText}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Limit Bulanan (Rp)</Text>
              <TextInput
                style={styles.formInput}
                value={budgetForm.limit}
                onChangeText={t => setBudgetForm(f => ({ ...f, limit: t }))}
                placeholder="500000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button label="Batal" onPress={() => setShowBudgetModal(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Set Budget" onPress={handleSetBudget} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title: { fontSize: Typography.size['3xl'], fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.size.base, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.md },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.size.sm, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.textInverse },
  scroll: { paddingBottom: 100 },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  catIcon: { fontSize: 24 },
  catTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catName: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
  catBudget: { fontSize: Typography.size.xs, color: Colors.textMuted, marginTop: 4 },
  budgetLimit: { fontSize: Typography.size.sm, color: Colors.primary, fontWeight: '600' },
  noBudget: { fontSize: Typography.size.xs, color: Colors.textMuted },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  txIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txIcon: { fontSize: 20 },
  txNote: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
  txDate: { fontSize: Typography.size.xs, color: Colors.textMuted },
  txCategory: { fontSize: Typography.size.xs, color: Colors.textMuted },
  txDelete: { padding: Spacing.xs },
  fab: {
    position: 'absolute', bottom: 90, right: Spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
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
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: Spacing.md,
  },
  typeBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.md },
  typeBtnText: { color: Colors.textMuted, fontWeight: '700' },
  formGroup: { marginBottom: Spacing.md },
  formLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  formInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: Typography.size.base,
  },
  categoryScroll: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated,
  },
  catChipText: { fontSize: Typography.size.xs, color: Colors.textSecondary, fontWeight: '500' },
});
