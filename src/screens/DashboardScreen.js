import React, { useState, useCallback, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography, shadows } from '../theme';
import {
  loadPortfolio, loadLiquidity, loadTarget, loadSettings,
  saveLiquidity, saveTarget,
} from '../utils/storage';
import { fetchMultipleQuotes, setApiKey } from '../utils/api';
import {
  calcPortfolioValue, calcPortfolioPnL, calcDailyChange,
  calcTargetProgress, formatCurrency, formatPercent,
  formatMonths, monthsToTarget,
} from '../utils/calculations';
import { AppContext } from '../../App';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { refresh } = useContext(AppContext);
  const [portfolio, setPortfolio] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [liquidity, setLiquidity] = useState(0);
  const [target, setTarget] = useState(100000);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liquidityModal, setLiquidityModal] = useState(false);
  const [targetModal, setTargetModal] = useState(false);
  const [tempLiquidity, setTempLiquidity] = useState('');
  const [tempTarget, setTempTarget] = useState('');
  const [marketOpen, setMarketOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [port, liq, tgt, cfg] = await Promise.all([
      loadPortfolio(), loadLiquidity(), loadTarget(), loadSettings(),
    ]);
    setLiquidity(liq);
    setTarget(tgt);
    setSettings(cfg);
    setPortfolio(port);
    if (cfg.apiKey) {
      setApiKey(cfg.apiKey);
      if (port.length > 0) {
        const syms = port.map(s => s.symbol);
        const q = await fetchMultipleQuotes(syms);
        setQuotes(q);
      }
    }
    const now = new Date();
    const hour = now.getHours();
    setMarketOpen(hour >= 9 && hour < 17);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData, refresh]));

  const portfolioValue = calcPortfolioValue(portfolio, quotes);
  const totalWealth = portfolioValue + liquidity;
  const pnl = calcPortfolioPnL(portfolio, quotes);
  const dailyChange = calcDailyChange(portfolio, quotes);
  const progress = calcTargetProgress(totalWealth, target);
  const sym = settings.currencySymbol || '$';

  const topHoldings = portfolio
    .map(s => ({ ...s, value: (quotes[s.symbol]?.current || s.avgPrice) * s.shares, change: quotes[s.symbol]?.changePercent || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()} 👋</Text>
            <Text style={styles.subtitle}>Your financial overview</Text>
          </View>
          <View style={styles.marketBadge}>
            <View style={[styles.dot, { backgroundColor: marketOpen ? colors.primary : colors.danger }]} />
            <Text style={styles.marketText}>{marketOpen ? 'Market Open' : 'Market Closed'}</Text>
          </View>
        </View>

        {/* Net Worth Card */}
        <LinearGradient colors={['#1E3A5F', '#0F2040']} style={styles.wealthCard}>
          <Text style={styles.wealthLabel}>Total Net Worth</Text>
          <Text style={styles.wealthValue}>{formatCurrency(totalWealth, sym)}</Text>
          <View style={styles.wealthRow}>
            <View style={styles.wealthStat}>
              <Text style={styles.wealthStatLabel}>Daily Change</Text>
              <Text style={[styles.wealthStatValue, { color: dailyChange.absolute >= 0 ? colors.primary : colors.danger }]}>
                {formatCurrency(Math.abs(dailyChange.absolute), sym)} ({formatPercent(dailyChange.percent)})
              </Text>
            </View>
            <View style={styles.wealthStat}>
              <Text style={styles.wealthStatLabel}>Total P&L</Text>
              <Text style={[styles.wealthStatValue, { color: pnl.absolute >= 0 ? colors.primary : colors.danger }]}>
                {formatCurrency(Math.abs(pnl.absolute), sym)} ({formatPercent(pnl.percent)})
              </Text>
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => { setTempLiquidity(String(liquidity)); setLiquidityModal(true); }}>
          <Ionicons name="wallet-outline" size={20} color={colors.secondary} />
          <Text style={styles.statLabel}>Cash</Text>
          <Text style={styles.statValue}>{formatCurrency(liquidity, sym)}</Text>
          <Text style={styles.statEdit}>Tap to edit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Portfolio')}>
          <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
          <Text style={styles.statLabel}>Portfolio</Text>
          <Text style={styles.statValue}>{formatCurrency(portfolioValue, sym)}</Text>
          <Text style={styles.statEdit}>{portfolio.length} stocks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => { setTempTarget(String(target)); setTargetModal(true); }}>
          <Ionicons name="flag-outline" size={20} color={colors.purple} />
          <Text style={styles.statLabel}>Target</Text>
          <Text style={styles.statValue}>{formatCurrency(target, sym)}</Text>
          <Text style={styles.statEdit}>Tap to set</Text>
        </TouchableOpacity>
      </View>

      {/* Target Progress */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Target Progress</Text>
          <Text style={styles.sectionSub}>{progress.toFixed(1)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{formatCurrency(totalWealth, sym)}</Text>
          <Text style={styles.progressLabel}>{formatCurrency(target, sym)}</Text>
        </View>
        <Text style={styles.progressHint}>
          {progress >= 100
            ? '🎉 You have reached your target!'
            : `${formatCurrency(target - totalWealth, sym)} remaining`}
        </Text>
      </View>

      {/* Top Holdings */}
      {topHoldings.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Holdings</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {topHoldings.map(stock => (
            <View key={stock.symbol} style={styles.holdingRow}>
              <View style={styles.holdingIcon}>
                <Text style={styles.holdingIconText}>{stock.symbol.slice(0, 2)}</Text>
              </View>
              <View style={styles.holdingInfo}>
                <Text style={styles.holdingSymbol}>{stock.symbol}</Text>
                <Text style={styles.holdingShares}>{stock.shares} shares</Text>
              </View>
              <View style={styles.holdingValues}>
                <Text style={styles.holdingValue}>{formatCurrency(stock.value, sym)}</Text>
                <Text style={[styles.holdingChange, { color: stock.change >= 0 ? colors.primary : colors.danger }]}>
                  {formatPercent(stock.change)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Portfolio')}>
          <LinearGradient colors={[colors.cardLight, colors.card]} style={styles.actionGradient}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.actionText}>Add Stock</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Projector')}>
          <LinearGradient colors={[colors.cardLight, colors.card]} style={styles.actionGradient}>
            <Ionicons name="calculator-outline" size={24} color={colors.secondary} />
            <Text style={styles.actionText}>Projector</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('News')}>
          <LinearGradient colors={[colors.cardLight, colors.card]} style={styles.actionGradient}>
            <Ionicons name="newspaper-outline" size={24} color={colors.blue} />
            <Text style={styles.actionText}>News</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Insights')}>
          <LinearGradient colors={[colors.cardLight, colors.card]} style={styles.actionGradient}>
            <Ionicons name="bulb-outline" size={24} color={colors.warning} />
            <Text style={styles.actionText}>Insights</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />

      {/* Liquidity Modal */}
      <Modal visible={liquidityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Cash Balance</Text>
            <Text style={styles.modalSub}>Enter your current liquid cash/savings</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>{sym}</Text>
              <TextInput
                style={styles.input}
                value={tempLiquidity}
                onChangeText={setTempLiquidity}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                autoFocus
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLiquidityModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={async () => {
                const val = parseFloat(tempLiquidity) || 0;
                await saveLiquidity(val);
                setLiquidity(val);
                setLiquidityModal(false);
              }}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGrad}>
                  <Text style={styles.saveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Target Modal */}
      <Modal visible={targetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Financial Target</Text>
            <Text style={styles.modalSub}>How much wealth do you want to reach?</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>{sym}</Text>
              <TextInput
                style={styles.input}
                value={tempTarget}
                onChangeText={setTempTarget}
                keyboardType="decimal-pad"
                placeholder="100000"
                placeholderTextColor={colors.textDim}
                autoFocus
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTargetModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={async () => {
                const val = parseFloat(tempTarget) || 100000;
                await saveTarget(val);
                setTarget(val);
                setTargetModal(false);
              }}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGrad}>
                  <Text style={styles.saveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: spacing.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  greeting: { ...typography.h2, fontSize: 20 },
  subtitle: { ...typography.bodySmall, marginTop: 2 },
  marketBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  marketText: { ...typography.caption, fontSize: 12, color: colors.textSub },
  wealthCard: { borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
  wealthLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  wealthValue: { fontSize: 36, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  wealthRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg },
  wealthStat: {},
  wealthStatLabel: { ...typography.caption, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  wealthStatValue: { ...typography.h4, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statLabel: { ...typography.caption, marginTop: 6, marginBottom: 2 },
  statValue: { ...typography.h4, fontSize: 13, color: colors.white },
  statEdit: { ...typography.caption, color: colors.primary, marginTop: 2 },
  section: { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h4 },
  sectionSub: { ...typography.bodySmall, color: colors.primary },
  seeAll: { ...typography.bodySmall, color: colors.primary },
  progressBar: { height: 10, backgroundColor: colors.cardLight, borderRadius: radius.full, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: radius.full },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...typography.caption, color: colors.textDim },
  progressHint: { ...typography.caption, color: colors.textSub, textAlign: 'center', marginTop: 8 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  holdingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  holdingIconText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  holdingInfo: { flex: 1 },
  holdingSymbol: { ...typography.h4, fontSize: 14 },
  holdingShares: { ...typography.caption },
  holdingValues: { alignItems: 'flex-end' },
  holdingValue: { ...typography.h4, fontSize: 14 },
  holdingChange: { ...typography.caption, fontWeight: '600', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  actionBtn: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  actionGradient: { padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  actionText: { ...typography.caption, color: colors.textSub, marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalTitle: { ...typography.h3, marginBottom: 4 },
  modalSub: { ...typography.bodySmall, marginBottom: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  inputPrefix: { ...typography.h3, color: colors.textSub, marginRight: 8 },
  input: { flex: 1, height: 56, ...typography.h3, color: colors.text },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 52, backgroundColor: colors.cardLight, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  cancelText: { ...typography.h4, color: colors.textSub },
  saveBtn: { flex: 2, borderRadius: radius.md, overflow: 'hidden' },
  saveBtnGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
  saveText: { ...typography.h4, color: colors.bg },
});
