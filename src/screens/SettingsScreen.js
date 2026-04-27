import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { loadSettings, saveSettings, clearAllData } from '../utils/storage';
import { setApiKey } from '../utils/api';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    loadSettings().then(cfg => {
      setSettings(cfg);
      setApiKeyInput(cfg.apiKey || '');
    });
  }, []));

  const handleSave = async (updates) => {
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
    setSettings(newSettings);
    if (updates.apiKey !== undefined) setApiKey(updates.apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all your portfolio, projections, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear Everything', style: 'destructive', onPress: async () => { await clearAllData(); Alert.alert('Done', 'All data cleared.'); } },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>Configure your WealthTracker</Text>
      </LinearGradient>

      {saved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.savedText}>Settings saved!</Text>
        </View>
      )}

      {/* API Key */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Source</Text>
        <Text style={styles.sectionSub}>Connect to Finnhub for live stock prices and news</Text>

        <View style={styles.apiRow}>
          <View style={styles.apiInputWrap}>
            <TextInput
              style={styles.apiInput}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="Enter Finnhub API key"
              placeholderTextColor={colors.textDim}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowApiKey(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showApiKey ? 'eye-off' : 'eye'} size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.saveApiBtn} onPress={() => handleSave({ apiKey: apiKeyInput.trim() })}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveApiBtnGrad}>
              <Text style={styles.saveApiText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://finnhub.io/register')} style={styles.linkRow}>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
          <Text style={styles.linkText}>Get a free API key at finnhub.io</Text>
        </TouchableOpacity>

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.blue} />
          <Text style={styles.infoText}>Without an API key, mock data is shown. Free tier includes 60 calls/min.</Text>
        </View>
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display Currency</Text>
        <Text style={styles.sectionSub}>Choose how amounts are displayed (does not convert values)</Text>
        <View style={styles.currencyGrid}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.code}
              style={[styles.currencyBtn, settings.currency === c.code && styles.activeCurrencyBtn]}
              onPress={() => handleSave({ currency: c.code, currencySymbol: c.symbol })}
            >
              <Text style={[styles.currencySymbol, settings.currency === c.code && { color: colors.primary }]}>{c.symbol}</Text>
              <Text style={[styles.currencyCode, settings.currency === c.code && { color: colors.primary }]}>{c.code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <ToggleRow
          icon="notifications-outline" iconColor={colors.secondary}
          label="Price Notifications" sub="Alert on significant price moves"
          value={settings.notifications !== false}
          onToggle={v => handleSave({ notifications: v })}
        />
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <InfoRow icon="phone-portrait-outline" label="App Version" value="1.0.0" />
        <InfoRow icon="server-outline" label="Data Provider" value="Finnhub.io" />
        <InfoRow icon="shield-checkmark-outline" label="Data Storage" value="Local only" />
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, { borderColor: colors.danger + '44' }]}>
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>Danger Zone</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.dangerText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const ToggleRow = ({ icon, iconColor, label, sub, value, onToggle }) => (
  <View style={styles.toggleRow}>
    <View style={[styles.rowIcon, { backgroundColor: iconColor + '22' }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sub && <Text style={styles.rowSub}>{sub}</Text>}
    </View>
    <Switch value={value} onValueChange={onToggle} trackColor={{ true: colors.primary, false: colors.cardLight }} thumbColor={colors.white} />
  </View>
);

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={colors.textDim} style={{ marginRight: spacing.sm }} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  headerTitle: { ...typography.h1, marginBottom: 4 },
  headerSub: { ...typography.bodySmall },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryGlow, margin: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + '44' },
  savedText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  section: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h4, marginBottom: 4 },
  sectionSub: { ...typography.bodySmall, marginBottom: spacing.md },
  apiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  apiInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  apiInput: { flex: 1, height: 48, ...typography.bodySmall, color: colors.text },
  eyeBtn: { padding: 4 },
  saveApiBtn: { borderRadius: radius.md, overflow: 'hidden' },
  saveApiBtnGrad: { height: 48, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center' },
  saveApiText: { ...typography.bodySmall, color: colors.bg, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  linkText: { ...typography.bodySmall, color: colors.primary },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.blue + '11', padding: spacing.sm, borderRadius: radius.sm },
  infoText: { ...typography.caption, color: colors.textSub, flex: 1, lineHeight: 18 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  currencyBtn: { backgroundColor: colors.cardLight, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minWidth: 60, borderWidth: 1, borderColor: colors.border },
  activeCurrencyBtn: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  currencySymbol: { ...typography.h3, fontSize: 18, color: colors.textSub },
  currencyCode: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  rowSub: { ...typography.caption, color: colors.textDim },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { flex: 1, ...typography.bodySmall, color: colors.textSub },
  infoValue: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerGlow, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '44' },
  dangerText: { ...typography.bodySmall, color: colors.danger, fontWeight: '600' },
});
