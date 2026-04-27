// ── Compound Interest Projection ───────────────────────────────────────────
/**
 * Generate month-by-month projection data points
 * @param {number} principal - Starting amount
 * @param {number} monthlyContribution - Monthly addition
 * @param {number} annualRate - Annual interest/return rate (e.g. 0.07 for 7%)
 * @param {number} months - Duration in months
 * @returns {Array} Array of { month, value, contributions, interest }
 */
export const generateProjection = (principal, monthlyContribution, annualRate, months) => {
  const monthlyRate = annualRate / 12;
  const points = [];
  let currentValue = principal;
  let totalContributions = principal;

  for (let m = 0; m <= months; m++) {
    points.push({
      month: m,
      value: Math.round(currentValue * 100) / 100,
      contributions: Math.round(totalContributions * 100) / 100,
      interest: Math.round((currentValue - totalContributions) * 100) / 100,
    });
    if (m < months) {
      currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
      totalContributions += monthlyContribution;
    }
  }
  return points;
};

// ── Time to reach target ───────────────────────────────────────────────────
export const monthsToTarget = (principal, monthlyContribution, annualRate, target) => {
  if (principal >= target) return 0;
  const monthlyRate = annualRate / 12;
  let value = principal;
  let months = 0;
  const maxMonths = 600; // 50 years cap

  while (value < target && months < maxMonths) {
    value = value * (1 + monthlyRate) + monthlyContribution;
    months++;
  }
  return months < maxMonths ? months : null;
};

// ── Portfolio metrics ──────────────────────────────────────────────────────
export const calcPortfolioValue = (stocks, quotes) => {
  return stocks.reduce((total, stock) => {
    const quote = quotes[stock.symbol];
    const price = quote?.current || stock.avgPrice;
    return total + (price * stock.shares);
  }, 0);
};

export const calcPortfolioCost = (stocks) =>
  stocks.reduce((total, s) => total + (s.avgPrice * s.shares), 0);

export const calcPortfolioPnL = (stocks, quotes) => {
  const value = calcPortfolioValue(stocks, quotes);
  const cost = calcPortfolioCost(stocks);
  return {
    absolute: value - cost,
    percent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
  };
};

export const calcDailyChange = (stocks, quotes) => {
  let totalCurrent = 0;
  let totalPrev = 0;
  stocks.forEach(s => {
    const q = quotes[s.symbol];
    if (q) {
      totalCurrent += q.current * s.shares;
      totalPrev += q.prevClose * s.shares;
    }
  });
  const change = totalCurrent - totalPrev;
  const percent = totalPrev > 0 ? (change / totalPrev) * 100 : 0;
  return { absolute: change, percent };
};

// ── Target progress ────────────────────────────────────────────────────────
export const calcTargetProgress = (currentWealth, targetAmount) => {
  if (targetAmount <= 0) return 0;
  return Math.min((currentWealth / targetAmount) * 100, 100);
};

// ── Diversification score ──────────────────────────────────────────────────
export const calcDiversification = (stocks, quotes) => {
  const totalValue = calcPortfolioValue(stocks, quotes);
  if (totalValue === 0 || stocks.length === 0) return 0;

  // Herfindahl-Hirschman Index based diversification
  let hhiSum = 0;
  stocks.forEach(s => {
    const q = quotes[s.symbol];
    const val = (q?.current || s.avgPrice) * s.shares;
    const share = val / totalValue;
    hhiSum += share * share;
  });

  // Score 0-100, lower HHI = better diversification
  const score = Math.max(0, 100 - (hhiSum - 1 / stocks.length) * 100 * 2);
  return Math.min(100, Math.round(score));
};

// ── Format helpers ─────────────────────────────────────────────────────────
export const formatCurrency = (value, symbol = '$', decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return `${symbol}0.00`;
  const abs = Math.abs(value);
  let formatted;
  if (abs >= 1e9) formatted = `${symbol}${(value / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) formatted = `${symbol}${(value / 1e6).toFixed(2)}M`;
  else if (abs >= 1e3) formatted = `${symbol}${(value / 1e3).toFixed(1)}K`;
  else formatted = `${symbol}${value.toFixed(decimals)}`;
  return formatted;
};

export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

export const formatLargeNumber = (n) => {
  if (!n) return '0';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

export const formatDate = (timestamp) => {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateShort = (timestamp) => {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTimeAgo = (timestamp) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDateShort(timestamp);
};

export const formatMonths = (months) => {
  if (!months) return 'Already reached';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${rem}m`;
};

