import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './lib/ThemeContext';
import HomeScreen from './screens/auth/HomeScreen';
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import AdminDashboard from './screens/admin/AdminDashboard';
import ScholarRegistry from './screens/admin/ScholarRegistry';
import Reviews from './screens/admin/Reviews';
import Alerts from './screens/admin/Alerts';
import Announcement from './screens/admin/Announcement';
import AdminSettings from './screens/admin/Settings';
import PrintRoster from './screens/admin/PrintRoster';
import ScheduleManager from './screens/admin/ScheduleManager';
import RequirementsSetup from './screens/admin/RequirementsSetup';
import CashierSetup from './screens/admin/CashierSetup';
import ScholarDashboard from './screens/scholar/ScholarDashboard';
import Appointment from './screens/scholar/Appointment';
import ScholarAnnouncement from './screens/scholar/Announcement';
import ScholarSettings from './screens/scholar/Settings';

const OCEAN_DEEP = '#001B2E';

const Stack = createNativeStackNavigator();
const ADMIN_MODULE_TRANSITION = { 
  animation: 'fade',
  animationDuration: 300,
  cardStyle: { backgroundColor: OCEAN_DEEP },
};
const SCHOLAR_MODULE_TRANSITION = { 
  animation: 'fade',
  animationDuration: 300,
  cardStyle: { backgroundColor: OCEAN_DEEP },
};

export default function App() {
  const navigationTheme = {
    dark: true,
    colors: {
      primary: OCEAN_DEEP,
      background: OCEAN_DEEP,
      card: OCEAN_DEEP,
      text: '#f1f5f9',
      border: 'rgba(212, 175, 55, 0.2)',
      notification: '#D4AF37',
    },
    fonts: {
      regular: {
        fontFamily: 'System',
        fontWeight: '400',
      },
      medium: {
        fontFamily: 'System',
        fontWeight: '500',
      },
      semibold: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      bold: {
        fontFamily: 'System',
        fontWeight: '700',
      },
      heavy: {
        fontFamily: 'System',
        fontWeight: '800',
      },
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: OCEAN_DEEP },
            animationEnabled: true,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboard}
            options={{ gestureEnabled: false, ...ADMIN_MODULE_TRANSITION }}
          />
          <Stack.Screen
            name="ScholarRegistry"
            component={ScholarRegistry}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="Reviews"
            component={Reviews}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="Announcement"
            component={Announcement}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="ScheduleManager"
            component={ScheduleManager}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="RequirementsSetup"
            component={RequirementsSetup}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="Alerts"
            component={Alerts}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="AdminSettings"
            component={AdminSettings}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="PrintRoster"
            component={PrintRoster}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="CashierSetup"
            component={CashierSetup}
            options={ADMIN_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="ScholarDashboard"
            component={ScholarDashboard}
            options={{ gestureEnabled: false, ...SCHOLAR_MODULE_TRANSITION }}
          />
          <Stack.Screen
            name="Appointment"
            component={Appointment}
            options={SCHOLAR_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="ScholarAnnouncement"
            component={ScholarAnnouncement}
            options={SCHOLAR_MODULE_TRANSITION}
          />
          <Stack.Screen
            name="Settings"
            component={ScholarSettings}
            options={SCHOLAR_MODULE_TRANSITION}
          />
        </Stack.Navigator>
      </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}