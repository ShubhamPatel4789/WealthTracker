import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  PORTFOLIO: 'wt_portfolio',
  LIQUIDITY: 'wt_liquidity',
  TARGET: 'wt_target',
  SETTINGS: 'wt_settings',
  PROJECTIONS: 'wt_projections',
  CACHE_NEWS: 'wt_cache_news_',
  CACHE_QUOTES: 'wt_cache_quotes',
  WATCHLIST: 'wt_watchlist',
};

// ── Portfolio ──────────────────────────────────────────────────────────────
export const savePortfolio = async (stocks) => {
  try {
    await AsyncStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(stocks));
  } catch (e) { console.error('savePortfolio', e); }
};

export const loadPortfolio = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.PORTFOLIO);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

// ── Liquidity ──────────────────────────────────────────────────────────────
export const saveLiquidity = async (amount) => {
  try {
    await AsyncStorage.setItem(KEYS.LIQUIDITY, String(amount));
  } catch (e) { console.error('saveLiquidity', e); }
};

export const loadLiquidity = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.LIQUIDITY);
    return data ? parseFloat(data) : 0;
  } catch (e) { return 0; }
};

// ── Target ─────────────────────────────────────────────────────────────────
export const saveTarget = async (amount) => {
  try {
    await AsyncStorage.setItem(KEYS.TARGET, String(amount));
  } catch (e) { console.error('saveTarget', e); }
};

export const loadTarget = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.TARGET);
    return data ? parseFloat(data) : 100000;
  } catch (e) { return 100000; }
};

// ── Settings ───────────────────────────────────────────────────────────────
export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) { console.error('saveSettings', e); }
};

export const loadSettings = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      apiKey: '',
      currency: 'USD',
      currencySymbol: '$',
      notifications: true,
      theme: 'dark',
    };
  } catch (e) {
    return { apiKey: '', currency: 'USD', currencySymbol: '$', notifications: true, theme: 'dark' };
  }
};

// ── Projections ────────────────────────────────────────────────────────────
export const saveProjections = async (projections) => {
  try {
    await AsyncStorage.setItem(KEYS.PROJECTIONS, JSON.stringify(projections));
  } catch (e) { console.error('saveProjections', e); }
};

export const loadProjections = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.PROJECTIONS);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

// ── Watchlist ──────────────────────────────────────────────────────────────
export const saveWatchlist = async (watchlist) => {
  try {
    await AsyncStorage.setItem(KEYS.WATCHLIST, JSON.stringify(watchlist));
  } catch (e) { console.error('saveWatchlist', e); }
};

export const loadWatchlist = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.WATCHLIST);
    return data ? JSON.parse(data) : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
  } catch (e) { return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']; }
};

// ── News cache (1hr TTL) ───────────────────────────────────────────────────
export const cacheNewsForSymbol = async (symbol, articles) => {
  try {
    const payload = { ts: Date.now(), articles };
    await AsyncStorage.setItem(KEYS.CACHE_NEWS + symbol, JSON.stringify(payload));
  } catch (e) {}
};

export const getCachedNews = async (symbol) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHE_NEWS + symbol);
    if (!raw) return null;
    const { ts, articles } = JSON.parse(raw);
    if (Date.now() - ts > 3600000) return null; // 1 hour TTL
    return articles;
  } catch (e) { return null; }
};

// ── Quote cache (5min TTL) ─────────────────────────────────────────────────
export const cacheQuotes = async (quotes) => {
  try {
    const payload = { ts: Date.now(), quotes };
    await AsyncStorage.setItem(KEYS.CACHE_QUOTES, JSON.stringify(payload));
  } catch (e) {}
};

export const getCachedQuotes = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHE_QUOTES);
    if (!raw) return null;
    const { ts, quotes } = JSON.parse(raw);
    if (Date.now() - ts > 300000) return null; // 5 min TTL
    return quotes;
  } catch (e) { return null; }
};

export const clearAllData = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const wtKeys = keys.filter(k => k.startsWith('wt_'));
    await AsyncStorage.multiRemove(wtKeys);
  } catch (e) {}
};
