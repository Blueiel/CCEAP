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
import { get, ref, runTransaction, update } from 'firebase/database';
import { signOut } from 'firebase/auth';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';

// Light mode colors
const LIGHT_BG = '#f5f5f5';
const LIGHT_CARD = '#ffffff';
const LIGHT_TEXT = '#1a1a1a';
const LIGHT_TEXT_SECONDARY = '#666666';
const SUCCESS = '#4ade80';

const compareSchedules = (a, b) => {
  const dateA = `${a?.date || ''} ${a?.startTime || ''}`.trim();
  const dateB = `${b?.date || ''} ${b?.startTime || ''}`.trim();
  return dateA.localeCompare(dateB);
};

export default function Appointment({ navigation }) {
  const [headerFirstName, setHeaderFirstName] = React.useState('Scholar');
  const [darkMode, setDarkMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState('');
  const [schedules, setSchedules] = React.useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = React.useState('');

  const handleDarkModeToggle = () => {
    toggleDarkMode();
  };

  const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const headerBgColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
  const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
  const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

  const updateScheduleBookedCount = async (scheduleId, delta) => {
    if (!scheduleId || !delta) return;

    return runTransaction(ref(database, `appointmentSchedules/${scheduleId}/bookedCount`), (current) => {
      const next = Number(current || 0) + delta;
      return next < 0 ? 0 : next;
    });
  };

  const persistSelectedSchedule = async ({ userUid, schedule, previousScheduleId, reason }) => {
    if (!userUid || !schedule?.id) return;

    if (previousScheduleId && previousScheduleId !== schedule.id) {
      await updateScheduleBookedCount(previousScheduleId, -1);
    }

    if (previousScheduleId !== schedule.id) {
      await updateScheduleBookedCount(schedule.id, 1);
    }

    await update(ref(database, `users/${userUid}`), {
      appointmentBooking: {
        scheduleId: schedule.id,
        date: schedule.date || '',
        startTime: schedule.startTime || '',
        endTime: schedule.endTime || '',
        location: schedule.location || '',
        status: 'booked',
        updatedAt: Date.now(),
        ...(reason ? { reason } : {}),
      },
    });

    setSelectedScheduleId(schedule.id);
  };

  const loadData = React.useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [profileSnap, scheduleSnap] = await Promise.all([
        get(ref(database, `users/${user.uid}`)),
        get(ref(database, 'appointmentSchedules')),
      ]);

      const profile = profileSnap.exists() ? profileSnap.val() : {};
      const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Scholar User';
      const firstName = profile?.firstName?.trim() || fullName.split(/\s+/)[0] || 'Scholar';
      setHeaderFirstName(firstName);

      const rows = scheduleSnap.exists()
        ? Object.entries(scheduleSnap.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }))
        : [];

      rows.sort(compareSchedules);
      setSchedules(rows);

      const currentBookingId = profile?.appointmentBooking?.scheduleId || '';
      setSelectedScheduleId(currentBookingId);

      if (!rows.length) {
        return;
      }

    } catch {
      Alert.alert('Error', 'Unable to load appointment schedules right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleChooseSchedule = async (schedule) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Session expired', 'Please log in again.');
      navigation?.replace('Login');
      return;
    }

    if (selectedScheduleId && selectedScheduleId !== schedule.id) {
      Alert.alert('Schedule locked', 'You already selected a schedule and it cannot be changed.');
      return;
    }

    try {
      setSaving(schedule.id);
      await persistSelectedSchedule({
        userUid: user.uid,
        schedule,
        previousScheduleId: selectedScheduleId,
        reason: 'Selected by scholar',
      });
      Alert.alert('Schedule selected', 'Your appointment schedule is now locked.');
    } catch {
      Alert.alert('Update failed', 'Unable to select schedule right now.');
    } finally {
      setSaving('');
    }
  };

  const handleGoStatus = () => navigation.replace('ScholarDashboard');
  const handleGoAnnouncement = () => navigation.replace('ScholarAnnouncement');
  const handleGoSettings = () => navigation.replace('Settings');

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.brand, { color: textColor }]}>Hi, {headerFirstName}</Text>
          <View style={styles.headerTag}>
            <Text style={styles.headerTagText}>ACTIVE SCHOLAR</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.darkModeToggle, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleDarkModeToggle}>
          <MaterialCommunityIcons name={darkMode ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={GOLD} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Appointment Booking</Text>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
            {selectedScheduleId
              ? 'You already selected a schedule. Changes are disabled.'
              : 'Choose one schedule for passing your requirements.'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
        ) : schedules.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={44} color={secondaryTextColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No schedules available</Text>
            <Text style={[styles.emptyText, { color: secondaryTextColor }]}>Wait for admin to publish schedules.</Text>
          </View>
        ) : (
          schedules.map((item) => {
            const isSelected = selectedScheduleId === item.id;
            const isSaving = saving === item.id;
            const hasLockedSelection = !!selectedScheduleId;
            const isDisabled = isSaving || isSelected || (hasLockedSelection && !isSelected);

            return (
              <View key={item.id} style={[styles.scheduleCard, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
                <View style={styles.scheduleTop}>
                  <View style={[styles.iconWrap, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.1)' }]}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color={GOLD} />
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={[styles.scheduleDate, { color: textColor }]}>{item.date || 'No date'}</Text>
                    <Text style={[styles.scheduleMeta, { color: secondaryTextColor }]}>
                      {item.startTime || '--'} - {item.endTime || '--'}
                    </Text>
                    <Text style={[styles.scheduleMeta, { color: secondaryTextColor }]}>{item.location || 'No location'}</Text>
                    <Text style={[styles.scheduleMeta, { color: secondaryTextColor }]}>Slots: {item.bookedCount || 0}/{item.slotLimit || 0}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    isSelected && styles.selectButtonSelected,
                    isDisabled && styles.disabledButton,
                    hasLockedSelection && !isSelected && styles.selectButtonLocked,
                  ]}
                  activeOpacity={0.85}
                  disabled={isDisabled}
                  onPress={() => handleChooseSchedule(item)}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={OCEAN_DEEP} />
                  ) : (
                    <Text style={styles.selectButtonText}>
                      {isSelected ? 'SELECTED' : hasLockedSelection ? 'LOCKED' : 'CHOOSE SCHEDULE'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.22)' : 'rgba(212, 175, 55, 0.1)' }]}>
        {[
          ['view-dashboard-outline', 'Status', false, handleGoStatus],
          ['calendar-check-outline', 'Appointment', true, null],
          ['bullhorn-outline', 'Announcement', false, handleGoAnnouncement],
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
  darkModeToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    backgroundColor: OCEAN_DEEP,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 4,
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
  scheduleCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 12,
    marginBottom: 10,
  },
  scheduleTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    marginRight: 10,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDate: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleMeta: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 2,
  },
  selectButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  selectButtonSelected: {
    backgroundColor: SUCCESS,
  },
  selectButtonLocked: {
    backgroundColor: SLATE_300,
  },
  selectButtonText: {
    color: OCEAN_DEEP,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  disabledButton: {
    opacity: 0.75,
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
