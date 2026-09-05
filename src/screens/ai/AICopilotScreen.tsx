import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useAIStore } from '../../stores/aiStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { Card, Button } from '../../components/ui';

const QUICK_PROMPTS = [
  '🌅 Buat morning brief hari ini',
  '💰 Catat pengeluaran makan 50rb',
  '📅 Jadwalkan meeting besok jam 10',
  '💪 Log bench press 80kg 8 reps',
  '🧠 Simpan ide: "Buat startup X"',
  '📊 Gimana kondisi keuangan bulan ini?',
];

export function AICopilotScreen({ navigation }: any) {
  const { session } = useAuthStore();
  const {
    conversations, activeConversation, messages, streaming, loading,
    fetchConversations, startConversation, loadConversation,
    sendMessage, deleteConversation, fetchActionLogs, actionLogs, undoLastAction,
  } = useAIStore();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchConversations();
    fetchActionLogs(10);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    let convId = activeConversation?.id;
    if (!convId) {
      const { id } = await startConversation();
      convId = id ?? undefined;
    }

    if (!convId) return;

    const text = input.trim();
    setInput('');
    await sendMessage(convId, text);
  };

  const handleNewChat = async () => {
    const { id } = await startConversation();
    if (id) await loadConversation(id);
    setShowHistory(false);
  };

  const handleUndo = async () => {
    Alert.alert('Batalkan Aksi', 'Batalkan aksi AI terakhir?', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, Batalkan',
        style: 'destructive',
        onPress: async () => {
          const { error } = await undoLastAction();
          if (error) Alert.alert('Error', error);
        },
      },
    ]);
  };

  const lastUndoableAction = actionLogs.find(l => !l.is_undone);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Copilot</Text>
          <Text style={styles.subtitle}>
            {activeConversation?.title ?? 'Percakapan baru'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {lastUndoableAction && (
            <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
              <Text style={styles.undoBtnText}>↩ Undo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => setShowHistory(v => !v)}
          >
            <Text style={styles.historyBtnText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
            <Text style={styles.newChatBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat History Sidebar */}
      {showHistory && (
        <View style={styles.historySidebar}>
          <Text style={styles.historyTitle}>Riwayat Chat</Text>
          <ScrollView>
            {conversations.map(conv => (
              <TouchableOpacity
                key={conv.id}
                style={[
                  styles.historyItem,
                  conv.id === activeConversation?.id && styles.historyItemActive,
                ]}
                onPress={() => {
                  loadConversation(conv.id);
                  setShowHistory(false);
                }}
              >
                <Text style={styles.historyItemTitle} numberOfLines={1}>
                  {conv.title}
                </Text>
                <Text style={styles.historyItemDate}>
                  {format(new Date(conv.updated_at), 'd MMM', { locale: idLocale })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messagesContent}
        style={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeEmoji}>🤖</Text>
            <Text style={styles.welcomeTitle}>Hei! Aku east3 AI Copilot</Text>
            <Text style={styles.welcomeText}>
              Aku bisa membantu mencatat pengeluaran, menjadwalkan acara, log workout, dan banyak lagi.
              Cukup ketik dalam bahasa natural!
            </Text>

            <View style={styles.quickPrompts}>
              <Text style={styles.quickPromptsTitle}>Coba tanya:</Text>
              {QUICK_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickPrompt}
                  onPress={() => setInput(prompt.replace(/^[^\w]*/, ''))}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, index) => (
          <View
            key={msg.id}
            style={[
              styles.msgBubble,
              msg.role === 'user' ? styles.msgUser : styles.msgAssistant,
            ]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.msgAvatar}>
                <Text style={styles.msgAvatarText}>🤖</Text>
              </View>
            )}
            <View style={[
              styles.msgContent,
              msg.role === 'user' ? styles.msgContentUser : styles.msgContentAssistant,
            ]}>
              <Text style={[
                styles.msgText,
                msg.role === 'user' ? styles.msgTextUser : styles.msgTextAssistant,
              ]}>
                {msg.content}
              </Text>
              <Text style={[
                styles.msgTime,
                msg.role === 'user' ? styles.msgTimeUser : styles.msgTimeAssistant,
              ]}>
                {format(new Date(msg.created_at), 'HH:mm')}
              </Text>
            </View>
          </View>
        ))}

        {streaming && (
          <View style={[styles.msgBubble, styles.msgAssistant]}>
            <View style={styles.msgAvatar}>
              <Text style={styles.msgAvatarText}>🤖</Text>
            </View>
            <View style={[styles.msgContent, styles.msgContentAssistant]}>
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
              </View>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.lg }} />
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ketik perintah atau pertanyaan..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (streaming || !input.trim()) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={streaming || !input.trim()}
          >
            {streaming ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick prompts horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          contentContainerStyle={{ gap: Spacing.xs, paddingHorizontal: Spacing.xs }}
        >
          {['Pengeluaran hari ini', 'Jadwal minggu ini', 'Recap workout', 'Cari catatan'].map(q => (
            <TouchableOpacity
              key={q}
              style={styles.quickChip}
              onPress={() => setInput(q)}
            >
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  title: { fontSize: Typography.size.xl, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  undoBtn: {
    backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  undoBtnText: { color: Colors.danger, fontSize: Typography.size.xs, fontWeight: '700' },
  historyBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  historyBtnText: { fontSize: 18 },
  newChatBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  newChatBtnText: { color: Colors.textInverse, fontSize: 20, fontWeight: '300' },
  historySidebar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    maxHeight: 240,
    padding: Spacing.base,
  },
  historyTitle: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm,
  },
  historyItemActive: { backgroundColor: Colors.primary + '22' },
  historyItemTitle: { fontSize: Typography.size.sm, color: Colors.textPrimary, flex: 1 },
  historyItemDate: { fontSize: Typography.size.xs, color: Colors.textMuted },
  messages: { flex: 1 },
  messagesContent: { padding: Spacing.base, paddingBottom: Spacing.lg },
  welcomeSection: { alignItems: 'center', paddingTop: Spacing['3xl'], paddingHorizontal: Spacing.md, gap: Spacing.md },
  welcomeEmoji: { fontSize: 64 },
  welcomeTitle: { fontSize: Typography.size.xl, fontWeight: '800', color: Colors.textPrimary },
  welcomeText: { fontSize: Typography.size.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  quickPrompts: { width: '100%', gap: Spacing.xs, marginTop: Spacing.md },
  quickPromptsTitle: { fontSize: Typography.size.sm, color: Colors.textMuted, fontWeight: '700' },
  quickPrompt: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  quickPromptText: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  msgBubble: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  msgUser: { justifyContent: 'flex-end' },
  msgAssistant: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  msgAvatarText: { fontSize: 16 },
  msgContent: { maxWidth: '80%', borderRadius: BorderRadius.xl, padding: Spacing.md },
  msgContentUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  msgContentAssistant: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: Typography.size.base, lineHeight: 22 },
  msgTextUser: { color: Colors.textInverse },
  msgTextAssistant: { color: Colors.textPrimary },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeUser: { color: Colors.textInverse + 'AA', textAlign: 'right' },
  msgTimeAssistant: { color: Colors.textMuted },
  typingIndicator: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  typingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  inputContainer: {
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.textPrimary, fontSize: Typography.size.base,
    maxHeight: 120, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: Colors.textInverse, fontSize: 20, fontWeight: '700' },
  quickRow: { marginTop: Spacing.xs },
  quickChip: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  quickChipText: { fontSize: Typography.size.xs, color: Colors.textSecondary },
});
