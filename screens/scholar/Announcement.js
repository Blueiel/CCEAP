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
import { useFocusEffect } from '@react-navigation/native';
import { auth, database } from '../../lib/firebase';
import { get, ref } from 'firebase/database';
import { signOut } from 'firebase/auth';

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

export default function ScholarAnnouncement({ navigation }) {
  const [headerFirstName, setHeaderFirstName] = React.useState('Scholar');
  const [loading, setLoading] = React.useState(true);
  const [announcements, setAnnouncements] = React.useState([]);

  const loadData = React.useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [profileSnap, announcementsSnap] = await Promise.all([
        get(ref(database, `users/${user.uid}`)),
        get(ref(database, 'announcements')),
      ]);

      const profile = profileSnap.exists() ? profileSnap.val() : {};
      const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Scholar User';
      const firstName = profile?.firstName?.trim() || fullName.split(/\s+/)[0] || 'Scholar';
      setHeaderFirstName(firstName);

      const rows = announcementsSnap.exists()
        ? Object.entries(announcementsSnap.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }))
        : [];

      const postedRows = rows
        .filter((item) => (item?.status || 'posted') === 'posted')
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));

      setAnnouncements(postedRows);
    } catch {
      Alert.alert('Error', 'Unable to load announcements right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData])
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

  const handleGoStatus = () => navigation.navigate('ScholarDashboard');
  const handleGoAppointment = () => navigation.navigate('Appointment');
  const handleGoSettings = () => navigation.navigate('Settings');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Hi, {headerFirstName}</Text>
          <View style={styles.headerTag}>
            <Text style={styles.headerTagText}>ACTIVE SCHOLAR</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Announcements</Text>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="bullhorn-outline" size={44} color={SLATE_300} />
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptyText}>Admin announcements will appear here.</Text>
          </View>
        ) : (
          announcements.map((item) => (
            <View key={item.id} style={styles.announcementCard}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="bullhorn-outline" size={20} color={GOLD} />
              </View>

              <View style={styles.contentWrap}>
                <Text style={styles.cardTitle}>{item?.title?.trim() || 'Announcement'}</Text>
                <Text style={styles.cardBody}>{item?.message?.trim() || 'No message provided.'}</Text>
                <Text style={styles.cardMeta}>
                  Posted by {item?.createdByName || 'Admin'} • {formatTimeAgo(item?.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          ['view-dashboard-outline', 'Status', false, handleGoStatus],
          ['calendar-check-outline', 'Appointment', false, handleGoAppointment],
          ['bullhorn-outline', 'Announcement', true, null],
          ['cog-outline', 'Settings', false, handleGoSettings],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity
            key={label}
            style={[styles.navItem, active && styles.navItemActive]}
            activeOpacity={0.85}
            onPress={onPress || undefined}
          >
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : SLATE_300} />
            <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
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
  headerTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginLeft: 10,
  },
  headerTagText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
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
    position: 'relative',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  pageTitle: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  loaderContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
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
  announcementCard: {
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
    backgroundColor: CARD_ALT_BG,
  },
  contentWrap: {
    flex: 1,
  },
  cardTitle: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardBody: {
    color: SLATE_300,
    fontSize: 12,
    lineHeight: 18,
  },
  cardMeta: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.22)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  navText: {
    fontSize: 10,
    fontWeight: '700',
    color: SLATE_300,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  navTextActive: {
    color: GOLD,
  },
};
