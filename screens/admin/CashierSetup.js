import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ref, get, set, serverTimestamp } from 'firebase/database';
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

const normalizeCashier = (item, index) => ({
  id: String(item?.id || Date.now() + index),
  fullName: (item?.fullName || '').trim(),
  schools: Array.isArray(item?.schools)
    ? item.schools.map((entry) => String(entry || '').trim()).filter(Boolean)
    : (item?.school || item?.counterLabel || '').trim()
    ? [String(item?.school || item?.counterLabel).trim()]
    : [],
  active: item?.active !== false,
});

export default function CashierSetup() {
  const navigation = useNavigation();
  const { darkMode, toggleDarkMode } = useTheme();
  const [headerFullName, setHeaderFullName] = React.useState('Admin');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingCashierId, setDeletingCashierId] = React.useState('');
  const [cashierName, setCashierName] = React.useState('');
  const [selectedSchools, setSelectedSchools] = React.useState([]);
  const [schoolOptions, setSchoolOptions] = React.useState([]);
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = React.useState(false);
  const [cashiers, setCashiers] = React.useState([]);

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

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const user = auth.currentUser;

    if (!user?.uid) {
      setHeaderFullName('Admin');
      setCashiers([]);
      setLoading(false);
      return;
    }

    try {
      const [profileSnapshot, cashiersSnapshot, usersSnapshot, schoolsSnapshot] = await Promise.all([
        get(ref(database, `users/${user.uid}`)),
        get(ref(database, 'adminConfig/cashiers')),
        get(ref(database, 'users')),
        get(ref(database, 'adminConfig/schools')),
      ]);

      const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;
      const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Admin';
      setHeaderFullName(fullName);

      const rawCashiers = cashiersSnapshot.exists() ? cashiersSnapshot.val() : null;
      const items = Array.isArray(rawCashiers?.items) ? rawCashiers.items : [];

      const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
      const scholarSchools = Object.values(users)
        .filter((item) => item?.role === 'scholar')
        .map((item) => (item?.school || '').trim())
        .filter(Boolean);

      const rawSchools = schoolsSnapshot.exists() ? schoolsSnapshot.val() : null;
      const configuredSchools = Array.isArray(rawSchools?.items)
        ? rawSchools.items.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : [];

      const nextSchoolOptions = Array.from(new Set([...configuredSchools, ...scholarSchools]))
        .sort((a, b) => a.localeCompare(b));

      setSchoolOptions(nextSchoolOptions);

      setCashiers(
        items
          .map((item, index) => normalizeCashier(item, index))
          .filter((item) => item.fullName && item.schools.length)
          .sort((a, b) => (a.schools[0] || '').localeCompare(b.schools[0] || '') || a.fullName.localeCompare(b.fullName))
      );
    } catch {
      setHeaderFullName(user?.displayName?.trim() || 'Admin');
      setSchoolOptions([]);
      setCashiers([]);
      Alert.alert('Error', 'Unable to load cashier setup right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const persistCashiers = async (nextCashiers) => {
    await set(ref(database, 'adminConfig/cashiers'), {
      items: nextCashiers.map((item, index) => normalizeCashier(item, index)),
      updatedBy: auth.currentUser?.uid || 'unknown-admin',
      updatedAt: serverTimestamp(),
    });
  };

  const handleAddCashier = async () => {
    const fullName = cashierName.trim();
    const schools = selectedSchools;

    if (!fullName || !schools.length) {
      Alert.alert('Validation', 'Cashier name and at least one school assignment are required.');
      return;
    }

    const exists = cashiers.some((item) => item.fullName.toLowerCase() === fullName.toLowerCase());

    if (exists) {
      Alert.alert('Duplicate entry', 'Cashier name already exists.');
      return;
    }

    try {
      setSaving(true);
      const nextCashiers = [
        ...cashiers,
        {
          id: `${Date.now()}`,
          fullName,
          schools,
          active: true,
        },
      ].sort((a, b) => (a.schools[0] || '').localeCompare(b.schools[0] || '') || a.fullName.localeCompare(b.fullName));

      await persistCashiers(nextCashiers);
      setCashiers(nextCashiers);
      setCashierName('');
      setSelectedSchools([]);
      setIsSchoolDropdownOpen(false);
      Alert.alert('Saved', 'Cashier added successfully.');
    } catch {
      Alert.alert('Error', 'Unable to save cashier right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCashier = (cashier) => {
    Alert.alert('Delete cashier', `Remove ${cashier?.fullName || 'this cashier'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingCashierId(cashier.id);
            const nextCashiers = cashiers.filter((item) => item.id !== cashier.id);
            await persistCashiers(nextCashiers);
            setCashiers(nextCashiers);
          } catch {
            Alert.alert('Error', 'Unable to delete cashier right now.');
          } finally {
            setDeletingCashierId('');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.brand, { color: textColor }]}>Cashier Setup</Text>
          <Text style={[styles.headerSubtitle, { color: secondaryTextColor }]}>Hi, {headerFullName || 'Admin'}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.darkModeToggle, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleDarkModeToggle}>
            <MaterialCommunityIcons name={darkMode ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={GOLD} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} activeOpacity={0.85} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={GOLD} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.08)' }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Add Cashier</Text>

            <Text style={[styles.label, { color: secondaryTextColor }]}>Cashier Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor }]}
              value={cashierName}
              onChangeText={setCashierName}
              placeholder="Enter cashier full name"
              placeholderTextColor={SLATE_300}
            />

            <Text style={[styles.label, { color: secondaryTextColor }]}>School Assignment</Text>
            <TouchableOpacity
              style={[styles.dropdownTrigger, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
              activeOpacity={0.85}
              onPress={() => setIsSchoolDropdownOpen((prev) => !prev)}
            >
              <Text style={[selectedSchools.length ? styles.dropdownValue : styles.dropdownPlaceholder, { color: selectedSchools.length ? textColor : secondaryTextColor }]}>
                {selectedSchools.length
                  ? `${selectedSchools.length} school${selectedSchools.length > 1 ? 's' : ''} selected`
                  : 'Select school(s)'}
              </Text>
              <MaterialCommunityIcons
                name={isSchoolDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={secondaryTextColor}
              />
            </TouchableOpacity>

            {isSchoolDropdownOpen ? (
              <View style={[styles.dropdownMenu, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}>
                <ScrollView
                  style={styles.dropdownScroll}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  {schoolOptions.map((school) => {
                    const isActive = selectedSchools.includes(school);
                    return (
                      <TouchableOpacity
                        key={school}
                        style={[styles.dropdownItem, isActive && { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)' }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedSchools((prev) =>
                            prev.includes(school)
                              ? prev.filter((entry) => entry !== school)
                              : [...prev, school]
                          );
                        }}
                      >
                        <MaterialCommunityIcons
                          name={isActive ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={18}
                          color={isActive ? GOLD : SLATE_300}
                          style={styles.dropdownCheck}
                        />
                        <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive, { color: isActive ? GOLD : textColor }]}>{school}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.dropdownDoneButton, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.06)' }]}
                  activeOpacity={0.85}
                  onPress={() => setIsSchoolDropdownOpen(false)}
                >
                  <Text style={[styles.dropdownDoneText, { color: GOLD }]}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              activeOpacity={0.85}
              disabled={saving}
              onPress={handleAddCashier}
            >
              {saving ? (
                <ActivityIndicator size="small" color={OCEAN_DEEP} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: darkMode ? OCEAN_DEEP : '#ffffff' }]}>ADD CASHIER</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.card, styles.cardSpacing, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.08)' }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Configured Cashiers</Text>

            {cashiers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="account-off-outline" size={22} color={secondaryTextColor} />
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No cashier assigned yet.</Text>
              </View>
            ) : (
              cashiers.map((item) => {
                const isDeleting = deletingCashierId === item.id;

                return (
                <View key={item.id} style={[styles.cashierItem, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}>
                  <View style={styles.cashierIconWrap}>
                    <MaterialCommunityIcons name="account-cash-outline" size={16} color={GOLD} />
                  </View>
                  <View style={[styles.cashierInfo]}>
                    <Text style={[styles.cashierName, { color: textColor }]}>{item.fullName}</Text>
                    <Text style={[styles.cashierCounter, { color: secondaryTextColor }]}>{item.schools.join(' • ')}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.1)' }, isDeleting && styles.deleteButtonDisabled]}
                    activeOpacity={0.85}
                    disabled={isDeleting}
                    onPress={() => handleDeleteCashier(item)}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color={secondaryTextColor} />
                    ) : (
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#fecaca" />
                    )}
                  </TouchableOpacity>
                </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
    marginRight: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OCEAN_DEEP,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    borderRadius: 14,
    padding: 14,
  },
  cardSpacing: {
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownPlaceholder: {
    fontSize: 14,
  },
  dropdownValue: {
    fontSize: 14,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: 10,
    marginBottom: 12,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.12)',
  },
  dropdownCheck: {
    marginRight: 8,
  },
  dropdownItemActive: {
  },
  dropdownItemText: {
    fontSize: 13,
  },
  dropdownItemTextActive: {
    fontWeight: '700',
  },
  dropdownDoneButton: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  dropdownDoneText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  emptyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 12,
    marginLeft: 8,
  },
  cashierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  cashierIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    marginRight: 10,
  },
  cashierInfo: {
    flex: 1,
  },
  cashierName: {
    fontSize: 13,
    fontWeight: '700',
  },
  cashierCounter: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.35)',
    marginLeft: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
});
