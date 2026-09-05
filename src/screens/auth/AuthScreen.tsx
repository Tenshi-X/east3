import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type AuthMode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuthStore();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email dan password wajib diisi');
      return;
    }
    if (mode === 'register' && !displayName) {
      Alert.alert('Error', 'Nama wajib diisi');
      return;
    }

    setLoading(true);
    const { error } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, displayName);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error);
    }
  };

  return (
    <LinearGradient
      colors={['#070F14', '#0D1E27', '#09637E22']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🧠</Text>
            </View>
            <Text style={styles.appName}>east3</Text>
            <Text style={styles.tagline}>Your Personal Life OS</Text>
          </View>

          {/* Tab switcher */}
          <View style={styles.tabSwitcher}>
            {(['login', 'register'] as AuthMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, mode === m && styles.tabActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'login' ? 'Masuk' : 'Daftar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nama Lengkap</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="kamu@email.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.submitBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Buat Akun'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Features preview */}
          <View style={styles.featuresRow}>
            {['📅 Kalender', '💰 Keuangan', '💪 Workout', '✅ Habit', '🧠 Catatan', '🤖 AI'].map(f => (
              <View key={f} style={styles.featureChip}>
                <Text style={styles.featureChipText}>{f}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  logoSection: { alignItems: 'center', gap: Spacing.sm },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    fontSize: Typography.size['4xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: { fontSize: Typography.size.base, color: Colors.textSecondary },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: Typography.size.base, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.textInverse },
  form: { gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  label: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '600', marginLeft: 4 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.size.base,
  },
  submitBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnGradient: { paddingVertical: Spacing.lg, alignItems: 'center' },
  submitBtnText: { color: Colors.textInverse, fontSize: Typography.size.md, fontWeight: '800' },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  featureChip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  featureChipText: { fontSize: Typography.size.sm, color: Colors.textSecondary },
});
