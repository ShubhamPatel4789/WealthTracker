import React, { useState, useCallback, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { loadPortfolio, savePortfolio, loadSettings, loadLiquidity, saveLiquidity } from '../utils/storage';
import { fetchMultipleQuotes, searchSymbol, setApiKey } from '../utils/api';
import {
  calcPortfolioValue, calcPortfolioCost, calcPortfolioPnL,
  calcDiversification, formatCurrency, formatPercent,
} from '../utils/calculations';
import { AppContext } from '../../App';

export default function PortfolioScreen() {
  const { triggerRefresh } = useContext(AppContext);
  const [portfolio, setPortfolio] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [liquidity, setLiquidity] = useState(0);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editLiqModal, setEditLiqModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [shares, setShares] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [tempLiq, setTempLiq] = useState('');

  const loadData = useCallback(async () => {
    const [port, liq, cfg] = await Promise.all([loadPortfolio(), loadLiquidity(), loadSettings()]);
    setLiquidity(liq);
    setSettings(cfg);
    setPortfolio(port);
    if (cfg.apiKey) {
      setApiKey(cfg.apiKey);
      if (port.length > 0) {
        const q = await fetchMultipleQuotes(port.map(s => s.symbol));
        setQuotes(q);
      }
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sym = settings.currencySymbol || '$';
  const totalValue = calcPortfolioValue(portfolio, quotes);
  const totalCost = calcPortfolioCost(portfolio);
  const pnl = calcPortfolioPnL(portfolio, quotes);
  const diversity = calcDiversification(portfolio, quotes);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const res = await searchSymbol(q);
    setSearchResults(res);
    setSearching(false);
  };

  const handleSelectStock = (result) => {
    setSelectedStock(result);
    setSearchQuery(result.symbol);
    setSearchResults([]);
  };

  const handleAddStock = async () => {
    if (!selectedStock && !searchQuery) return;
    const symbol = (selectedStock?.symbol || searchQuery).toUpperCase().trim();
    const sharesNum = parseFloat(shares);
    const priceNum = parseFloat(avgPrice);
    if (!symbol || isNaN(sharesNum) || sharesNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid shares and average price.'); return;
    }
    const existing = portfolio.findIndex(s => s.symbol === symbol);
    const newPortfolio = [...portfolio];
    if (existing >= 0) {
      const old = newPortfolio[existing];
      const totalShares = old.shares + sharesNum;
      const totalCostVal = (old.shares * old.avgPrice) + (sharesNum * priceNum);
      newPortfolio[existing] = { ...old, shares: totalShares, avgPrice: totalCostVal / totalShares };
    } else {
      newPortfolio.push({
        id: Date.now().toString(),
        symbol,
        name: selectedStock?.description || symbol,
        shares: sharesNum,
        avgPrice: priceNum,
        addedAt: Date.now(),
      });
    }
    await savePortfolio(newPortfolio);
    setPortfolio(newPortfolio);
    if (settings.apiKey) {
      const q = await fetchMultipleQuotes([symbol]);
      setQuotes(prev => ({ ...prev, ...q }));
    }
    setAddModal(false);
    setSearchQuery(''); setSelectedStock(null); setShares(''); setAvgPrice('');
    triggerRefresh();
  };

  const handleRemoveStock = (symbol) => {
    Alert.alert('Remove Stock', `Remove ${symbol} from your portfolio?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = portfolio.filter(s => s.symbol !== symbol);
          await savePortfolio(updated);
          setPortfolio(updated);
          triggerRefresh();
        }
      },
    ]);
  };

  const handleUpdateLiquidity = async () => {
    const val = parseFloat(tempLiq) || 0;
    await saveLiquidity(val);
    setLiquidity(val);
    setEditLiqModal(false);
    triggerRefresh();
  };

  const renderStock = ({ item }) => {
    const q = quotes[item.symbol];
    const currentPrice = q?.current || item.avgPrice;
    const value = currentPrice * item.shares;
    const cost = item.avgPrice * item.shares;
    const gainLoss = value - cost;
    const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;
    const dayChange = q?.changePercent || 0;
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;

    return (
      <View style={styles.stockCard}>
        <View style={styles.stockHeader}>
          <View style={styles.stockIcon}>
            <Text style={styles.stockIconText}>{item.symbol.slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stockSymbol}>{item.symbol}</Text>
            <Text style={styles.stockName} numberOfLines={1}>{item.name || item.symbol}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.stockPrice}>{formatCurrency(currentPrice, sym)}</Text>
            <Text style={[styles.stockDayChange, { color: dayChange >= 0 ? colors.primary : colors.danger }]}>
              {formatPercent(dayChange)} today
            </Text>
          </View>
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveStock(item.symbol)}>
            <Ionicons name="close-circle" size={20} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <View style={styles.stockDetails}>
          <DetailItem label="Shares" value={item.shares} />
          <DetailItem label="Avg Price" value={formatCurrency(item.avgPrice, sym)} />
          <DetailItem label="Value" value={formatCurrency(value, sym)} />
          <DetailItem
            label="P&L"
            value={`${formatCurrency(Math.abs(gainLoss), sym)} (${formatPercent(gainLossPercent)})`}
            valueColor={gainLoss >= 0 ? colors.primary : colors.danger}
          />
        </View>

        <View style={styles.weightRow}>
          <Text style={styles.weightLabel}>Portfolio Weight: {weight.toFixed(1)}%</Text>
          <View style={styles.weightBar}>
            <View style={[styles.weightFill, { width: `${weight}%`, backgroundColor: weight > 40 ? colors.warning : colors.primary }]} />
          </View>
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
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
          <Text style={styles.headerTitle}>Portfolio</Text>
          <View style={styles.portfolioSummary}>
            <SummaryCard label="Total Value" value={formatCurrency(totalValue, sym)} color={colors.primary} />
            <SummaryCard label="Invested" value={formatCurrency(totalCost, sym)} color={colors.secondary} />
            <SummaryCard
              label="Total P&L"
              value={`${pnl.absolute >= 0 ? '+' : ''}${formatCurrency(pnl.absolute, sym)}`}
              subValue={formatPercent(pnl.percent)}
              color={pnl.absolute >= 0 ? colors.primary : colors.danger}
            />
            <SummaryCard label="Diversity" value={`${diversity}%`} color={colors.blue} />
          </View>
        </LinearGradient>

        {/* Liquidity Card */}
        <TouchableOpacity style={styles.liquidityCard} onPress={() => { setTempLiq(String(liquidity)); setEditLiqModal(true); }}>
          <View style={styles.liquidityLeft}>
            <Ionicons name="wallet" size={24} color={colors.secondary} />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={styles.liquidityLabel}>Cash & Liquidity</Text>
              <Text style={styles.liquidityValue}>{formatCurrency(liquidity, sym)}</Text>
            </View>
          </View>
          <View style={styles.editChip}>
            <Ionicons name="create-outline" size={16} color={colors.secondary} />
            <Text style={styles.editChipText}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* Stocks List */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Positions ({portfolio.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.addBtnGrad}>
              <Ionicons name="add" size={18} color={colors.bg} />
              <Text style={styles.addBtnText}>Add Stock</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {portfolio.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={64} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No positions yet</Text>
            <Text style={styles.emptyText}>Add your first stock to start tracking your portfolio</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddModal(true)}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.emptyBtnGrad}>
                <Text style={styles.emptyBtnText}>Add First Stock</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={portfolio}
            renderItem={renderStock}
            keyExtractor={i => i.id || i.symbol}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
          />
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Add Stock Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Stock</Text>
              <TouchableOpacity onPress={() => { setAddModal(false); setSearchQuery(''); setSelectedStock(null); setShares(''); setAvgPrice(''); }}>
                <Ionicons name="close" size={24} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search Stock Symbol</Text>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color={colors.textDim} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="e.g. AAPL, MSFT, TSLA"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {searchResults.length > 0 && (
              <View style={styles.searchDropdown}>
                {searchResults.map(r => (
                  <TouchableOpacity key={r.symbol} style={styles.searchResult} onPress={() => handleSelectStock(r)}>
                    <Text style={styles.resultSymbol}>{r.symbol}</Text>
                    <Text style={styles.resultName} numberOfLines={1}>{r.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.inputLabel}>Number of Shares</Text>
            <TextInput
              style={styles.modalInput}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.inputLabel}>Average Buy Price ({sym})</Text>
            <TextInput
              style={styles.modalInput}
              value={avgPrice}
              onChangeText={setAvgPrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 150.00"
              placeholderTextColor={colors.textDim}
            />

            {shares && avgPrice && (
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Investment:</Text>
                <Text style={styles.previewValue}>{formatCurrency((parseFloat(shares) || 0) * (parseFloat(avgPrice) || 0), sym)}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.addStockBtn} onPress={handleAddStock}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.addStockBtnGrad}>
                <Text style={styles.addStockBtnText}>Add to Portfolio</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Liquidity Modal */}
      <Modal visible={editLiqModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Cash Balance</Text>
            <Text style={styles.inputLabel}>Current Cash / Liquidity</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>{sym}</Text>
              <TextInput
                style={styles.inlineInput}
                value={tempLiq}
                onChangeText={setTempLiq}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                autoFocus
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditLiqModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateLiquidity}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGrad}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const DetailItem = ({ label, value, valueColor }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>{value}</Text>
  </View>
);

const SummaryCard = ({ label, value, subValue, color }) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    {subValue && <Text style={[styles.summarySubValue, { color }]}>{subValue}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: spacing.md },
  headerTitle: { ...typography.h1, marginBottom: spacing.md },
  portfolioSummary: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  summaryLabel: { ...typography.caption, textAlign: 'center' },
  summaryValue: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  summarySubValue: { ...typography.caption, fontWeight: '600' },
  liquidityCard: { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  liquidityLeft: { flexDirection: 'row', alignItems: 'center' },
  liquidityLabel: { ...typography.bodySmall },
  liquidityValue: { ...typography.h3, color: colors.secondary, marginTop: 2 },
  editChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondaryGlow, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, gap: 4 },
  editChipText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3 },
  addBtn: { borderRadius: radius.full, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, gap: 4 },
  addBtnText: { ...typography.bodySmall, color: colors.bg, fontWeight: '700' },
  stockCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  stockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stockIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  stockIconText: { fontWeight: '800', color: colors.primary, fontSize: 14 },
  stockSymbol: { ...typography.h4 },
  stockName: { ...typography.caption, color: colors.textSub },
  stockPrice: { ...typography.h4, color: colors.white },
  stockDayChange: { ...typography.caption, fontWeight: '600' },
  removeBtn: { marginLeft: spacing.sm, padding: 4 },
  stockDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  detailItem: { flex: 1, minWidth: '40%', backgroundColor: colors.cardLight, borderRadius: radius.sm, padding: spacing.sm },
  detailLabel: { ...typography.caption, marginBottom: 2 },
  detailValue: { ...typography.bodySmall, color: colors.white, fontWeight: '600' },
  weightRow: { marginTop: spacing.sm },
  weightLabel: { ...typography.caption, marginBottom: 4 },
  weightBar: { height: 4, backgroundColor: colors.cardLight, borderRadius: 2, overflow: 'hidden' },
  weightFill: { height: '100%', borderRadius: 2 },
  emptyState: { alignItems: 'center', padding: spacing.xxl, paddingTop: 60 },
  emptyTitle: { ...typography.h2, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSub, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: spacing.xl, borderRadius: radius.full, overflow: 'hidden' },
  emptyBtnGrad: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  emptyBtnText: { ...typography.h4, color: colors.bg },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h2, marginBottom: 4 },
  inputLabel: { ...typography.bodySmall, color: colors.textSub, marginBottom: 6, marginTop: spacing.sm },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, ...typography.body, color: colors.text },
  searchDropdown: { backgroundColor: colors.cardLight, borderRadius: radius.md, marginTop: 4, borderWidth: 1, borderColor: colors.border },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultSymbol: { ...typography.h4, color: colors.primary, width: 70 },
  resultName: { flex: 1, ...typography.bodySmall, color: colors.textSub },
  modalInput: { height: 50, backgroundColor: colors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.cardBorder },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryGlow, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  previewLabel: { ...typography.bodySmall, color: colors.primary },
  previewValue: { ...typography.h4, color: colors.primary },
  addStockBtn: { marginTop: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  addStockBtnGrad: { height: 54, justifyContent: 'center', alignItems: 'center' },
  addStockBtnText: { ...typography.h3, color: colors.bg },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  inputPrefix: { ...typography.h3, color: colors.textSub, marginRight: 8 },
  inlineInput: { flex: 1, height: 56, ...typography.h3, color: colors.text },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, height: 52, backgroundColor: colors.cardLight, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  cancelText: { ...typography.h4, color: colors.textSub },
  saveBtn: { flex: 2, borderRadius: radius.md, overflow: 'hidden' },
  saveBtnGrad: { height: 52, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { ...typography.h4, color: colors.bg },
});
