import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get, push, ref, serverTimestamp, set, update, remove } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { auth, database } from '../../lib/firebase';
import { useTheme } from '../../lib/ThemeContext';

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

const formatDateValue = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeValue = (value) =>
  value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

export default function ScheduleManager() {
  const navigation = useNavigation();
  const DateTimePickerModule = React.useMemo(() => {
    try {
      return require('@react-native-community/datetimepicker');
    } catch {
      return null;
    }
  }, []);
  const NativeDateTimePicker = DateTimePickerModule?.default || null;

  const [headerFullName, setHeaderFullName] = React.useState('');
  const [darkMode, setDarkMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [schedules, setSchedules] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState('appointments');
  const [editingScheduleId, setEditingScheduleId] = React.useState('');

  const [date, setDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [dateValue, setDateValue] = React.useState(new Date());
  const [startTimeValue, setStartTimeValue] = React.useState(new Date());
  const [endTimeValue, setEndTimeValue] = React.useState(new Date());
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  const [slotLimit, setSlotLimit] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [grantDate, setGrantDate] = React.useState('');
  const [grantTime, setGrantTime] = React.useState('');
  const [grantLocation, setGrantLocation] = React.useState('');
  const [grantDateValue, setGrantDateValue] = React.useState(new Date());
  const [grantTimeValue, setGrantTimeValue] = React.useState(new Date());
  const [showGrantDatePicker, setShowGrantDatePicker] = React.useState(false);
  const [showGrantTimePicker, setShowGrantTimePicker] = React.useState(false);
  const [savingGrantSchedule, setSavingGrantSchedule] = React.useState(false);
  const [currentGrantSchedule, setCurrentGrantSchedule] = React.useState(null);

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

  const handleDarkModeToggle = () => {
    toggleDarkMode();
  };

  const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const headerBgColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
  const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
  const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

  const loadHeaderName = React.useCallback(async () => {
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

  const loadSchedules = React.useCallback(async () => {
    try {
      setLoading(true);
      const [scheduleSnapshot, grantSnapshot] = await Promise.all([
        get(ref(database, 'appointmentSchedules')),
        get(ref(database, 'grantClaimingSchedule/current')),
      ]);

      if (!scheduleSnapshot.exists()) {
        setSchedules([]);
      } else {
        const rows = Object.entries(scheduleSnapshot.val() || {}).map(([id, value]) => ({
          id,
          ...(value || {}),
        }));

        rows.sort((a, b) => {
          const dateA = `${a.date || ''} ${a.startTime || ''}`.trim();
          const dateB = `${b.date || ''} ${b.startTime || ''}`.trim();
          return dateA.localeCompare(dateB);
        });

        setSchedules(rows);
      }

      if (grantSnapshot.exists()) {
        const schedule = grantSnapshot.val() || {};
        setCurrentGrantSchedule(schedule);
        setGrantDate(schedule?.date || '');
        setGrantTime(schedule?.time || '');
        setGrantLocation(schedule?.location || '');
      } else {
        setCurrentGrantSchedule(null);
      }
    } catch {
      Alert.alert('Error', 'Unable to load schedules right now.');
      setSchedules([]);
      setCurrentGrantSchedule(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadHeaderName();
    loadSchedules();
  }, [loadHeaderName, loadSchedules]);

  useFocusEffect(
    React.useCallback(() => {
      loadSchedules();
    }, [loadSchedules])
  );

  const onChangeDate = (_, selectedDate) => {
    setShowDatePicker(false);
    if (!selectedDate) {
      return;
    }

    setDateValue(selectedDate);
    setDate(formatDateValue(selectedDate));
  };

  const onChangeStartTime = (_, selectedTime) => {
    setShowStartTimePicker(false);
    if (!selectedTime) {
      return;
    }

    setStartTimeValue(selectedTime);
    setStartTime(formatTimeValue(selectedTime));
  };

  const onChangeEndTime = (_, selectedTime) => {
    setShowEndTimePicker(false);
    if (!selectedTime) {
      return;
    }

    setEndTimeValue(selectedTime);
    setEndTime(formatTimeValue(selectedTime));
  };

  const onChangeGrantDate = (_, selectedDate) => {
    setShowGrantDatePicker(false);
    if (!selectedDate) {
      return;
    }

    setGrantDateValue(selectedDate);
    setGrantDate(formatDateValue(selectedDate));
  };

  const onChangeGrantTime = (_, selectedTime) => {
    setShowGrantTimePicker(false);
    if (!selectedTime) {
      return;
    }

    setGrantTimeValue(selectedTime);
    setGrantTime(formatTimeValue(selectedTime));
  };

  const resetAppointmentForm = () => {
    setDate('');
    setStartTime('');
    setEndTime('');
    const now = new Date();
    setDateValue(now);
    setStartTimeValue(now);
    setEndTimeValue(now);
    setLocation('');
    setSlotLimit('');
    setNotes('');
    setEditingScheduleId('');
  };

  const handleStartEditSchedule = (schedule) => {
    setEditingScheduleId(schedule?.id || '');
    setDate(schedule?.date || '');
    setStartTime(schedule?.startTime || '');
    setEndTime(schedule?.endTime || '');
    setLocation(schedule?.location || '');
    setSlotLimit(String(schedule?.slotLimit || ''));
    setNotes(schedule?.notes || '');
  };

  const handleCancelEditSchedule = () => {
    resetAppointmentForm();
  };

  const handleSaveAppointmentSchedule = async () => {
    const normalizedDate = date.trim();
    const normalizedStartTime = startTime.trim();
    const normalizedEndTime = endTime.trim();
    const normalizedLocation = location.trim();
    const normalizedSlotLimit = slotLimit.trim();
    const normalizedNotes = notes.trim();

    if (!normalizedDate || !normalizedStartTime || !normalizedEndTime || !normalizedLocation || !normalizedSlotLimit) {
      Alert.alert('Missing fields', 'Date, time range, location, and slot limit are required.');
      return;
    }

    const parsedSlots = Number(normalizedSlotLimit);
    if (!Number.isFinite(parsedSlots) || parsedSlots <= 0) {
      Alert.alert('Invalid slots', 'Slot limit must be a positive number.');
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;

      if (editingScheduleId) {
        await update(ref(database, `appointmentSchedules/${editingScheduleId}`), {
          date: normalizedDate,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime,
          location: normalizedLocation,
          slotLimit: parsedSlots,
          notes: normalizedNotes,
          updatedBy: user?.uid || '',
          updatedAt: serverTimestamp(),
        });
      } else {
        await push(ref(database, 'appointmentSchedules'), {
          date: normalizedDate,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime,
          location: normalizedLocation,
          slotLimit: parsedSlots,
          notes: normalizedNotes,
          bookedCount: 0,
          status: 'open',
          createdBy: user?.uid || '',
          createdAt: serverTimestamp(),
        });
      }

      resetAppointmentForm();

      await loadSchedules();
      Alert.alert(
        editingScheduleId ? 'Schedule updated' : 'Schedule created',
        editingScheduleId
          ? 'Appointment schedule has been updated successfully.'
          : 'Appointment schedule is now available for booking.'
      );
    } catch {
      Alert.alert(
        editingScheduleId ? 'Update failed' : 'Create failed',
        editingScheduleId
          ? 'Unable to update schedule right now.'
          : 'Unable to create schedule right now.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = (schedule) => {
    const scheduleLabel = `${schedule?.date || '--'} ${schedule?.startTime || ''}`.trim();

    Alert.alert(
      'Delete schedule',
      `Delete appointment schedule ${scheduleLabel || ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(database, `appointmentSchedules/${schedule.id}`));

              if (editingScheduleId === schedule.id) {
                resetAppointmentForm();
              }

              await loadSchedules();
              Alert.alert('Deleted', 'Appointment schedule removed successfully.');
            } catch {
              Alert.alert('Delete failed', 'Unable to delete schedule right now.');
            }
          },
        },
      ]
    );
  };

  const handleSaveGrantSchedule = async () => {
    const normalizedDate = grantDate.trim();
    const normalizedTime = grantTime.trim();
    const normalizedLocation = grantLocation.trim();

    if (!normalizedDate || !normalizedTime || !normalizedLocation) {
      Alert.alert('Missing fields', 'Grant date, time, and location are required.');
      return;
    }

    try {
      setSavingGrantSchedule(true);
      const user = auth.currentUser;

      await set(ref(database, 'grantClaimingSchedule/current'), {
        date: normalizedDate,
        time: normalizedTime,
        location: normalizedLocation,
        status: 'active',
        updatedBy: user?.uid || '',
        updatedAt: serverTimestamp(),
      });

      setCurrentGrantSchedule({
        date: normalizedDate,
        time: normalizedTime,
        location: normalizedLocation,
        status: 'active',
      });

      Alert.alert('Saved', 'Grant claiming schedule has been updated.');
    } catch {
      Alert.alert('Save failed', 'Unable to save grant claiming schedule right now.');
    } finally {
      setSavingGrantSchedule(false);
    }
  };

  const handleDeleteGrantSchedule = () => {
    Alert.alert(
      'Delete grant schedule',
      'Delete the current grant claiming schedule? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(database, 'grantClaimingSchedule/current'));
              setCurrentGrantSchedule(null);
              setGrantDate('');
              setGrantTime('');
              setGrantLocation('');
              Alert.alert('Deleted', 'Grant claiming schedule removed successfully.');
            } catch {
              Alert.alert('Delete failed', 'Unable to delete grant schedule right now.');
            }
          },
        },
      ]
    );
  };

  const handleGoHome = () => navigation.replace('AdminDashboard');
  const handleGoScholars = () => navigation.replace('ScholarRegistry');
  const handleGoReviews = () => navigation.replace('Reviews');
  const handleGoAlerts = () => navigation.replace('Alerts');
  const handleGoSettings = () => navigation.replace('AdminSettings');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

      <View style={[styles.header, { backgroundColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.brand, { color: textColor }]}>Hi, {headerFullName || 'Admin'}</Text>
        </View>

        <TouchableOpacity style={[styles.darkModeToggle, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleDarkModeToggle}>
          <MaterialCommunityIcons name={darkMode ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={GOLD} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.notifButton, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: textColor }]}>Schedule Manager</Text>

        <View style={[styles.tabContainer, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'appointments' && styles.tabButtonActive]}
            activeOpacity={0.85}
            onPress={() => setActiveTab('appointments')}
          >
            <MaterialCommunityIcons
              name="calendar-clock"
              size={16}
              color={activeTab === 'appointments' ? GOLD : secondaryTextColor}
            />
            <Text style={[styles.tabLabel, activeTab === 'appointments' && styles.tabLabelActive, { color: activeTab === 'appointments' ? GOLD : secondaryTextColor }]}>
              Appointment
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'grant' && styles.tabButtonActive]}
            activeOpacity={0.85}
            onPress={() => setActiveTab('grant')}
          >
            <MaterialCommunityIcons
              name="cash-multiple"
              size={16}
              color={activeTab === 'grant' ? GOLD : secondaryTextColor}
            />
            <Text style={[styles.tabLabel, activeTab === 'grant' && styles.tabLabelActive, { color: activeTab === 'grant' ? GOLD : secondaryTextColor }]}>
              Grant Schedule
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'appointments' && (
          <>
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.08)' }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>{editingScheduleId ? 'Update Appointment Schedule' : 'Create Appointment Schedule'}</Text>

          <Text style={[styles.label, { color: secondaryTextColor }]}>Date (YYYY-MM-DD)</Text>
          {NativeDateTimePicker ? (
            <>
              <TouchableOpacity
                style={[styles.pickerField, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.1)' }]}
                activeOpacity={0.85}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={GOLD} />
                <Text style={[date ? styles.pickerText : styles.pickerPlaceholder, { color: date ? textColor : secondaryTextColor }]}>
                  {date || 'Select date'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <NativeDateTimePicker
                  value={dateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onChangeDate}
                />
              )}
            </>
          ) : (
            <TextInput
              style={[styles.input, { color: textColor, backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.1)' }]}
              value={date}
              onChangeText={setDate}
              placeholder="2026-03-24"
              placeholderTextColor={secondaryTextColor}
            />
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Start Time</Text>
              {NativeDateTimePicker ? (
                <>
                  <TouchableOpacity
                    style={styles.pickerField}
                    activeOpacity={0.85}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <MaterialCommunityIcons name="clock-time-four-outline" size={18} color={GOLD} />
                    <Text style={startTime ? styles.pickerText : styles.pickerPlaceholder}>
                      {startTime || 'Select start'}
                    </Text>
                  </TouchableOpacity>

                  {showStartTimePicker && (
                    <NativeDateTimePicker
                      value={startTimeValue}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onChangeStartTime}
                    />
                  )}
                </>
              ) : (
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00 AM"
                  placeholderTextColor={SLATE_300}
                />
              )}
            </View>

            <View style={styles.col}>
              <Text style={styles.label}>End Time</Text>
              {NativeDateTimePicker ? (
                <>
                  <TouchableOpacity
                    style={styles.pickerField}
                    activeOpacity={0.85}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <MaterialCommunityIcons name="clock-time-four-outline" size={18} color={GOLD} />
                    <Text style={endTime ? styles.pickerText : styles.pickerPlaceholder}>
                      {endTime || 'Select end'}
                    </Text>
                  </TouchableOpacity>

                  {showEndTimePicker && (
                    <NativeDateTimePicker
                      value={endTimeValue}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onChangeEndTime}
                    />
                  )}
                </>
              ) : (
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="12:00 PM"
                  placeholderTextColor={SLATE_300}
                />
              )}
            </View>
          </View>

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="City Convention Center"
            placeholderTextColor={SLATE_300}
          />

          <Text style={styles.label}>Slot Limit</Text>
          <TextInput
            style={styles.input}
            value={slotLimit}
            onChangeText={setSlotLimit}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={SLATE_300}
          />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Requirements passing schedule details"
            placeholderTextColor={SLATE_300}
          />

              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.disabledButton]}
                activeOpacity={0.85}
                disabled={saving}
                onPress={handleSaveAppointmentSchedule}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={OCEAN_DEEP} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: darkMode ? OCEAN_DEEP : '#ffffff' }]}>{editingScheduleId ? 'UPDATE SCHEDULE' : 'CREATE SCHEDULE'}</Text>
                )}
              </TouchableOpacity>

              {editingScheduleId ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)' }]}
                  activeOpacity={0.85}
                  onPress={handleCancelEditSchedule}
                >
                  <Text style={[styles.secondaryButtonText, { color: GOLD }]}>CANCEL EDIT</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.cardSpacing}>
              <Text style={styles.cardTitle}>Upcoming Schedules</Text>

              {loading ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="large" color={GOLD} />
                </View>
              ) : schedules.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={42} color={secondaryTextColor} />
                  <Text style={[styles.emptyTitle, { color: textColor }]}>No schedules yet</Text>
                  <Text style={[styles.emptyText, { color: secondaryTextColor }]}>Create your first appointment schedule above.</Text>
                </View>
              ) : (
                schedules.map((item) => (
                  <View key={item.id} style={[styles.scheduleItem, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
                    <View style={[styles.scheduleIconWrap, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)' }]}>
                      <MaterialCommunityIcons name="calendar-clock" size={18} color={GOLD} />
                    </View>

                    <View style={styles.scheduleInfo}>
                      <Text style={[styles.scheduleDate, { color: textColor }]}>{item.date || 'No date'}</Text>
                      <Text style={[styles.scheduleMeta, { color: secondaryTextColor }]}>
                        {item.startTime || '--'} - {item.endTime || '--'}
                      </Text>
                      <Text style={styles.scheduleMeta}>{item.location || 'No location'}</Text>
                      <Text style={styles.scheduleMeta}>Slots: {item.bookedCount || 0}/{item.slotLimit || 0}</Text>
                    </View>

                    <View style={styles.itemActionsRight}>
                      <TouchableOpacity
                        style={styles.itemIconActionButton}
                        activeOpacity={0.85}
                        onPress={() => handleStartEditSchedule(item)}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={16} color={GOLD} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.itemIconActionButton, styles.itemDeleteIconButton]}
                        activeOpacity={0.85}
                        onPress={() => handleDeleteSchedule(item)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#fecaca" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'grant' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Grant Claiming Scheduler</Text>

            <Text style={styles.label}>Grant Date</Text>
            {NativeDateTimePicker ? (
              <>
                <TouchableOpacity
                  style={styles.pickerField}
                  activeOpacity={0.85}
                  onPress={() => setShowGrantDatePicker(true)}
                >
                  <MaterialCommunityIcons name="calendar-month-outline" size={18} color={GOLD} />
                  <Text style={grantDate ? styles.pickerText : styles.pickerPlaceholder}>
                    {grantDate || 'Select grant date'}
                  </Text>
                </TouchableOpacity>

                {showGrantDatePicker && (
                  <NativeDateTimePicker
                    value={grantDateValue}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onChangeGrantDate}
                  />
                )}
              </>
            ) : (
              <TextInput
                style={styles.input}
                value={grantDate}
                onChangeText={setGrantDate}
                placeholder="2026-03-24"
                placeholderTextColor={SLATE_300}
              />
            )}

            <Text style={styles.label}>Grant Time</Text>
            {NativeDateTimePicker ? (
              <>
                <TouchableOpacity
                  style={styles.pickerField}
                  activeOpacity={0.85}
                  onPress={() => setShowGrantTimePicker(true)}
                >
                  <MaterialCommunityIcons name="clock-time-four-outline" size={18} color={GOLD} />
                  <Text style={grantTime ? styles.pickerText : styles.pickerPlaceholder}>
                    {grantTime || 'Select grant time'}
                  </Text>
                </TouchableOpacity>

                {showGrantTimePicker && (
                  <NativeDateTimePicker
                    value={grantTimeValue}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onChangeGrantTime}
                  />
                )}
              </>
            ) : (
              <TextInput
                style={styles.input}
                value={grantTime}
                onChangeText={setGrantTime}
                placeholder="08:00 AM"
                placeholderTextColor={SLATE_300}
              />
            )}

            <Text style={styles.label}>Grant Location</Text>
            <TextInput
              style={styles.input}
              value={grantLocation}
              onChangeText={setGrantLocation}
              placeholder="City Convention Center"
              placeholderTextColor={SLATE_300}
            />

            <TouchableOpacity
              style={[styles.primaryButton, savingGrantSchedule && styles.disabledButton]}
              activeOpacity={0.85}
              disabled={savingGrantSchedule}
              onPress={handleSaveGrantSchedule}
            >
              {savingGrantSchedule ? (
                <ActivityIndicator size="small" color={OCEAN_DEEP} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: darkMode ? OCEAN_DEEP : '#ffffff' }]}>SAVE GRANT CLAIMING SCHEDULE</Text>
              )}
            </TouchableOpacity>

            {currentGrantSchedule ? (
              <View style={[styles.grantPreviewCard, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', borderColor: darkMode ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.08)' }]}>
                <View style={styles.grantPreviewRow}>
                  <View style={styles.grantPreviewInfo}>
                    <Text style={[styles.grantPreviewTitle, { color: GOLD }]}>Current Grant Schedule</Text>
                    <Text style={[styles.grantPreviewValue, { color: textColor }]}>
                      {(currentGrantSchedule?.date || '--')} • {(currentGrantSchedule?.time || '--')}
                    </Text>
                    <Text style={[styles.grantPreviewMeta, { color: secondaryTextColor }]}>{currentGrantSchedule?.location || 'No location'}</Text>
                  </View>

                  <View style={styles.grantActionsRight}>
                    <TouchableOpacity
                      style={[styles.grantActionButton, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)' }]}
                      activeOpacity={0.85}
                      disabled={savingGrantSchedule}
                      onPress={handleSaveGrantSchedule}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={14} color={GOLD} />
                      <Text style={[styles.grantActionText, { color: GOLD }]}>Update</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.grantActionButton, styles.grantDeleteButton, { backgroundColor: darkMode ? 'rgba(254,202,202,0.12)' : 'rgba(254,202,202,0.06)' }]}
                      activeOpacity={0.85}
                      onPress={handleDeleteGrantSchedule}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={14} color="#fecaca" />
                      <Text style={[styles.grantActionText, styles.grantDeleteText, { color: '#fecaca' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.22)' : 'rgba(212, 175, 55, 0.1)' }]}>
        {[
          ['home-outline', 'Home', false, handleGoHome],
          ['account-group-outline', 'Scholars', false, handleGoScholars],
          ['file-document-outline', 'Reviews', false, handleGoReviews],
          ['bell-outline', 'Alerts', false, handleGoAlerts],
          ['cog-outline', 'Settings', false, handleGoSettings],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity key={label} style={styles.navItem} activeOpacity={0.8} onPress={onPress || undefined}>
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : secondaryTextColor} />
            <Text style={[styles.navLabel, active && styles.navLabelActive, !active && { color: secondaryTextColor }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = {
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: GOLD,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 14,
  },
  cardSpacing: {
    marginTop: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  pickerField: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
  },
  pickerPlaceholder: {
    fontSize: 13,
    marginLeft: 8,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    paddingVertical: 26,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    marginTop: 4,
  },
  grantPreviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 12,
    marginTop: 12,
  },
  grantPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  grantPreviewInfo: {
    flex: 1,
  },
  grantPreviewTitle: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  grantPreviewValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  grantPreviewMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  grantActionsRight: {
    marginLeft: 10,
    alignItems: 'center',
  },
  grantActionButton: {
    minWidth: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantActionText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
  },
  grantDeleteButton: {
    marginTop: 6,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  grantDeleteText: {
  },
  scheduleItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  itemActionsRight: {
    marginLeft: 10,
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'center',
  },
  itemIconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
  },
  itemDeleteIconButton: {
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginTop: 6,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
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
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: GOLD,
  },
  darkModeToggle: {
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
};
