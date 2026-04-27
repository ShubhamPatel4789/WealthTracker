import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { loadPortfolio, loadSettings, loadLiquidity, loadTarget } from '../utils/storage';
import { fetchMultipleQuotes, fetchRecommendations, setApiKey } from '../utils/api';
import {
  generateInsights, calcPortfolioValue, formatCurrency,
  formatPercent, calcPortfolioPnL,
} from '../utils/calculations';

const INSIGHT_COLORS = {
  success: { bg: colors.primaryGlow, border: colors.primary + '44', icon: colors.primary },
  warning: { bg: colors.secondaryGlow, border: colors.secondary + '44', icon: colors.secondary },
  opportunity: { bg: 'rgba(78,205,196,0.1)', border: colors.blue + '44', icon: colors.blue },
  action: { bg: 'rgba(168,85,247,0.1)', border: colors.purple + '44', icon: colors.purple },
  info: { bg: colors.card, border: colors.border, icon: colors.textSub },
};

const MARKET_SECTORS = [
  { name: 'Technology', change: +2.4, icon: '💻', outlook: 'bullish' },
  { name: 'Healthcare', change: +0.8, icon: '🏥', outlook: 'neutral' },
  { name: 'Financials', change: +1.2, icon: '🏦', outlook: 'bullish' },
  { name: 'Energy', change: -0.6, icon: '⚡', outlook: 'bearish' },
  { name: 'Real Estate', change: -1.1, icon: '🏘️', outlook: 'bearish' },
  { name: 'Consumer', change: +0.3, icon: '🛒', outlook: 'neutral' },
];

const TOP_MOVERS = [
  { symbol: 'NVDA', change: +3.8, price: 875.42 },
  { symbol: 'META', change: +2.1, price: 512.30 },
  { symbol: 'AMZN', change: +1.9, price: 186.50 },
  { symbol: 'INTC', change: -2.3, price: 31.20 },
  { symbol: 'BA', change: -1.8, price: 182.40 },
];

