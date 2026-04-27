import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Linking, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { loadPortfolio, loadSettings } from '../utils/storage';
import { fetchStockNews, fetchMarketNews, setApiKey } from '../utils/api';
import { formatTimeAgo } from '../utils/calculations';

const TABS = ['My Stocks', 'Market', 'Crypto'];

export default function NewsScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [portfolio, setPortfolio] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [newsMap, setNewsMap] = useState({});
  const [marketNews, setMarketNews] = useState([]);
  const [cryptoNews, setCryptoNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [port, cfg] = await Promise.all([loadPortfolio(), loadSettings()]);
    setPortfolio(port);
    if (cfg.apiKey) setApiKey(cfg.apiKey);

    // Market news
    const mNews = await fetchMarketNews('general');
    setMarketNews(mNews);

    // Crypto news
    const cNews = await fetchMarketNews('crypto');
    setCryptoNews(cNews);

    // Stock news for each portfolio position
    if (port.length > 0) {
      const map = {};
      const first = port[0].symbol;
      setSelectedSymbol(first);
      for (const stock of port) {
        const news = await fetchStockNews(stock.symbol);
        map[stock.symbol] = news;
      }
      setNewsMap(map);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const getSentimentColor = (s) => {
    if (s === 'positive') return colors.primary;
    if (s === 'negative') return colors.danger;
    return colors.textDim;
  };

  const getSentimentIcon = (s) => {
    if (s === 'positive') return 'trending-up';
    if (s === 'negative') return 'trending-down';
    return 'remove';
  };

  const renderNewsCard = ({ item }) => (
    <TouchableOpacity
      style={styles.newsCard}
      onPress={() => item.url && item.url !== '#' && Linking.openURL(item.url)}
      activeOpacity={0.85}
    >
      <View style={styles.newsCardContent}>
        <View style={styles.newsMeta}>
          <View style={[styles.sentimentBadge, { backgroundColor: getSentimentColor(item.sentiment) + '22' }]}>
            <Ionicons name={getSentimentIcon(item.sentiment)} size={12} color={getSentimentColor(item.sentiment)} />
            <Text style={[styles.sentimentText, { color: getSentimentColor(item.sentiment) }]}>
              {item.sentiment}
            </Text>
          </View>
          <Text style={styles.newsSource}>{item.source}</Text>
          <Text style={styles.newsTime}>{formatTimeAgo(item.datetime)}</Text>
        </View>

        <Text style={styles.newsHeadline} numberOfLines={3}>{item.headline}</Text>

        {item.summary ? (
          <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
        ) : null}

        {item.url && item.url !== '#' && (
          <View style={styles.readMore}>
            <Text style={styles.readMoreText}>Read full article</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[typography.bodySmall, { marginTop: 12, color: colors.textSub }]}>Loading news...</Text>
    </View>
  );

  const currentNews = (() => {
    if (activeTab === 1) return marketNews;
    if (activeTab === 2) return cryptoNews;
    if (selectedSymbol && newsMap[selectedSymbol]) return newsMap[selectedSymbol];
    return [];
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
        <Text style={styles.headerTitle}>Market News</Text>
        <Text style={styles.headerSub}>Stay informed on your investments</Text>

        {/* Tab Bar */}
        <View style={styles.tabs}>
          {TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === i && styles.activeTab]} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabText, activeTab === i && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Stock Symbol Selector (for My Stocks tab) */}
      {activeTab === 0 && portfolio.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolsScroll} contentContainerStyle={styles.symbolsContent}>
          {portfolio.map(stock => (
            <TouchableOpacity
              key={stock.symbol}
              style={[styles.symbolChip, selectedSymbol === stock.symbol && styles.activeSymbolChip]}
              onPress={() => setSelectedSymbol(stock.symbol)}
            >
              <Text style={[styles.symbolChipText, selectedSymbol === stock.symbol && styles.activeSymbolChipText]}>
                {stock.symbol}
              </Text>
              {newsMap[stock.symbol] && (
                <View style={styles.newsDot}>
                  <Text style={styles.newsDotText}>{newsMap[stock.symbol].length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Empty state for My Stocks with no portfolio */}
      {activeTab === 0 && portfolio.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="newspaper-outline" size={64} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No stocks in portfolio</Text>
          <Text style={styles.emptyText}>Add stocks to your portfolio to see relevant news here</Text>
        </View>
      ) : (
        <FlatList
          data={currentNews}
          keyExtractor={(item) => String(item.id || item.headline)}
          renderItem={renderNewsCard}
          contentContainerStyle={styles.newsList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            activeTab === 0 && selectedSymbol ? (
              <View style={styles.newsHeader}>
                <Text style={styles.newsHeaderText}>
                  {newsMap[selectedSymbol]?.length || 0} articles for {selectedSymbol}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No news available</Text>
              <Text style={styles.emptyText}>
                {!loadSettings.apiKey ? 'Add your Finnhub API key in Settings to see live news' : 'Pull down to refresh'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingBottom: 0, paddingHorizontal: spacing.md },
  headerTitle: { ...typography.h1, marginBottom: 4 },
  headerSub: { ...typography.bodySmall, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: 4, marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  activeTab: { backgroundColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSub, fontWeight: '600' },
  activeTabText: { color: colors.bg, fontWeight: '700' },
  symbolsScroll: { maxHeight: 56, backgroundColor: colors.bgSecondary },
  symbolsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  symbolChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  activeSymbolChip: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  symbolChipText: { ...typography.bodySmall, color: colors.textSub, fontWeight: '600' },
  activeSymbolChipText: { color: colors.primary },
  newsDot: { backgroundColor: colors.primary, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  newsDotText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
  newsList: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  newsHeader: { marginBottom: spacing.sm },
  newsHeaderText: { ...typography.bodySmall, color: colors.textDim },
  newsCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  newsCardContent: { padding: spacing.md },
  newsMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sentimentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, gap: 4 },
  sentimentText: { ...typography.caption, fontWeight: '700', textTransform: 'capitalize' },
  newsSource: { ...typography.caption, color: colors.textSub, fontWeight: '600' },
  newsTime: { ...typography.caption, color: colors.textDim, marginLeft: 'auto' },
  newsHeadline: { ...typography.h4, lineHeight: 22, marginBottom: 6 },
  newsSummary: { ...typography.bodySmall, color: colors.textSub, lineHeight: 20 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  readMoreText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, paddingTop: 60 },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSub, textAlign: 'center', lineHeight: 22 },
});
