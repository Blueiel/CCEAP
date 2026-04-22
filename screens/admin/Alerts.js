import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ref, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { auth, database } from '../../lib/firebase';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';

const formatTimeAgo = (timestamp) => {
  if (!timestamp || Number.isNaN(Number(timestamp))) {
    return 'Just now';
  }

  const diffMs = Date.now() - Number(timestamp);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function AlertsPage() {
  const navigation = useNavigation();
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [alerts, setAlerts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

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

  const loadAdminName = React.useCallback(async () => {
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
  }, []);

  const loadAlerts = React.useCallback(async () => {
    try {
      setLoading(true);
      const [usersSnapshot, announcementsSnapshot, workflowAlertsSnapshot] = await Promise.all([
        get(ref(database, 'users')),
        get(ref(database, 'announcements')),
        get(ref(database, 'alerts')),
      ]);

      const nextAlerts = [];

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.keys(users).forEach((uid) => {
          const user = users[uid] || {};
          const name = user?.fullName || user?.email || 'Unknown user';
          const createdAt = Number(user?.createdAt || 0);
          const updatedAt = Number(user?.updatedAt || 0);

          if (createdAt > 0) {
            nextAlerts.push({
              id: `created-${uid}`,
              type: 'new_account',
              icon: 'account-plus-outline',
              color: '#4ade80',
              title: 'New account created',
              body: `${name} registered in the system.`,
              timestamp: createdAt,
            });
          }

          if (updatedAt > 0 && (!createdAt || Math.abs(updatedAt - createdAt) > 60000)) {
            nextAlerts.push({
              id: `updated-${uid}`,
              type: 'profile_update',
              icon: 'account-edit-outline',
              color: GOLD,
              title: 'Profile updated',
              body: `${name} updated profile settings.`,
              timestamp: updatedAt,
            });
          }
        });
      }

      if (announcementsSnapshot.exists()) {
        const announcements = announcementsSnapshot.val();

        Object.entries(announcements).forEach(([announcementId, value]) => {
          const announcement = value || {};
          const createdByName = announcement?.createdByName || 'Admin';
          const createdAt = Number(announcement?.createdAt || 0);
          const announcementTitle = (announcement?.title || '').trim();
          const announcementMessage = (announcement?.message || '').trim();

          nextAlerts.push({
            id: `announcement-${announcementId}`,
            type: 'announcement',
            icon: 'bullhorn-outline',
            color: GOLD,
            title: announcementTitle || 'Announcement posted',
            body: announcementMessage
              ? `${announcementMessage} • Posted by ${createdByName}`
              : `Posted by ${createdByName}`,
            timestamp: createdAt || Date.now(),
          });
        });
      }

      if (workflowAlertsSnapshot.exists()) {
        const workflowAlerts = workflowAlertsSnapshot.val() || {};

        Object.entries(workflowAlerts).forEach(([alertId, value]) => {
          const workflowAlert = value || {};
          const type = workflowAlert?.type || 'system';
          const createdAt = Number(workflowAlert?.createdAt || 0);

          if (type === 'requirement_update') {
            const scholarName =
              workflowAlert?.scholar?.name || workflowAlert?.scholar?.email || 'Unknown Scholar';
            const summary = (workflowAlert?.requirementsSummary || '').trim();
            const adminName = (workflowAlert?.adminName || 'Admin').trim();

            nextAlerts.push({
              id: `workflow-${alertId}`,
              type: 'requirement_update',
              icon: 'clipboard-check-outline',
              color: '#60a5fa',
              title: 'Requirement review applied',
              body: summary
                ? `${scholarName} • ${summary} • Reviewed by ${adminName}`
                : `${scholarName} requirements were reviewed by ${adminName}.`,
              timestamp: createdAt || Date.now(),
            });
          }
        });
      }

      nextAlerts.sort((a, b) => b.timestamp - a.timestamp);
      setAlerts(nextAlerts);
    } catch {
      Alert.alert('Error', 'Unable to load system alerts right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAdminName();
    loadAlerts();
  }, [loadAdminName, loadAlerts]);

  useFocusEffect(
    React.useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const totalAlerts = alerts.length;
  const newAccounts = alerts.filter((item) => item.type === 'new_account').length;
  const announcements = alerts.filter((item) => item.type === 'announcement').length;

  const handleGoHome = () => navigation.replace('AdminDashboard');
  const handleGoScholars = () => navigation.replace('ScholarRegistry');
  const handleGoReviews = () => navigation.replace('Reviews');
  const handleGoSettings = () => navigation.replace('AdminSettings');

  if (loading) {
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

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.pageTitle}>System Alerts</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalAlerts}</Text>
            <Text style={styles.summaryLabel}>Total Alerts</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{newAccounts}</Text>
            <Text style={styles.summaryLabel}>New Accounts</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{announcements}</Text>
            <Text style={styles.summaryLabel}>Announcements</Text>
          </View>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="bell-outline" size={44} color={SLATE_300} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyText}>System activity and announcements will appear here.</Text>
          </View>
        ) : (
          alerts.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={[styles.iconWrap, { backgroundColor: CARD_ALT_BG }]}> 
                <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
              </View>

              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.alertBody}>{item.body}</Text>
                <Text style={styles.alertTime}>{formatTimeAgo(item.timestamp)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          ['home-outline', 'Home', false, handleGoHome],
          ['account-group-outline', 'Scholars', false, handleGoScholars],
          ['file-document-outline', 'Reviews', false, handleGoReviews],
          ['bell-outline', 'Alerts', true, null],
          ['cog-outline', 'Settings', false, handleGoSettings],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity
            key={label}
            style={styles.navItem}
            activeOpacity={0.8}
            onPress={onPress || undefined}
          >
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : SLATE_300} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = {
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
  pageTitle: {
    color: SLATE_100,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryCard: {
    width: '32%',
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  summaryValue: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: SLATE_300,
    fontSize: 11,
    marginTop: 3,
  },
  alertCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertBody: {
    color: SLATE_300,
    fontSize: 12,
    lineHeight: 18,
  },
  alertTime: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 14,
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    color: SLATE_100,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyText: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 4,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
};
