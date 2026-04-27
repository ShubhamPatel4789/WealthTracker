import axios from 'axios';
import { getCachedNews, cacheNewsForSymbol, getCachedQuotes, cacheQuotes } from './storage';

const BASE_URL = 'https://finnhub.io/api/v1';

let _apiKey = '';
export const setApiKey = (key) => { _apiKey = key; };
export const getApiKey = () => _apiKey;

const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// ── Stock Quote ────────────────────────────────────────────────────────────
export const fetchQuote = async (symbol) => {
  if (!_apiKey) return null;
  try {
    const res = await client.get('/quote', {
      params: { symbol: symbol.toUpperCase(), token: _apiKey },
    });
    return {
      symbol: symbol.toUpperCase(),
      current: res.data.c,
      open: res.data.o,
      high: res.data.h,
      low: res.data.l,
      prevClose: res.data.pc,
      change: res.data.d,
      changePercent: res.data.dp,
      timestamp: res.data.t,
    };
  } catch (e) {
    console.error('fetchQuote', symbol, e.message);
    return null;
  }
};

// ── Multiple Quotes (with cache) ───────────────────────────────────────────
export const fetchMultipleQuotes = async (symbols) => {
  if (!_apiKey || !symbols.length) return {};

  const cached = await getCachedQuotes();
  const results = cached ? { ...cached } : {};
  const toFetch = symbols.filter(s => !results[s]);

  for (const sym of toFetch) {
    const q = await fetchQuote(sym);
    if (q) results[sym] = q;
    await delay(150); // respect rate limit
  }

  if (toFetch.length > 0) await cacheQuotes(results);
  return results;
};

// ── Company Profile ────────────────────────────────────────────────────────
export const fetchCompanyProfile = async (symbol) => {
  if (!_apiKey) return null;
  try {
    const res = await client.get('/stock/profile2', {
      params: { symbol: symbol.toUpperCase(), token: _apiKey },
    });
    return {
      name: res.data.name,
      ticker: res.data.ticker,
      exchange: res.data.exchange,
      industry: res.data.finnhubIndustry,
      logo: res.data.logo,
      marketCap: res.data.marketCapitalization,
      shareOutstanding: res.data.shareOutstanding,
      weburl: res.data.weburl,
    };
  } catch (e) { return null; }
};

// ── Stock News ─────────────────────────────────────────────────────────────
export const fetchStockNews = async (symbol) => {
  if (!_apiKey) return getMockNews(symbol);

  const cached = await getCachedNews(symbol);
  if (cached) return cached;

  try {
    const today = formatDate(new Date());
    const weekAgo = formatDate(new Date(Date.now() - 7 * 86400000));

    const res = await client.get('/company-news', {
      params: { symbol: symbol.toUpperCase(), from: weekAgo, to: today, token: _apiKey },
    });

    const articles = res.data.slice(0, 15).map(a => ({
      id: a.id,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      url: a.url,
      image: a.image,
      datetime: a.datetime * 1000,
      symbol: symbol.toUpperCase(),
      sentiment: estimateSentiment(a.headline),
    }));

    await cacheNewsForSymbol(symbol, articles);
    return articles;
  } catch (e) {
    console.error('fetchStockNews', symbol, e.message);
    return getMockNews(symbol);
  }
};

// ── General Market News ────────────────────────────────────────────────────
export const fetchMarketNews = async (category = 'general') => {
  if (!_apiKey) return getMockMarketNews();
  try {
    const res = await client.get('/news', {
      params: { category, token: _apiKey },
    });
    return res.data.slice(0, 20).map(a => ({
      id: a.id,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      url: a.url,
      image: a.image,
      datetime: a.datetime * 1000,
      category,
      sentiment: estimateSentiment(a.headline),
    }));
  } catch (e) { return getMockMarketNews(); }
};

// ── Recommendation Trends ──────────────────────────────────────────────────
export const fetchRecommendations = async (symbol) => {
  if (!_apiKey) return null;
  try {
    const res = await client.get('/stock/recommendation', {
      params: { symbol: symbol.toUpperCase(), token: _apiKey },
    });
    return res.data.slice(0, 3).map(r => ({
      period: r.period,
      strongBuy: r.strongBuy,
      buy: r.buy,
      hold: r.hold,
      sell: r.sell,
      strongSell: r.strongSell,
      total: r.strongBuy + r.buy + r.hold + r.sell + r.strongSell,
    }));
  } catch (e) { return null; }
};

// ── Earnings Calendar ──────────────────────────────────────────────────────
export const fetchEarningsCalendar = async (from, to) => {
  if (!_apiKey) return [];
  try {
    const res = await client.get('/calendar/earnings', {
      params: { from: from || formatDate(new Date()), to: to || formatDate(new Date(Date.now() + 30 * 86400000)), token: _apiKey },
    });
    return res.data.earningsCalendar || [];
  } catch (e) { return []; }
};

// ── Market Movers / Insights ───────────────────────────────────────────────
export const fetchMarketStatus = async () => {
  if (!_apiKey) return { isOpen: isMarketOpen(), session: isMarketOpen() ? 'regular' : 'closed' };
  try {
    const res = await client.get('/stock/market-status', {
      params: { exchange: 'US', token: _apiKey },
    });
    return { isOpen: res.data.isOpen, session: res.data.session || 'unknown' };
  } catch (e) { return { isOpen: isMarketOpen(), session: 'unknown' }; }
};

