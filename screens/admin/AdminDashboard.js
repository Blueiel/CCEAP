import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ref, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { database } from '../../lib/firebase';
import { auth } from '../../lib/firebase';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';
const REQUIREMENT_IDS = ['1', '2', '3', '4'];

const topStats = [
  { id: '1', icon: 'account-group-outline', value: '1,248', label: 'Total Scholars' },
  { id: '2', icon: 'check-decagram-outline', value: '874', label: 'Verified' },
  { id: '3', icon: 'clipboard-clock-outline', value: '312', label: 'Pending Review' },
  { id: '4', icon: 'cash-multiple', value: '₱ 2.3M', label: 'Disbursed' },
];

const scholarManagement = [
  { id: '1', icon: 'book-open-page-variant-outline', title: 'Scholar Registry', subtitle: 'Manage student records' },
  { id: '2', icon: 'clipboard-check-outline', title: 'Reviews', subtitle: 'Verify documents' },
  { id: '3', icon: 'calendar-check-outline', title: 'Schedule Manager', subtitle: 'Manage appointment slots' },
  { id: '4', icon: 'clipboard-list-outline', title: 'Requirements Setup', subtitle: 'Assign scholar requirements' },
];

const cashierActions = [
  { id: '1', icon: 'point-of-sale', label: 'Cashier Setup' },
  { id: '2', icon: 'monitor-dashboard', label: 'Queue Monitor' },
  { id: '3', icon: 'printer-outline', label: 'Print Roster' },
  { id: '4', icon: 'cash-check', label: 'Claiming Logs' },
];

const quickActions = [
  { id: '1', icon: 'bullhorn-outline', label: 'Post announcement' },
  { id: '2', icon: 'cellphone-message', label: 'Send SMS advisory' },
  { id: '3', icon: 'file-document-outline', label: 'Reports & Export' },
];

