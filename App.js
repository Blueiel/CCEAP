import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import ScholarDashboard from './screens/scholar/ScholarDashboard';
import Appointment from './screens/scholar/Appointment';
import ScholarAnnouncement from './screens/scholar/Announcement';
import ScholarSettings from './screens/scholar/Settings';

const Stack = createNativeStackNavigator();

const OCEAN_DEEP = '#001B2E';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboard}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="ScholarRegistry" component={ScholarRegistry} />
          <Stack.Screen name="Reviews" component={Reviews} />
          <Stack.Screen name="Announcement" component={Announcement} />
          <Stack.Screen name="ScheduleManager" component={ScheduleManager} />
          <Stack.Screen name="RequirementsSetup" component={RequirementsSetup} />
          <Stack.Screen name="Alerts" component={Alerts} />
          <Stack.Screen name="AdminSettings" component={AdminSettings} />
          <Stack.Screen name="PrintRoster" component={PrintRoster} />
          <Stack.Screen
            name="ScholarDashboard"
            component={ScholarDashboard}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="Appointment" component={Appointment} />
          <Stack.Screen name="ScholarAnnouncement" component={ScholarAnnouncement} />
          <Stack.Screen name="Settings" component={ScholarSettings} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}