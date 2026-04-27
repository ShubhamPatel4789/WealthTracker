import 'react-native-gesture-handler';
import React, { useState, useEffect, createContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import DashboardScreen from './src/screens/DashboardScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import NewsScreen from './src/screens/NewsScreen';
import ProjectorScreen from './src/screens/ProjectorScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors, radius } from './src/theme';
import { loadSettings } from './src/utils/storage';
import { setApiKey } from './src/utils/api';

SplashScreen.preventAutoHideAsync();

export const AppContext = createContext({ refresh: 0, triggerRefresh: () => {} });

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'home' : 'home-outline',
            Portfolio: focused ? 'bar-chart' : 'bar-chart-outline',
            News: focused ? 'newspaper' : 'newspaper-outline',
            Projector: focused ? 'analytics' : 'analytics-outline',
            Insights: focused ? 'bulb' : 'bulb-outline',
          };
          return <Ionicons name={icons[route.name] || 'help'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="News" component={NewsScreen} />
      <Tab.Screen name="Projector" component={ProjectorScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [refreshCount, setRefreshCount] = useState(0);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await loadSettings();
      if (cfg.apiKey) setApiKey(cfg.apiKey);
      setAppReady(true);
      await SplashScreen.hideAsync();
    })();
  }, []);

  if (!appReady) return null;

  return (
    <AppContext.Provider value={{ refresh: refreshCount, triggerRefresh: () => setRefreshCount(c => c + 1) }}>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitle: 'Settings',
              headerBackTitle: 'Back',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