// ── Symbol Search ──────────────────────────────────────────────────────────
export const searchSymbol = async (query) => {
  if (!_apiKey || query.length < 1) return [];
  try {
    const res = await client.get('/search', {
      params: { q: query, token: _apiKey },
    });
    return (res.data.result || []).slice(0, 8).filter(r => r.type === 'Common Stock');
  } catch (e) { return []; }
};

// ── Insider Sentiment ──────────────────────────────────────────────────────
export const fetchInsiderSentiment = async (symbol) => {
  if (!_apiKey) return null;
  try {
    const today = formatDate(new Date());
    const threeMonthsAgo = formatDate(new Date(Date.now() - 90 * 86400000));
    const res = await client.get('/stock/insider-sentiment', {
      params: { symbol: symbol.toUpperCase(), from: threeMonthsAgo, to: today, token: _apiKey },
    });
    return res.data.data ? res.data.data.slice(0, 3) : null;
  } catch (e) { return null; }
};

// ── Peers ──────────────────────────────────────────────────────────────────
export const fetchPeers = async (symbol) => {
  if (!_apiKey) return [];
  try {
    const res = await client.get('/stock/peers', {
      params: { symbol: symbol.toUpperCase(), token: _apiKey },
    });
    return (res.data || []).filter(s => s !== symbol).slice(0, 5);
  } catch (e) { return []; }
};

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (date) => date.toISOString().split('T')[0];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const estimateSentiment = (text = '') => {
  const lower = text.toLowerCase();
  const positive = ['surge', 'gain', 'rise', 'rally', 'beat', 'profit', 'growth', 'buy', 'upgrade', 'record', 'strong', 'boost', 'recover', 'bullish'];
  const negative = ['fall', 'drop', 'loss', 'miss', 'sell', 'downgrade', 'decline', 'weak', 'crash', 'bearish', 'cut', 'lower', 'plunge', 'risk'];
  const posScore = positive.filter(w => lower.includes(w)).length;
  const negScore = negative.filter(w => lower.includes(w)).length;
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
};

const isMarketOpen = () => {
  const now = new Date();
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = eastern.getDay();
  const hours = eastern.getHours();
  const minutes = eastern.getMinutes();
  const time = hours * 60 + minutes;
  return day >= 1 && day <= 5 && time >= 570 && time < 960; // 9:30 AM - 4:00 PM ET
};

// ── Mock data for API key not set ──────────────────────────────────────────
const getMockNews = (symbol) => [
  {
    id: 1, symbol,
    headline: `${symbol} Reports Strong Q3 Earnings, Beats Expectations`,
    summary: `${symbol} reported earnings per share of $1.89, exceeding analyst estimates of $1.72. Revenue grew 12% year-over-year.`,
    source: 'MarketWatch', url: '#', image: null,
    datetime: Date.now() - 3600000, sentiment: 'positive',
  },
  {
    id: 2, symbol,
    headline: `Analysts Raise Price Target for ${symbol} Following Strong Results`,
    summary: `Multiple Wall Street firms raised their price targets following the latest earnings report.`,
    source: 'Bloomberg', url: '#', image: null,
    datetime: Date.now() - 7200000, sentiment: 'positive',
  },
  {
    id: 3, symbol,
    headline: `${symbol} Announces New Product Line Expansion`,
    summary: `The company unveiled plans to expand into new markets, which analysts believe could drive significant revenue growth.`,
    source: 'Reuters', url: '#', image: null,
    datetime: Date.now() - 86400000, sentiment: 'neutral',
  },
];

const getMockMarketNews = () => [
  {
    id: 101,
    headline: 'Federal Reserve Holds Rates Steady, Signals Patient Approach',
    summary: 'The Federal Reserve kept its benchmark interest rate unchanged, with officials signaling they need more data before cutting.',
    source: 'Reuters', url: '#', image: null,
    datetime: Date.now() - 1800000, sentiment: 'neutral', category: 'general',
  },
  {
    id: 102,
    headline: 'S&P 500 Hits New Record High on Strong Jobs Data',
    summary: 'The benchmark index closed at a new all-time high after the latest employment report showed robust job creation.',
    source: 'CNBC', url: '#', image: null,
    datetime: Date.now() - 3600000, sentiment: 'positive', category: 'general',
  },
  {
    id: 103,
    headline: 'Tech Sector Leads Market Rally as AI Investment Accelerates',
    summary: 'Technology stocks surged as major companies announced increased capital expenditures for artificial intelligence infrastructure.',
    source: 'WSJ', url: '#', image: null,
    datetime: Date.now() - 7200000, sentiment: 'positive', category: 'general',
  },
  {
    id: 104,
    headline: 'Oil Prices Decline on Demand Concerns and Supply Increases',
    summary: 'Crude oil futures fell after data showed weaker-than-expected demand from major economies and increased production.',
    source: 'Bloomberg', url: '#', image: null,
    datetime: Date.now() - 10800000, sentiment: 'negative', category: 'general',
  },
];