// ── Chart data preparation ─────────────────────────────────────────────────
export const prepareChartData = (projectionPoints, intervalMonths) => {
  // Downsample for chart display (max 12 points)
  const step = Math.max(1, Math.floor(projectionPoints.length / 12));
  const sampled = projectionPoints.filter((_, i) => i % step === 0);

  return {
    labels: sampled.map(p => {
      if (p.month === 0) return 'Now';
      if (p.month % 12 === 0) return `${p.month / 12}y`;
      return `${p.month}m`;
    }),
    datasets: [
      {
        data: sampled.map(p => Math.round(p.value)),
        color: (opacity = 1) => `rgba(0, 200, 150, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: sampled.map(p => Math.round(p.contributions)),
        color: (opacity = 1) => `rgba(240, 185, 11, ${opacity})`,
        strokeWidth: 2,
        withDots: false,
      },
    ],
  };
};

// ── Investment insights generation ─────────────────────────────────────────
export const generateInsights = (stocks, quotes, liquidity, target, totalWealth) => {
  const insights = [];
  const portfolioValue = calcPortfolioValue(stocks, quotes);
  const pnl = calcPortfolioPnL(stocks, quotes);
  const progress = calcTargetProgress(totalWealth, target);

  // Diversification insight
  if (stocks.length === 0) {
    insights.push({
      type: 'action',
      icon: '📊',
      title: 'Start Investing',
      message: 'You have not added any stocks yet. Consider starting with broad index ETFs like SPY or QQQ for instant diversification.',
      tags: ['beginner', 'etf'],
    });
  } else if (stocks.length < 5) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Concentration Risk',
      message: `Your portfolio has only ${stocks.length} position${stocks.length > 1 ? 's' : ''}. Consider diversifying across more sectors to reduce risk.`,
      tags: ['diversification', 'risk'],
    });
  }

  // Cash allocation insight
  if (liquidity > 0) {
    const cashRatio = liquidity / totalWealth;
    if (cashRatio > 0.5) {
      insights.push({
        type: 'opportunity',
        icon: '💰',
        title: 'High Cash Allocation',
        message: `${(cashRatio * 100).toFixed(0)}% of your wealth is in cash. Consider deploying some capital into investments to combat inflation and grow your wealth.`,
        tags: ['cash', 'inflation'],
      });
    }
  }

  // Target progress insight
  if (progress > 0 && progress < 25) {
    insights.push({
      type: 'info',
      icon: '🎯',
      title: 'Target Journey Begun',
      message: `You're ${progress.toFixed(1)}% toward your goal. Consistent monthly contributions compound significantly over time.`,
      tags: ['goal', 'compound'],
    });
  } else if (progress >= 75 && progress < 100) {
    insights.push({
      type: 'success',
      icon: '🚀',
      title: 'Nearly There!',
      message: `You're ${progress.toFixed(1)}% toward your target. Keep the momentum going - you're in the final stretch!`,
      tags: ['goal', 'milestone'],
    });
  }

  // P&L insight
  if (pnl.percent > 15) {
    insights.push({
      type: 'success',
      icon: '📈',
      title: 'Strong Portfolio Performance',
      message: `Your portfolio is up ${pnl.percent.toFixed(1)}%. Consider rebalancing to lock in some profits and maintain your target allocation.`,
      tags: ['performance', 'rebalancing'],
    });
  } else if (pnl.percent < -10) {
    insights.push({
      type: 'warning',
      icon: '📉',
      title: 'Portfolio Under Pressure',
      message: `Your portfolio is down ${Math.abs(pnl.percent).toFixed(1)}%. Market downturns are normal. Avoid panic selling and consider this a buying opportunity.`,
      tags: ['dip', 'buy'],
    });
  }

  // General market insights
  insights.push({
    type: 'info',
    icon: '🌍',
    title: 'Sector to Watch: Technology',
    message: 'AI infrastructure spending continues to accelerate. Semiconductor and cloud companies may see sustained demand growth through 2025-2026.',
    tags: ['technology', 'ai', 'trend'],
  });

  insights.push({
    type: 'info',
    icon: '🏦',
    title: 'Fixed Income Opportunity',
    message: 'With interest rates still elevated, short-term Treasuries and money market funds offer attractive yields with minimal risk.',
    tags: ['bonds', 'treasury', 'yield'],
  });

  if (stocks.length > 0) {
    insights.push({
      type: 'action',
      icon: '📅',
      title: 'Review Your Positions',
      message: 'Quarterly portfolio reviews help ensure your investments still align with your financial goals and risk tolerance.',
      tags: ['review', 'strategy'],
    });
  }

  return insights;
};
