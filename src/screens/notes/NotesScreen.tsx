import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNotesStore } from '../../stores/aiStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, SectionHeader, EmptyState, Badge, Button, Chip } from '../../components/ui';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import type { Database } from '../../lib/supabase';

type NoteType = Database['public']['Tables']['notes']['Row']['type'];

const NOTE_TYPES: { key: NoteType; label: string; icon: string; color: string }[] = [
  { key: 'idea', label: 'Ide', icon: '💡', color: '#F59E0B' },
  { key: 'meeting', label: 'Meeting', icon: '🤝', color: Colors.primary },
  { key: 'journal', label: 'Jurnal', icon: '📝', color: '#A855F7' },
  { key: 'sop', label: 'SOP', icon: '📋', color: '#22C55E' },
  { key: 'bookmark', label: 'Bookmark', icon: '🔖', color: '#3B82F6' },
];

export function NotesScreen({ navigation }: any) {
  const { session } = useAuthStore();
  const { notes, loading, fetchNotes, createNote, deleteNote, searchNotes } = useNotesStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewNote, setViewNote] = useState<any>(null);
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState({
    type: 'idea' as NoteType,
    title: '',
    content: '',
    tags: '',
  });

  useEffect(() => {
    fetchNotes(filterType === 'all' ? undefined : filterType);
  }, [filterType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const results = await searchNotes(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const handleCreate = async () => {
    if (!form.title || !form.content) {
      Alert.alert('Error', 'Judul dan isi catatan wajib diisi');
      return;
    }
    if (!session?.user) return;

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const { error } = await createNote({
      user_id: session.user.id,
      type: form.type,
      title: form.title,
      content: form.content,
      tags,
      embedding: null,
    });

    if (error) { Alert.alert('Error', error); return; }

    setShowAddModal(false);
    setForm({ type: 'idea', title: '', content: '', tags: '' });
    fetchNotes(filterType === 'all' ? undefined : filterType);
  };

  const displayNotes = searchResults !== null ? searchResults : notes;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Second Brain</Text>
        <Text style={styles.subtitle}>Semua catatan penting dalam satu tempat</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari catatan secara semantik..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
              <Text style={{ color: Colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>{searching ? '...' : 'Cari'}</Text>
        </TouchableOpacity>
      </View>

      {/* Type filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <Chip
          label="Semua"
          selected={filterType === 'all'}
          onPress={() => setFilterType('all')}
          color={Colors.primary}
        />
        {NOTE_TYPES.map(t => (
          <Chip
            key={t.key}
            label={`${t.icon} ${t.label}`}
            selected={filterType === t.key}
            onPress={() => setFilterType(filterType === t.key ? 'all' : t.key)}
            color={t.color}
          />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {searchResults !== null && (
          <View style={styles.searchResultHeader}>
            <Text style={styles.searchResultText}>
              {searchResults.length} hasil untuk "{searchQuery}"
            </Text>
          </View>
        )}

        {displayNotes.length === 0 ? (
          <Card style={{ margin: Spacing.base }}>
            <EmptyState
              icon="🧠"
              title={searchResults !== null ? 'Tidak ada hasil' : 'Belum ada catatan'}
              subtitle={searchResults !== null ? 'Coba kata kunci berbeda' : 'Simpan ide, meeting notes, SOP, dll.'}
              action={searchResults === null ? {
                label: 'Buat Catatan',
                onPress: () => setShowAddModal(true),
              } : undefined}
            />
          </Card>
        ) : (
          <View style={styles.notesGrid}>
            {displayNotes.map(note => {
              const noteType = NOTE_TYPES.find(t => t.key === note.type) ?? NOTE_TYPES[0];
              return (
                <TouchableOpacity
                  key={note.id}
                  onPress={() => { setViewNote(note); setShowViewModal(true); }}
                  activeOpacity={0.85}
                >
                  <Card style={[styles.noteCard, { borderLeftColor: noteType.color, borderLeftWidth: 3 }] as any}>
                    <View style={styles.noteTitleRow}>
                      <Text style={styles.noteIcon}>{noteType.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
                        <Text style={styles.noteDate}>
                          {format(new Date(note.created_at), 'd MMM yyyy', { locale: idLocale })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Hapus', 'Yakin hapus catatan ini?', [
                          { text: 'Batal', style: 'cancel' },
                          { text: 'Hapus', style: 'destructive', onPress: () => deleteNote(note.id) },
                        ])}
                        style={styles.deleteBtn}
                      >
                        <Text style={{ color: Colors.textMuted }}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.noteContent} numberOfLines={3}>
                      {note.content}
                    </Text>

                    {note.tags?.length > 0 && (
                      <View style={styles.tagsRow}>
                        {note.tags.slice(0, 3).map((tag: string, i: number) => (
                          <Badge key={i} label={`#${tag}`} size="sm" color={noteType.color} />
                        ))}
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
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

      {/* Add Note Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Catatan Baru</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipe</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                    {NOTE_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          styles.typeChip,
                          form.type === t.key && { backgroundColor: t.color + '33', borderColor: t.color },
                        ]}
                        onPress={() => setForm(f => ({ ...f, type: t.key }))}
                      >
                        <Text>{t.icon}</Text>
                        <Text style={[
                          styles.typeChipText,
                          form.type === t.key && { color: t.color },
                        ]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Judul *</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.title}
                  onChangeText={t => setForm(f => ({ ...f, title: t }))}
                  placeholder="Judul catatan..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Isi *</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={form.content}
                  onChangeText={t => setForm(f => ({ ...f, content: t }))}
                  placeholder="Tulis isi catatan di sini..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tags (pisahkan dengan koma)</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.tags}
                  onChangeText={t => setForm(f => ({ ...f, tags: t }))}
                  placeholder="ide, projek, meeting"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label="Batal" onPress={() => setShowAddModal(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Simpan" onPress={handleCreate} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View Note Modal */}
      <Modal visible={showViewModal && !!viewNote} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            {viewNote && (
              <>
                <View style={styles.viewHeader}>
                  <Text style={styles.viewIcon}>
                    {NOTE_TYPES.find(t => t.key === viewNote.type)?.icon ?? '📝'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewTitle}>{viewNote.title}</Text>
                    <Text style={styles.viewDate}>
                      {format(new Date(viewNote.created_at), "d MMMM yyyy 'pukul' HH:mm", { locale: idLocale })}
                    </Text>
                  </View>
                </View>

                {viewNote.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {viewNote.tags.map((tag: string, i: number) => (
                      <Badge key={i} label={`#${tag}`} size="sm" />
                    ))}
                  </View>
                )}

                <ScrollView style={styles.viewContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.viewContentText}>{viewNote.content}</Text>
                </ScrollView>

                <Button
                  label="Tutup"
                  onPress={() => setShowViewModal(false)}
                  variant="secondary"
                  style={{ marginTop: Spacing.md }}
                />
              </>
            )}
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
  subtitle: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  searchIcon: { fontSize: 16 },
  searchText: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.sm },
  searchBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, justifyContent: 'center',
  },
  searchBtnText: { color: Colors.textInverse, fontWeight: '700', fontSize: Typography.size.sm },
  filterScroll: { marginBottom: Spacing.md },
  filterContent: { paddingHorizontal: Spacing.base, gap: Spacing.xs, flexDirection: 'row' },
  scroll: { paddingBottom: 100 },
  searchResultHeader: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  searchResultText: { fontSize: Typography.size.sm, color: Colors.textMuted },
  notesGrid: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  noteCard: { },
  noteTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  noteIcon: { fontSize: 20, marginTop: 2 },
  noteTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.textPrimary },
  noteDate: { fontSize: Typography.size.xs, color: Colors.textMuted, marginTop: 2 },
  noteContent: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xs },
  tagsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginTop: Spacing.xs },
  deleteBtn: { padding: 4 },
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
  formTextArea: { minHeight: 150, textAlignVertical: 'top' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  typeChipText: { fontSize: Typography.size.xs, color: Colors.textMuted, fontWeight: '600' },
  viewHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.md },
  viewIcon: { fontSize: 32 },
  viewTitle: { fontSize: Typography.size.xl, fontWeight: '800', color: Colors.textPrimary },
  viewDate: { fontSize: Typography.size.xs, color: Colors.textMuted, marginTop: 2 },
  viewContent: { flex: 1, marginTop: Spacing.md },
  viewContentText: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 24 },
});