export default function AdminDashboard() {
  const navigation = useNavigation();
  const [totalScholars, setTotalScholars] = React.useState('0');
  const [verifiedScholars, setVerifiedScholars] = React.useState('0');
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [schools, setSchools] = React.useState([]);

  const loadScholarCount = React.useCallback(async () => {
    try {
      const [usersSnapshot, requirementsSnapshot] = await Promise.all([
        get(ref(database, 'users')),
        get(ref(database, 'adminConfig/requirements')),
      ]);

      if (!usersSnapshot.exists()) {
        setTotalScholars('0');
        setVerifiedScholars('0');
        setSchools([]);
        return;
      }

      const users = usersSnapshot.val();
      const scholarUsers = Object.values(users).filter((user) => user?.role === 'scholar');
      setTotalScholars(scholarUsers.length.toLocaleString());

      const requirementsConfig = requirementsSnapshot.exists() ? requirementsSnapshot.val() : null;
      let activeRequirementIds = [];

      if (Array.isArray(requirementsConfig?.items) && requirementsConfig.items.length) {
        activeRequirementIds = requirementsConfig.items
          .filter((item) => item?.required !== false)
          .map((item) => String(item?.id || '').trim())
          .filter(Boolean);
      } else if (requirementsConfig?.selectedIds && typeof requirementsConfig.selectedIds === 'object') {
        activeRequirementIds = Object.keys(requirementsConfig.selectedIds).filter(
          (id) => requirementsConfig.selectedIds[id] !== false
        );
      }

      if (!activeRequirementIds.length) {
        activeRequirementIds = REQUIREMENT_IDS;
      }

      const verifiedCount = scholarUsers.filter((user) =>
        activeRequirementIds.every((id) => !!user?.requirements?.[id])
      ).length;
      setVerifiedScholars(verifiedCount.toLocaleString());

      const groupedBySchool = {};
      scholarUsers.forEach((user) => {
        const schoolName = (user?.school || 'Not specified').trim() || 'Not specified';
        groupedBySchool[schoolName] = (groupedBySchool[schoolName] || 0) + 1;
      });

      const schoolRows = Object.entries(groupedBySchool)
        .map(([name, count], index) => ({
          id: String(index + 1),
          name,
          total: count,
          count: `${count.toLocaleString()} Scholar${count > 1 ? 's' : ''}`,
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        .slice(0, 3);

      setSchools(schoolRows);
    } catch {
      setTotalScholars('0');
      setVerifiedScholars('0');
      setSchools([]);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        Alert.alert('Restricted', 'Use the logout button to sign out.');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      loadScholarCount();
    }, [loadScholarCount])
  );

  const performLogout = async () => {
    try {
      await signOut(auth);
      navigation?.replace('Login');
    } catch {
      Alert.alert('Logout failed', 'Unable to log out right now. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performLogout },
    ]);
  };

  React.useEffect(() => {
    const loadAdminName = async () => {
      const user = auth.currentUser;

      if (!user) {
        setHeaderFullName('Admin');
        return;
      }

      try {
        const snapshot = await get(ref(database, `users/${user.uid}`));
        const profile = snapshot.exists() ? snapshot.val() : null;
        const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Admin';
        setHeaderFullName(fullName);
      } catch {
        setHeaderFullName(user?.displayName?.trim() || 'Admin');
      }
    };

    loadAdminName();
    loadScholarCount();
  }, [loadScholarCount]);

  const handleScholarRegistryPress = (schoolFilter = null) => {
    const normalizedSchoolFilter = typeof schoolFilter === 'string' ? schoolFilter : null;
    navigation.navigate('ScholarRegistry', { schoolFilter: normalizedSchoolFilter });
  };

  const handleRequirementsPress = () => {
    navigation.navigate('Reviews');
  };

  const handleScheduleManagerPress = () => {
    navigation.navigate('ScheduleManager');
  };

  const handleRequirementsSetupPress = () => {
    navigation.navigate('RequirementsSetup');
  };

  const handlePrintRosterPress = () => {
    navigation.navigate('PrintRoster');
  };

  const handleAlertsPress = () => {
    navigation.navigate('Alerts');
  };

  const handleSettingsPress = () => {
    navigation.navigate('AdminSettings');
  };

  const handleAnnouncementPress = () => {
    navigation.navigate('Announcement');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Hi, {headerFullName || 'Admin'}</Text>
        </View>

        <TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {topStats.map((item) => (
            <View key={item.id} style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <MaterialCommunityIcons name={item.icon} size={20} color={GOLD} />
              </View>
              <Text style={styles.statValue}>
                {item.id === '1' ? totalScholars : item.id === '2' ? verifiedScholars : item.value}
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scholar Management</Text>
          <View style={styles.grid}>
            {scholarManagement.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.gridCard}
                activeOpacity={0.85}
                onPress={
                  item.id === '1'
                    ? () => handleScholarRegistryPress()
                    : item.id === '2'
                    ? handleRequirementsPress
                    : item.id === '3'
                    ? handleScheduleManagerPress
                    : item.id === '4'
                    ? handleRequirementsSetupPress
                    : undefined
                }
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={22}
                  color={GOLD}
                />
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cashier & Claiming</Text>
          <View style={styles.grid}>
            {cashierActions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.softCard}
                activeOpacity={0.85}
                onPress={item.id === '3' ? handlePrintRosterPress : undefined}
              >
                <MaterialCommunityIcons name={item.icon} size={20} color={GOLD} />
                <Text style={styles.softCardText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Scholars by School</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleScholarRegistryPress()}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {schools.length === 0 ? (
            <View style={styles.schoolItem}>
              <View style={styles.schoolLeft}>
                <View style={styles.schoolIconWrap}>
                  <MaterialCommunityIcons name="school-outline" size={20} color={SLATE_300} />
                </View>
                <View>
                  <Text style={styles.schoolName}>No scholar records</Text>
                  <Text style={styles.schoolCount}>0 Scholars</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={SLATE_300} />
            </View>
          ) : (
            schools.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={styles.schoolItem}
                activeOpacity={0.85}
                onPress={() => handleScholarRegistryPress(school.name)}
              >
                <View style={styles.schoolLeft}>
                  <View style={styles.schoolIconWrap}>
                    <MaterialCommunityIcons name="school-outline" size={20} color={SLATE_300} />
                  </View>
                  <View>
                    <Text style={styles.schoolName}>{school.name}</Text>
                    <Text style={styles.schoolCount}>{school.count}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={SLATE_300} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.actionItem}
              activeOpacity={0.85}
              onPress={item.id === '1' ? handleAnnouncementPress : undefined}
            >
              <View style={styles.actionIconWrap}>
                <MaterialCommunityIcons name={item.icon} size={18} color={GOLD} />
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={SLATE_300} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          ['home-outline', 'Home', true],
          ['account-group-outline', 'Scholars', false, () => handleScholarRegistryPress()],
          ['file-document-outline', 'Reviews', false, handleRequirementsPress],
          ['bell-outline', 'Alerts', false, handleAlertsPress],
          ['cog-outline', 'Settings', false, handleSettingsPress],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity key={label} style={styles.navItem} activeOpacity={0.8} onPress={onPress || undefined}>
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : SLATE_300} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: OCEAN_DEEP,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: OCEAN_DEEP,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    color: SLATE_100,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  notifButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  statsRow: {
    paddingTop: 6,
    paddingBottom: 4,
    paddingRight: 8,
  },
  statCard: {
    width: 150,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 12,
    marginRight: 10,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: SLATE_100,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 3,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAll: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 14,
    marginBottom: 10,
  },
  gridTitle: {
    color: SLATE_100,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  gridSubtitle: {
    color: SLATE_300,
    fontSize: 11,
    marginTop: 3,
  },
  softCard: {
    width: '48%',
    minHeight: 74,
    borderRadius: 14,
    backgroundColor: CARD_ALT_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    justifyContent: 'center',
  },
  softCardText: {
    color: SLATE_100,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  schoolItem: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(203, 213, 225, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  schoolName: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
  },
  schoolCount: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 2,
  },
  actionItem: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionLabel: {
    flex: 1,
    color: SLATE_100,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navItem: {
    width: '19%',
    alignItems: 'center',
  },
  navLabel: {
    color: SLATE_300,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: GOLD,
  },
});
