import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../stores/authStore';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { TodayDashboardScreen } from '../screens/dashboard/TodayDashboard';
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { WorkoutScreen } from '../screens/workout/WorkoutScreen';
import { HabitsScreen } from '../screens/habits/HabitsScreen';
import { NotesScreen } from '../screens/notes/NotesScreen';
import { AICopilotScreen } from '../screens/ai/AICopilotScreen';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabInfo {
  name: string;
  label: string;
  icon: TabIconName;
  iconActive: TabIconName;
  component: React.ComponentType<any>;
}

const TABS: TabInfo[] = [
  { name: 'Dashboard', label: 'Hari Ini', icon: 'home-outline', iconActive: 'home', component: TodayDashboardScreen },
  { name: 'Calendar', label: 'Kalender', icon: 'calendar-outline', iconActive: 'calendar', component: CalendarScreen },
  { name: 'Finance', label: 'Keuangan', icon: 'wallet-outline', iconActive: 'wallet', component: FinanceScreen },
  { name: 'Workout', label: 'Workout', icon: 'barbell-outline', iconActive: 'barbell', component: WorkoutScreen },
  { name: 'Habits', label: 'Habit', icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', component: HabitsScreen },
  { name: 'Notes', label: 'Catatan', icon: 'bookmark-outline', iconActive: 'bookmark', component: NotesScreen },
  { name: 'AI', label: 'AI', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', component: AICopilotScreen },
];

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tabInfo = TABS.find(t => t.name === route.name);
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? tabInfo?.iconActive : tabInfo?.icon;
            return <Ionicons name={iconName as TabIconName} size={22} color={color} />;
          },
        };
      }}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingLogo}>east3</Text>
      <Text style={styles.loadingText}>Personal Life OS</Text>
    </View>
  );
}

export function AppNavigator() {
  const { session, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <NavigationContainer>
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.surfaceBorder,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    paddingVertical: 4,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingLogo: {
    fontSize: Typography.size['4xl'],
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -1,
  },
  loadingText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
});
