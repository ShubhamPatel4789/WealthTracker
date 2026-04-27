import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Dimensions, Alert, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';
import { loadProjections, saveProjections, loadTarget, loadSettings, loadPortfolio, loadLiquidity } from '../utils/storage';
import {
  generateProjection, monthsToTarget, formatCurrency,
  formatMonths, prepareChartData, calcPortfolioValue,
} from '../utils/calculations';

const { width } = Dimensions.get('window');

const PRESETS = [
  { label: 'Conservative', rate: 0.04, icon: '🛡️', color: colors.blue },
  { label: 'Moderate', rate: 0.07, icon: '⚖️', color: colors.secondary },
  { label: 'Aggressive', rate: 0.12, icon: '🚀', color: colors.primary },
  { label: 'Custom', rate: null, icon: '✏️', color: colors.purple },
];

export default function ProjectorScreen() {
  const [projections, setProjections] = useState([]);
  const [target, setTarget] = useState(100000);
  const [settings, setSettings] = useState({});
  const [currentWealth, setCurrentWealth] = useState(0);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(1);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrincipal, setFormPrincipal] = useState('');
  const [formMonthly, setFormMonthly] = useState('');
  const [formRate, setFormRate] = useState('7');
  const [formYears, setFormYears] = useState('10');
  const [activeProjection, setActiveProjection] = useState(null);

  const loadData = useCallback(async () => {
    const [proj, tgt, cfg, port, liq] = await Promise.all([
      loadProjections(), loadTarget(), loadSettings(), loadPortfolio(), loadLiquidity(),
    ]);
    setProjections(proj);
    setTarget(tgt);
    setSettings(cfg);
    const portVal = calcPortfolioValue(port, {});
    setCurrentWealth(portVal + liq);
    if (proj.length > 0 && !activeProjection) setActiveProjection(proj[0]);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sym = settings.currencySymbol || '$';

  const handleSave = async () => {
    const principal = parseFloat(formPrincipal);
    const monthly = parseFloat(formMonthly) || 0;
    const rate = parseFloat(formRate) / 100;
    const months = parseInt(formYears) * 12;

    if (isNaN(principal) || principal < 0 || isNaN(rate) || rate < 0 || months <= 0) {
      Alert.alert('Invalid Input', 'Please check all fields are filled correctly.'); return;
    }

    const proj = {
      id: editingId || Date.now().toString(),
      name: formName || `Projection ${projections.length + 1}`,
      principal, monthlyContribution: monthly, annualRate: rate, months,
      targetAmount: target,
      color: PRESETS[selectedPreset]?.color || colors.primary,
      createdAt: Date.now(),
    };

    const updated = editingId
      ? projections.map(p => p.id === editingId ? proj : p)
      : [...projections, proj];

    await saveProjections(updated);
    setProjections(updated);
    setActiveProjection(proj);
    resetForm();
    setModal(false);
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete Projection', 'Remove this projection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = projections.filter(p => p.id !== id);
          await saveProjections(updated);
          setProjections(updated);
          if (activeProjection?.id === id) setActiveProjection(updated[0] || null);
        }
      },
    ]);
  };

  const resetForm = () => {
    setFormName(''); setFormPrincipal(''); setFormMonthly('');
    setFormRate('7'); setFormYears('10'); setEditingId(null); setSelectedPreset(1);
  };

  const openEdit = (proj) => {
    setEditingId(proj.id);
    setFormName(proj.name);
    setFormPrincipal(String(proj.principal));
    setFormMonthly(String(proj.monthlyContribution));
    setFormRate(String((proj.annualRate * 100).toFixed(1)));
    setFormYears(String(Math.round(proj.months / 12)));
    setModal(true);
  };

  const applyPreset = (i) => {
    setSelectedPreset(i);
    if (PRESETS[i].rate !== null) setFormRate(String((PRESETS[i].rate * 100).toFixed(0)));
  };

  // Compute active projection data
  const activeData = activeProjection ? (() => {
    const points = generateProjection(
      activeProjection.principal,
      activeProjection.monthlyContribution,
      activeProjection.annualRate,
      activeProjection.months,
    );
    const finalValue = points[points.length - 1]?.value || 0;
    const totalContributions = points[points.length - 1]?.contributions || 0;
    const totalInterest = finalValue - totalContributions;
    const monthsToGoal = monthsToTarget(
      activeProjection.principal,
      activeProjection.monthlyContribution,
      activeProjection.annualRate,
      target,
    );
    const chartData = prepareChartData(points, activeProjection.months);
    return { points, finalValue, totalContributions, totalInterest, monthsToGoal, chartData };
  })() : null;

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 200, 150, ${opacity})`,
    labelColor: () => colors.textDim,
    style: { borderRadius: radius.lg },
    propsForDots: { r: '3', strokeWidth: '1', stroke: colors.primary },
    propsForBackgroundLines: { strokeDasharray: '', stroke: colors.border, strokeWidth: 0.5 },
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#0F1525', '#0B0F1A']} style={styles.header}>
        <Text style={styles.headerTitle}>Growth Projector</Text>
        <Text style={styles.headerSub}>Visualize your path to financial freedom</Text>
      </LinearGradient>

      {/* Add Projection Button */}
      <View style={styles.addRow}>
        <Text style={styles.sectionTitle}>My Projections</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setModal(true); }}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.addBtnGrad}>
            <Ionicons name="add" size={18} color={colors.bg} />
            <Text style={styles.addBtnText}>New</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Projection Selector */}
      {projections.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projList} contentContainerStyle={styles.projContent}>
          {projections.map(proj => (
            <TouchableOpacity
              key={proj.id}
              style={[styles.projChip, activeProjection?.id === proj.id && { borderColor: proj.color || colors.primary }]}
              onPress={() => setActiveProjection(proj)}
            >
              <Text style={[styles.projChipText, activeProjection?.id === proj.id && { color: proj.color || colors.primary }]}>
                {proj.name}
              </Text>
              <Text style={styles.projChipRate}>{(proj.annualRate * 100).toFixed(0)}% / yr</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No projections yet</Text>
          <Text style={styles.emptyText}>Create a projection to see your wealth grow over time</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => { resetForm(); setModal(true); }}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.emptyBtnGrad}>
              <Text style={styles.emptyBtnText}>Create First Projection</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Projection Detail */}
      {activeProjection && activeData && (
        <>
          {/* Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>{activeProjection.name}</Text>
              <View style={styles.chartActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(activeProjection)}>
                  <Ionicons name="create-outline" size={18} color={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(activeProjection.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.chartLegend}>
              <LegendItem color={colors.primary} label="Total Value" />
              <LegendItem color={colors.secondary} label="Contributions" />
            </View>

            <LineChart
              data={activeData.chartData}
              width={width - spacing.md * 2 - spacing.md * 2}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              fromZero
            />
          </View>

          {/* Summary Stats */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="cash-outline" iconColor={colors.primary}
              label="Final Value" value={formatCurrency(activeData.finalValue, sym)}
              sub={`After ${formatMonths(activeProjection.months)}`}
            />
            <StatCard
              icon="arrow-up-circle-outline" iconColor={colors.secondary}
              label="Total Contributed" value={formatCurrency(activeData.totalContributions, sym)}
              sub="Principal + monthly"
            />
            <StatCard
              icon="sparkles-outline" iconColor={colors.warning}
              label="Interest Earned" value={formatCurrency(activeData.totalInterest, sym)}
              sub={`${activeData.totalContributions > 0 ? ((activeData.totalInterest / activeData.totalContributions) * 100).toFixed(0) : 0}% return`}
            />
            <StatCard
              icon="flag-outline" iconColor={colors.purple}
              label="Time to Target"
              value={activeData.monthsToGoal !== null ? formatMonths(activeData.monthsToGoal) : 'Not reached'}
              sub={formatCurrency(target, sym) + ' goal'}
              highlight={activeData.monthsToGoal !== null}
            />
          </View>

          {/* Milestones */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Milestones</Text>
            <View style={styles.milestones}>
              {[25, 50, 75, 100].map(pct => {
                const targetVal = activeProjection.principal * (1 + pct / 100);
                const ms = monthsToTarget(activeProjection.principal, activeProjection.monthlyContribution, activeProjection.annualRate, targetVal);
                return (
                  <View key={pct} style={styles.milestone}>
                    <View style={[styles.milestoneDot, { backgroundColor: colors.primary + (pct * 2.5).toString(16) }]} />
                    <Text style={styles.milestoneLabel}>+{pct}% of principal</Text>
                    <Text style={styles.milestoneTime}>{ms ? formatMonths(ms) : 'Not reached'}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Scenario Comparison Quick Calc */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rate Comparison</Text>
            <Text style={styles.sectionSub}>Final value after {Math.round(activeProjection.months / 12)}y at different rates</Text>
            {[0.04, 0.06, 0.08, 0.10, 0.12].map(rate => {
              const pts = generateProjection(activeProjection.principal, activeProjection.monthlyContribution, rate, activeProjection.months);
              const fv = pts[pts.length - 1]?.value || 0;
              const isActive = Math.abs(rate - activeProjection.annualRate) < 0.001;
              return (
                <View key={rate} style={[styles.rateRow, isActive && styles.activeRateRow]}>
                  <Text style={[styles.rateLabel, isActive && { color: colors.primary }]}>{(rate * 100).toFixed(0)}% annual</Text>
                  <View style={styles.rateBarContainer}>
                    <View style={[styles.rateBar, {
                      width: `${Math.min((fv / (activeData.finalValue * 1.5)) * 100, 100)}%`,
                      backgroundColor: isActive ? colors.primary : colors.cardBorder,
                    }]} />
                  </View>
                  <Text style={[styles.rateValue, isActive && { color: colors.primary }]}>{formatCurrency(fv, sym)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={{ height: 120 }} />

      {/* Add/Edit Modal */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Projection' : 'New Projection'}</Text>
                <TouchableOpacity onPress={() => { setModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={colors.textSub} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Projection Name</Text>
              <TextInput style={styles.modalInput} value={formName} onChangeText={setFormName} placeholder="e.g. Retirement Fund" placeholderTextColor={colors.textDim} />

              <Text style={styles.inputLabel}>Starting Principal ({sym})</Text>
              <TextInput style={styles.modalInput} value={formPrincipal} onChangeText={setFormPrincipal} keyboardType="decimal-pad" placeholder="e.g. 10000" placeholderTextColor={colors.textDim} />

              <Text style={styles.inputLabel}>Monthly Contribution ({sym})</Text>
              <TextInput style={styles.modalInput} value={formMonthly} onChangeText={setFormMonthly} keyboardType="decimal-pad" placeholder="e.g. 500" placeholderTextColor={colors.textDim} />

              <Text style={styles.inputLabel}>Return Strategy</Text>
              <View style={styles.presets}>
                {PRESETS.map((p, i) => (
                  <TouchableOpacity key={p.label} style={[styles.preset, selectedPreset === i && { borderColor: p.color, backgroundColor: p.color + '22' }]} onPress={() => applyPreset(i)}>
                    <Text style={styles.presetIcon}>{p.icon}</Text>
                    <Text style={[styles.presetLabel, selectedPreset === i && { color: p.color }]}>{p.label}</Text>
                    {p.rate && <Text style={styles.presetRate}>{(p.rate * 100).toFixed(0)}%</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Annual Return Rate (%)</Text>
              <TextInput style={styles.modalInput} value={formRate} onChangeText={setFormRate} keyboardType="decimal-pad" placeholder="e.g. 7" placeholderTextColor={colors.textDim} />

              <Text style={styles.inputLabel}>Duration (Years)</Text>
              <TextInput style={styles.modalInput} value={formYears} onChangeText={setFormYears} keyboardType="number-pad" placeholder="e.g. 10" placeholderTextColor={colors.textDim} />

              {/* Live Preview */}
              {formPrincipal && formRate && formYears && (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>Quick Preview</Text>
                  {(() => {
                    const pts = generateProjection(parseFloat(formPrincipal) || 0, parseFloat(formMonthly) || 0, (parseFloat(formRate) || 0) / 100, parseInt(formYears) * 12 || 120);
                    const fv = pts[pts.length - 1]?.value || 0;
                    return (
                      <View style={styles.previewRow}>
                        <View style={styles.previewItem}>
                          <Text style={styles.previewLabel}>Final Value</Text>
                          <Text style={styles.previewValue}>{formatCurrency(fv, sym)}</Text>
                        </View>
                        <View style={styles.previewItem}>
                          <Text style={styles.previewLabel}>Target in</Text>
                          <Text style={styles.previewValue}>
                            {formatMonths(monthsToTarget(parseFloat(formPrincipal) || 0, parseFloat(formMonthly) || 0, (parseFloat(formRate) || 0) / 100, target))}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveBtnGrad}>
                  <Text style={styles.saveBtnText}>{editingId ? 'Update Projection' : 'Create Projection'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const StatCard = ({ icon, iconColor, label, value, sub, highlight }) => (
  <View style={[styles.statCard, highlight && { borderColor: colors.primary + '44', backgroundColor: colors.primaryGlow }]}>
    <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: 8 }} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && { color: colors.primary }]}>{value}</Text>
    <Text style={styles.statSub}>{sub}</Text>
  </View>
);

const LegendItem = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const { colors: c, ...rest } = { colors };
import { colors as themeColors } from '../theme';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.bg },
  header: { paddingTop: 60, paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  headerTitle: { ...typography.h1, marginBottom: 4 },
  headerSub: { ...typography.bodySmall },
  addRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3 },
  sectionSub: { ...typography.bodySmall, marginBottom: spacing.sm },
  addBtn: { borderRadius: radius.full, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, gap: 4 },
  addBtnText: { ...typography.bodySmall, color: themeColors.bg, fontWeight: '700' },
  projList: { maxHeight: 72 },
  projContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  projChip: { backgroundColor: themeColors.card, borderRadius: radius.md, padding: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: themeColors.border },
  projChipText: { ...typography.h4, fontSize: 13, color: themeColors.textSub },
  projChipRate: { ...typography.caption, color: themeColors.textDim, marginTop: 2 },
  chartCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: themeColors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: themeColors.border },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  chartTitle: { ...typography.h4 },
  chartActions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  chartLegend: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption },
  chart: { borderRadius: radius.md, marginLeft: -spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: themeColors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: themeColors.border },
  statLabel: { ...typography.caption, marginBottom: 4 },
  statValue: { ...typography.h3, fontSize: 16, color: themeColors.white },
  statSub: { ...typography.caption, color: themeColors.textDim, marginTop: 2 },
  section: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: themeColors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: themeColors.border },
  milestones: { gap: spacing.sm },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  milestoneDot: { width: 10, height: 10, borderRadius: 5 },
  milestoneLabel: { flex: 1, ...typography.bodySmall },
  milestoneTime: { ...typography.bodySmall, color: themeColors.primary, fontWeight: '600' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderRadius: radius.sm, paddingHorizontal: 4 },
  activeRateRow: { backgroundColor: themeColors.primaryGlow },
  rateLabel: { width: 70, ...typography.caption, color: themeColors.textSub },
  rateBarContainer: { flex: 1, height: 6, backgroundColor: themeColors.cardLight, borderRadius: 3, overflow: 'hidden' },
  rateBar: { height: '100%', borderRadius: 3 },
  rateValue: { width: 80, ...typography.caption, color: themeColors.textSub, textAlign: 'right', fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: spacing.xxl, paddingTop: 40 },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: themeColors.textSub, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: spacing.xl, borderRadius: radius.full, overflow: 'hidden' },
  emptyBtnGrad: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  emptyBtnText: { ...typography.h4, color: themeColors.bg },
  modalOverlay: { flex: 1, backgroundColor: themeColors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: themeColors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h2 },
  inputLabel: { ...typography.bodySmall, color: themeColors.textSub, marginBottom: 6, marginTop: spacing.sm },
  modalInput: { height: 50, backgroundColor: themeColors.cardLight, borderRadius: radius.md, paddingHorizontal: spacing.md, ...typography.body, color: themeColors.text, borderWidth: 1, borderColor: themeColors.cardBorder },
  presets: { flexDirection: 'row', gap: spacing.sm, marginBottom: 4 },
  preset: { flex: 1, backgroundColor: themeColors.cardLight, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: themeColors.border },
  presetIcon: { fontSize: 20, marginBottom: 4 },
  presetLabel: { ...typography.caption, color: themeColors.textSub, fontWeight: '600' },
  presetRate: { ...typography.caption, color: themeColors.textDim },
  preview: { backgroundColor: themeColors.primaryGlow, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: themeColors.primary + '33' },
  previewTitle: { ...typography.bodySmall, color: themeColors.primary, marginBottom: spacing.sm, fontWeight: '700' },
  previewRow: { flexDirection: 'row', gap: spacing.md },
  previewItem: { flex: 1 },
  previewLabel: { ...typography.caption, color: themeColors.primary },
  previewValue: { ...typography.h4, color: themeColors.primary },
  saveBtn: { marginTop: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  saveBtnGrad: { height: 54, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { ...typography.h3, color: themeColors.bg },
});