export default function InsightsScreen() {
  const [insights, setInsights] = useState([]);
  const [recommendations, setRecommendations] = useState({});
  const [portfolio, setPortfolio] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [settings, setSettings] = useState({});
  const [totalWealth, setTotalWealth] = useState(0);
  const [target, setTarget] = useState(100000);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [port, cfg, liq, tgt] = await Promise.all([
      loadPortfolio(), loadSettings(), loadLiquidity(), loadTarget(),
    ]);
    setSettings(cfg);
    setTarget(tgt);
    setPortfolio(port);
    if (cfg.apiKey) setApiKey(cfg.apiKey);

    let q = {};
    if (port.length > 0 && cfg.apiKey) {
      q = await fetchMultipleQuotes(port.map(s => s.symbol));
      setQuotes(q);
      // Fetch recommendations for top 3 holdings
      const recs = {};
      for (const stock of port.slice(0, 3)) {
        const r = await fetchRecommendations(stock.symbol);
        if (r) recs[stock.symbol] = r;
      }
      setRecommendations(recs);
    }

    const portVal = calcPortfolioValue(port, q);
    const wealth = portVal + liq;
    setTotalWealth(wealth);

    const ins = generateInsights(port, q, liq, tgt, wealth);
    setInsights(ins);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sym = settings.currencySymbol || '$';
  const pnl = calcPortfolioPnL(portfolio, quotes);

  const renderInsight = ({ item }) => {
    const style = INSIGHT_COLORS[item.type] || INSIGHT_COLORS.info;
    return (
      <View style={[styles.insightCard, { backgroundColor: style.bg, borderColor: style.border }]}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightIcon}>{item.icon}</Text>
          <Text style={[styles.insightTitle, { color: style.icon }]}>{item.title}</Text>
        </View>
        <Text style={styles.insightMessage}>{item.message}</Text>
        <View style={styles.tags}>
          {item.tags?.map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: style.icon + '22' }]}>
              <Text style={[styles.tagText, { color: style.icon }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
        <Text style={styles.headerSub}>Personalized investment intelligence</Text>
      </LinearGradient>

      {/* Portfolio Health Score */}
      <View style={styles.healthCard}>
        <LinearGradient colors={['#1a2a4a', '#0F1525']} style={styles.healthGradient}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthLabel}>Portfolio Health</Text>
            <Text style={styles.healthScore}>
              {portfolio.length === 0 ? 'N/A' : pnl.percent >= 5 ? 'Strong 💪' : pnl.percent >= 0 ? 'Good 👍' : 'Needs Attention ⚠️'}
            </Text>
            <Text style={styles.healthSub}>
              {portfolio.length} positions · {formatPercent(pnl.percent)} overall
            </Text>
          </View>
          <View style={styles.healthRight}>
            <View style={styles.healthRing}>
              <Text style={[styles.healthPct, { color: pnl.percent >= 0 ? colors.primary : colors.danger }]}>
                {Math.abs(pnl.percent).toFixed(1)}%
              </Text>
              <Text style={styles.healthPctLabel}>P&L</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Market Sectors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sector Performance</Text>
        <Text style={styles.sectionSub}>Today's market movements</Text>
        <View style={styles.sectorsGrid}>
          {MARKET_SECTORS.map(sector => (
            <View key={sector.name} style={styles.sectorCard}>
              <Text style={styles.sectorIcon}>{sector.icon}</Text>
              <Text style={styles.sectorName}>{sector.name}</Text>
              <Text style={[styles.sectorChange, { color: sector.change >= 0 ? colors.primary : colors.danger }]}>
                {sector.change >= 0 ? '+' : ''}{sector.change}%
              </Text>
              <View style={[styles.outlookBadge, {
                backgroundColor: sector.outlook === 'bullish' ? colors.primaryGlow : sector.outlook === 'bearish' ? colors.dangerGlow : colors.secondaryGlow
              }]}>
                <Text style={[styles.outlookText, {
                  color: sector.outlook === 'bullish' ? colors.primary : sector.outlook === 'bearish' ? colors.danger : colors.secondary
                }]}>{sector.outlook}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Top Movers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Top Movers</Text>
        {TOP_MOVERS.map(mover => (
          <View key={mover.symbol} style={styles.moverRow}>
            <View style={styles.moverIcon}>
              <Text style={styles.moverIconText}>{mover.symbol.slice(0, 2)}</Text>
            </View>
            <Text style={styles.moverSymbol}>{mover.symbol}</Text>
            <View style={styles.moverBar}>
              <View style={[styles.moverFill, {
                width: `${Math.min(Math.abs(mover.change) * 10, 100)}%`,
                backgroundColor: mover.change >= 0 ? colors.primary : colors.danger,
                alignSelf: mover.change >= 0 ? 'flex-start' : 'flex-end',
              }]} />
            </View>
            <Text style={[styles.moverChange, { color: mover.change >= 0 ? colors.primary : colors.danger }]}>
              {mover.change >= 0 ? '+' : ''}{mover.change}%
            </Text>
          </View>
        ))}
      </View>

      {/* Analyst Recommendations for Portfolio */}
      {Object.keys(recommendations).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analyst Consensus</Text>
          <Text style={styles.sectionSub}>Latest recommendations for your holdings</Text>
          {Object.entries(recommendations).map(([symbol, recs]) => {
            if (!recs || recs.length === 0) return null;
            const latest = recs[0];
            const total = latest.total || 1;
            const buyPct = ((latest.strongBuy + latest.buy) / total) * 100;
            const holdPct = (latest.hold / total) * 100;
            const sellPct = ((latest.sell + latest.strongSell) / total) * 100;
            return (
              <View key={symbol} style={styles.recCard}>
                <View style={styles.recHeader}>
                  <Text style={styles.recSymbol}>{symbol}</Text>
                  <Text style={styles.recPeriod}>{latest.period}</Text>
                  <Text style={styles.recAnalysts}>{total} analysts</Text>
                </View>
                <View style={styles.recBar}>
                  <View style={[styles.recFill, { flex: buyPct, backgroundColor: colors.primary }]} />
                  <View style={[styles.recFill, { flex: holdPct, backgroundColor: colors.secondary }]} />
                  <View style={[styles.recFill, { flex: sellPct, backgroundColor: colors.danger }]} />
                </View>
                <View style={styles.recLabels}>
                  <Text style={[styles.recLabel, { color: colors.primary }]}>Buy {buyPct.toFixed(0)}%</Text>
                  <Text style={[styles.recLabel, { color: colors.secondary }]}>Hold {holdPct.toFixed(0)}%</Text>
                  <Text style={[styles.recLabel, { color: colors.danger }]}>Sell {sellPct.toFixed(0)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Personalized Insights */}
      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>Personalized Insights</Text>
        <Text style={styles.sectionSub}>{insights.length} insights based on your portfolio</Text>
        {insights.map((insight, i) => renderInsight({ item: insight, key: i }))}
      </View>

      {/* Investment Ideas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Investment Ideas</Text>
        <Text style={styles.sectionSub}>Potential opportunities to consider</Text>
        {[
          { ticker: 'SPY', name: 'S&P 500 ETF', type: 'ETF', risk: 'Low', reason: 'Broad market exposure with low fees' },
          { ticker: 'QQQ', name: 'Nasdaq 100 ETF', type: 'ETF', risk: 'Medium', reason: 'Top 100 tech & growth companies' },
          { ticker: 'BRK.B', name: 'Berkshire Hathaway', type: 'Stock', risk: 'Low', reason: 'Diversified value investing approach' },
          { ticker: 'VTI', name: 'Total Market ETF', type: 'ETF', risk: 'Low', reason: 'Entire US stock market in one fund' },
        ].map(idea => (
          <View key={idea.ticker} style={styles.ideaCard}>
            <View style={styles.ideaLeft}>
              <View style={styles.ideaIcon}>
                <Text style={styles.ideaIconText}>{idea.ticker.slice(0, 2)}</Text>
              </View>
              <View>
                <Text style={styles.ideaTicker}>{idea.ticker}</Text>
                <Text style={styles.ideaName}>{idea.name}</Text>
              </View>
            </View>
            <View style={styles.ideaRight}>
              <View style={[styles.riskBadge, {
                backgroundColor: idea.risk === 'Low' ? colors.primaryGlow : idea.risk === 'Medium' ? colors.secondaryGlow : colors.dangerGlow
              }]}>
                <Text style={[styles.riskText, {
                  color: idea.risk === 'Low' ? colors.primary : idea.risk === 'Medium' ? colors.secondary : colors.danger
                }]}>{idea.risk} Risk</Text>
              </View>
            </View>
            <Text style={styles.ideaReason}>{idea.reason}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  headerTitle: { ...typography.h1, marginBottom: 4 },
  headerSub: { ...typography.bodySmall },
  healthCard: { marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder },
  healthGradient: { padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthLeft: {},
  healthLabel: { ...typography.caption, color: colors.textSub, marginBottom: 4 },
  healthScore: { ...typography.h2, fontSize: 20 },
  healthSub: { ...typography.bodySmall, color: colors.textSub, marginTop: 4 },
  healthRight: {},
  healthRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primaryGlow },
  healthPct: { ...typography.h3, fontSize: 16 },
  healthPctLabel: { ...typography.caption, color: colors.textDim },
  section: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h3, marginBottom: 4 },
  sectionSub: { ...typography.bodySmall, marginBottom: spacing.md },
  sectorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectorCard: { width: '30%', backgroundColor: colors.cardLight, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  sectorIcon: { fontSize: 22, marginBottom: 4 },
  sectorName: { ...typography.caption, color: colors.textSub, textAlign: 'center', marginBottom: 2 },
  sectorChange: { ...typography.bodySmall, fontWeight: '700' },
  outlookBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  outlookText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  moverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  moverIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.cardLight, justifyContent: 'center', alignItems: 'center' },
  moverIconText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  moverSymbol: { width: 50, ...typography.h4, fontSize: 13 },
  moverBar: { flex: 1, height: 6, backgroundColor: colors.cardLight, borderRadius: 3, overflow: 'hidden' },
  moverFill: { height: '100%', borderRadius: 3 },
  moverChange: { width: 55, ...typography.bodySmall, fontWeight: '700', textAlign: 'right' },
  recCard: { marginBottom: spacing.sm, backgroundColor: colors.cardLight, borderRadius: radius.md, padding: spacing.sm },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  recSymbol: { ...typography.h4, color: colors.primary },
  recPeriod: { ...typography.caption, flex: 1 },
  recAnalysts: { ...typography.caption, color: colors.textDim },
  recBar: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', marginBottom: 6 },
  recFill: { height: '100%' },
  recLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  recLabel: { ...typography.caption, fontWeight: '600' },
  insightsSection: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  insightCard: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  insightIcon: { fontSize: 22 },
  insightTitle: { ...typography.h4 },
  insightMessage: { ...typography.body, color: colors.textSub, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  tagText: { ...typography.caption, fontWeight: '600' },
  ideaCard: { backgroundColor: colors.cardLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexWrap: 'wrap' },
  ideaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  ideaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryGlow, justifyContent: 'center', alignItems: 'center' },
  ideaIconText: { fontWeight: '800', color: colors.primary, fontSize: 13 },
  ideaTicker: { ...typography.h4, color: colors.white },
  ideaName: { ...typography.caption, color: colors.textSub },
  ideaRight: { marginBottom: 8 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  riskText: { ...typography.caption, fontWeight: '700' },
  ideaReason: { ...typography.bodySmall, color: colors.textSub, width: '100%', marginTop: 6 },
});
