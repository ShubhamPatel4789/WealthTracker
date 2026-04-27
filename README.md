# 💰 WealthTracker

A personal finance app for tracking liquidity, stock portfolio, getting daily news, growth projections, and investment insights.

---

## Features
- **Dashboard** — Net worth overview, daily P&L, target progress
- **Portfolio** — Add/remove stocks, track cost basis, real-time quotes
- **News** — Live stock and market news with sentiment analysis (via Finnhub)
- **Projector** — Compound interest timeline with multiple scenarios
- **Insights** — Personalized investment tips, sector performance, analyst ratings
- **Settings** — Finnhub API key, currency display

---

## Build & Install on Samsung S23 Ultra (One UI 6.1 / Android 14)

### Option 1: GitHub Actions (Recommended)

1. Push this repo to GitHub
2. Go to `Settings → Secrets and variables → Actions` and add:
   - `EXPO_TOKEN` — from https://expo.dev/settings/access-tokens
   - `EXPO_PROJECT_ID` — from https://expo.dev (create a new project)
3. Push to `main` branch — the workflow triggers automatically
4. Go to https://expo.dev → Your project → Builds → Download the `.apk`
5. Transfer `.apk` to your phone and install (enable "Install unknown apps" for your browser/file manager)

### Option 2: Local Build

```bash
npm install -g eas-cli expo-cli
npm install
eas login
eas build --platform android --profile preview
```

---

## API Key Setup

1. Register free at https://finnhub.io/register
2. Copy your API key
3. Open the app → Settings → paste key → Save
4. Free tier: 60 requests/minute, real-time US stock data

---

## Tech Stack
- React Native + Expo SDK 51
- React Navigation (Stack + Bottom Tabs)
- Finnhub REST API
- AsyncStorage (all data local, no backend)
- react-native-chart-kit (growth charts)
- expo-linear-gradient
