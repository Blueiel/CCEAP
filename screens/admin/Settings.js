import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ref, get, set, update, remove, serverTimestamp } from 'firebase/database';
import { signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, updateProfile } from 'firebase/auth';
import { auth, database } from '../../lib/firebase';

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

export default function AdminSettings() {
  const navigation = useNavigation();
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [darkMode, setDarkMode] = React.useState(false);
  const [scholars, setScholars] = React.useState([]);
  const [schools, setSchools] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingSchools, setLoadingSchools] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [schoolNameInput, setSchoolNameInput] = React.useState('');
  const [savingSchool, setSavingSchool] = React.useState(false);
  const [deletingSchoolName, setDeletingSchoolName] = React.useState('');
  const [deletingUid, setDeletingUid] = React.useState('');

  // Admin Profile State
  const [activeTab, setActiveTab] = React.useState('profile'); // 'profile' | 'scholars' | 'schools'
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [updatingAccount, setUpdatingAccount] = React.useState(false);

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

  const loadAdminProfile = React.useCallback(async () => {
    const user = auth.currentUser;

    if (!user) {
      setHeaderFullName('Admin');
      setEmail(user?.email || '');
      return;
    }

    try {
      const snapshot = await get(ref(database, `users/${user.uid}`));
      const profile = snapshot.exists() ? snapshot.val() : null;
      
      const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Admin';
      setHeaderFullName(fullName);
      
      setFirstName(profile?.firstName || '');
      setLastName(profile?.lastName || '');
      setEmail(user?.email || '');
    } catch {
      setHeaderFullName(user?.displayName?.trim() || 'Admin');
      setEmail(user?.email || '');
    }
  }, []);

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

  const loadScholars = React.useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await get(ref(database, 'users'));

      if (!snapshot.exists()) {
        setScholars([]);
        return;
      }

      const users = snapshot.val();
      const scholarList = Object.keys(users)
        .map((uid) => ({ uid, ...(users[uid] || {}) }))
        .filter((user) => user?.role === 'scholar')
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

      setScholars(scholarList);
    } catch {
      Alert.alert('Error', 'Unable to load scholar accounts right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchools = React.useCallback(async () => {
    try {
      setLoadingSchools(true);
      const snapshot = await get(ref(database, 'adminConfig/schools'));

      if (!snapshot.exists()) {
        setSchools([]);
        return;
      }

      const rawValue = snapshot.val();
      let nextSchools = [];

      if (Array.isArray(rawValue)) {
        nextSchools = rawValue;
      } else if (Array.isArray(rawValue?.items)) {
        nextSchools = rawValue.items;
      }

      const normalized = nextSchools
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .filter((item, index, arr) => arr.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index)
        .sort((a, b) => a.localeCompare(b));

      setSchools(normalized);
    } catch {
      Alert.alert('Error', 'Unable to load school options right now.');
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  const handleSaveAdminProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required.');
      return;
    }

    try {
      setSavingProfile(true);
      const user = auth.currentUser;
      if (!user?.uid) {
        Alert.alert('Session expired', 'Please log in again.');
        navigation?.replace('Login');
        return;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      await update(ref(database, `users/${user.uid}`), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: fullName,
        role: 'admin',
        email: user?.email || '',
        updatedAt: serverTimestamp(),
      });

      await updateProfile(user, { displayName: fullName });

      setHeaderFullName(fullName);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateAdminAccount = async () => {
    if (!password.trim()) {
      Alert.alert('Validation Error', 'Current password is required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    if (newPassword.trim().length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      return;
    }

    try {
      setUpdatingAccount(true);
      const user = auth.currentUser;

      // Reauthenticate with current password
      const credential = EmailAuthProvider.credential(user.email, password);
      
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Current password is incorrect.');
      } else {
        Alert.alert('Error', 'Failed to update password. Please try again.');
      }
    } finally {
      setUpdatingAccount(false);
    }
  };

  React.useEffect(() => {
    loadAdminProfile();
    loadScholars();
    loadSchools();
  }, [loadAdminProfile, loadScholars, loadSchools]);

  useFocusEffect(
    React.useCallback(() => {
      loadScholars();
      loadSchools();
    }, [loadScholars, loadSchools])
  );

  const handleAddSchool = async () => {
    const nextSchool = schoolNameInput.trim();

    if (!nextSchool) {
      Alert.alert('Validation Error', 'School name is required.');
      return;
    }

    const exists = schools.some((item) => item.toLowerCase() === nextSchool.toLowerCase());

    if (exists) {
      Alert.alert('Duplicate School', 'This school already exists in the dropdown list.');
      return;
    }

    try {
      setSavingSchool(true);
      const updatedSchools = [...schools, nextSchool].sort((a, b) => a.localeCompare(b));

      await set(ref(database, 'adminConfig/schools'), {
        items: updatedSchools,
        updatedBy: auth.currentUser?.uid || 'unknown-admin',
        updatedAt: serverTimestamp(),
      });

      setSchools(updatedSchools);
      setSchoolNameInput('');
      Alert.alert('Saved', 'School was added to the signup dropdown.');
    } catch {
      Alert.alert('Error', 'Unable to add school right now.');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleDeleteSchool = async (schoolName) => {
    Alert.alert('Delete school', `Remove ${schoolName} from signup dropdown?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingSchoolName(schoolName);
            const updatedSchools = schools.filter((item) => item !== schoolName);

            await set(ref(database, 'adminConfig/schools'), {
              items: updatedSchools,
              updatedBy: auth.currentUser?.uid || 'unknown-admin',
              updatedAt: serverTimestamp(),
            });

            setSchools(updatedSchools);
          } catch {
            Alert.alert('Error', 'Unable to delete school right now.');
          } finally {
            setDeletingSchoolName('');
          }
        },
      },
    ]);
  };

  const confirmDeleteScholar = (scholar) => {
    const displayName = scholar?.fullName || scholar?.email || 'this scholar';

    Alert.alert(
      'Delete scholar account',
      `Permanently delete ${displayName}, including login credentials and profile data? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteScholar(scholar.uid),
        },
      ]
    );
  };

  const handleDeleteScholar = async (uid) => {
    try {
      setDeletingUid(uid);
      const adminUid = auth.currentUser?.uid || '';

      await remove(ref(database, `users/${uid}`));

      try {
        await set(ref(database, `deletionQueue/${uid}`), {
          uid,
          requestedBy: adminUid,
          requestedAt: serverTimestamp(),
          status: 'pending',
        });
      } catch {
      }

      setScholars((prev) => prev.filter((item) => item.uid !== uid));
      Alert.alert(
        'Deleted',
        'Scholar record was deleted. To free the email for reuse, ensure auth cleanup runs (Cloud Function) or run: npm run delete:process'
      );
    } catch {
      Alert.alert('Delete failed', 'Unable to delete this scholar right now.');
    } finally {
      setDeletingUid('');
    }
  };

  const filteredScholars = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return scholars;
    }

    return scholars.filter((item) => {
      const fullName = (item?.fullName || '').toLowerCase();
      const email = (item?.email || '').toLowerCase();
      const school = (item?.school || '').toLowerCase();

      return fullName.includes(query) || email.includes(query) || school.includes(query);
    });
  }, [searchQuery, scholars]);

  const handleGoHome = () => navigation.replace('AdminDashboard');
  const handleGoScholars = () => navigation.replace('ScholarRegistry');
  const handleGoReviews = () => navigation.replace('Reviews');
  const handleGoAlerts = () => navigation.replace('Alerts');

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
        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: cardBgColor }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
            onPress={() => setActiveTab('profile')}
          >
            <MaterialCommunityIcons
              name="account-edit"
              size={16}
              color={activeTab === 'profile' ? GOLD : secondaryTextColor}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive, { color: activeTab === 'profile' ? GOLD : secondaryTextColor }]}>
              My Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'scholars' && styles.tabButtonActive]}
            onPress={() => setActiveTab('scholars')}
          >
            <MaterialCommunityIcons
              name="account-multiple-outline"
              size={16}
              color={activeTab === 'scholars' ? GOLD : secondaryTextColor}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabLabel, activeTab === 'scholars' && styles.tabLabelActive, { color: activeTab === 'scholars' ? GOLD : secondaryTextColor }]}>
              Manage Scholars
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'schools' && styles.tabButtonActive]}
            onPress={() => setActiveTab('schools')}
          >
            <MaterialCommunityIcons
              name="school-outline"
              size={16}
              color={activeTab === 'schools' ? GOLD : secondaryTextColor}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabLabel, activeTab === 'schools' && styles.tabLabelActive, { color: activeTab === 'schools' ? GOLD : secondaryTextColor }]}>
              Schools
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Admin Profile</Text>

            {/* Profile Info Card */}
            <View style={[styles.profileCard, { backgroundColor: cardBgColor }]}>
              <View style={styles.profileHeader}>
                <View style={styles.largeAvatarWrap}>
                  <MaterialCommunityIcons name="account-circle" size={48} color={GOLD} />
                </View>
                <View style={styles.profileMeta}>
                  <Text style={[styles.profileName, { color: textColor }]}>{headerFullName || 'Admin'}</Text>
                  <Text style={[styles.profileEmail, { color: secondaryTextColor }]}>{email || 'email@example.com'}</Text>
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badge}>ADMINISTRATOR</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Edit Profile Section */}
            <Text style={[styles.subsectionTitle, { color: textColor }]}>Edit Profile Information</Text>
            <View style={[styles.formCard, { backgroundColor: cardBgColor }]}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>First Name</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Enter first name"
                  placeholderTextColor={secondaryTextColor}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>Last Name</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Enter last name"
                  placeholderTextColor={secondaryTextColor}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingProfile && styles.saveButtonDisabled]}
                disabled={savingProfile}
                onPress={handleSaveAdminProfile}
              >
                <MaterialCommunityIcons
                  name={savingProfile ? 'loading' : 'check'}
                  size={16}
                  color={darkMode ? OCEAN_DEEP : '#f5f5f5'}
                />
                <Text style={[styles.saveButtonText, { color: darkMode ? OCEAN_DEEP : '#f5f5f5' }]}>{savingProfile ? 'Saving...' : 'Save Profile'}</Text>
              </TouchableOpacity>
            </View>

            {/* Update Account Section */}
            <Text style={[styles.subsectionTitle, { color: textColor }]}>Update Account</Text>
            <View style={[styles.formCard, { backgroundColor: cardBgColor }]}>
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information-outline" size={16} color={secondaryTextColor} />
                <Text style={[styles.infoBoxText, { color: secondaryTextColor }]}>Email: {email || 'Loading...'}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>Current Password</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Enter current password"
                  placeholderTextColor={secondaryTextColor}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>New Password</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Enter new password"
                  placeholderTextColor={secondaryTextColor}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>Confirm New Password</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={secondaryTextColor}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.updateButton, updatingAccount && styles.updateButtonDisabled]}
                disabled={updatingAccount}
                onPress={handleUpdateAdminAccount}
              >
                <MaterialCommunityIcons
                  name={updatingAccount ? 'loading' : 'lock-reset'}
                  size={16}
                  color={updatingAccount ? secondaryTextColor : (darkMode ? OCEAN_DEEP : '#f5f5f5')}
                />
                <Text style={[styles.updateButtonText, updatingAccount && styles.updateButtonTextDisabled, { color: updatingAccount ? secondaryTextColor : (darkMode ? OCEAN_DEEP : '#f5f5f5') }]}>
                  {updatingAccount ? 'Updating...' : 'Update Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* SCHOLARS TAB */}
        {activeTab === 'scholars' && (
          <>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Manage Scholar Accounts</Text>

            <View style={[styles.summaryCard, { backgroundColor: cardBgColor }]}>
              <Text style={[styles.summaryTitle, { color: textColor }]}>Scholar Account Controls</Text>
              <Text style={[styles.summaryText, { color: secondaryTextColor }]}>Queue scholars for permanent account deletion.</Text>
              <Text style={[styles.summaryCount, { color: GOLD }]}>{filteredScholars.length} scholars</Text>
            </View>

            <View style={[styles.searchWrap, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={secondaryTextColor} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search scholar by name, email, school"
                placeholderTextColor={secondaryTextColor}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={secondaryTextColor} />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={GOLD} />
              </View>
            ) : filteredScholars.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBgColor }]}>
                <MaterialCommunityIcons name="information-outline" size={44} color={secondaryTextColor} />
                <Text style={[styles.emptyTitle, { color: textColor }]}>No scholars found</Text>
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>Try a different search keyword.</Text>
              </View>
            ) : (
              filteredScholars.map((scholar) => {
                const isDeleting = deletingUid === scholar.uid;

                return (
                  <View key={scholar.uid} style={[styles.scholarCard, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
                    <View style={styles.scholarTopRow}>
                      <View style={styles.avatarWrap}>
                        <MaterialCommunityIcons name="account" size={18} color={GOLD} />
                      </View>

                      <View style={styles.scholarInfo}>
                        <Text style={[styles.scholarName, { color: textColor }]}>{scholar.fullName || 'Unknown Scholar'}</Text>
                        <Text style={[styles.scholarMeta, { color: secondaryTextColor }]}>{scholar.school || 'School not specified'}</Text>
                        <Text style={[styles.scholarMeta, { color: secondaryTextColor }]}>{scholar.email || 'No email'}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                      activeOpacity={0.85}
                      disabled={isDeleting}
                      onPress={() => confirmDeleteScholar(scholar)}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={16}
                        color={isDeleting ? SLATE_300 : '#fecaca'}
                      />
                      <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
                        {isDeleting ? 'Queuing...' : 'Delete Scholar Account'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'schools' && (
          <>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Manage Schools</Text>

            <View style={[styles.summaryCard, { backgroundColor: cardBgColor }]}>
              <Text style={[styles.summaryTitle, { color: textColor }]}>School Dropdown Source</Text>
              <Text style={[styles.summaryText, { color: secondaryTextColor }]}>Add schools to control options shown on scholar signup.</Text>
              <Text style={[styles.summaryCount, { color: GOLD }]}>{schools.length} schools</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: cardBgColor }]}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textColor }]}>School Name</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)', backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
                  placeholder="Enter school name"
                  placeholderTextColor={secondaryTextColor}
                  value={schoolNameInput}
                  onChangeText={setSchoolNameInput}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingSchool && styles.saveButtonDisabled]}
                disabled={savingSchool}
                onPress={handleAddSchool}
              >
                <MaterialCommunityIcons
                  name={savingSchool ? 'loading' : 'plus'}
                  size={16}
                  color={darkMode ? OCEAN_DEEP : '#f5f5f5'}
                />
                <Text style={[styles.saveButtonText, { color: darkMode ? OCEAN_DEEP : '#f5f5f5' }]}>{savingSchool ? 'Adding...' : 'Add School'}</Text>
              </TouchableOpacity>
            </View>

            {loadingSchools ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={GOLD} />
              </View>
            ) : schools.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBgColor }]}>
                <MaterialCommunityIcons name="school-outline" size={44} color={secondaryTextColor} />
                <Text style={[styles.emptyTitle, { color: textColor }]}>No schools added</Text>
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>Add a school to populate signup dropdown options.</Text>
              </View>
            ) : (
              schools.map((schoolName) => {
                const isDeleting = deletingSchoolName === schoolName;

                return (
                  <View key={schoolName} style={[styles.schoolItemCard, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
                    <Text style={[styles.schoolItemName, { color: textColor }]}>{schoolName}</Text>

                    <TouchableOpacity
                      style={[styles.schoolDeleteButton, isDeleting && styles.deleteButtonDisabled]}
                      activeOpacity={0.85}
                      disabled={isDeleting}
                      onPress={() => handleDeleteSchool(schoolName)}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={14}
                        color={isDeleting ? secondaryTextColor : '#fecaca'}
                      />
                      <Text style={[styles.schoolDeleteButtonText, isDeleting && styles.deleteButtonTextDisabled, { color: isDeleting ? secondaryTextColor : '#fecaca' }]}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
        {[
          ['home-outline', 'Home', false, handleGoHome],
          ['account-group-outline', 'Scholars', false, handleGoScholars],
          ['file-document-outline', 'Reviews', false, handleGoReviews],
          ['bell-outline', 'Alerts', false, handleGoAlerts],
          ['cog-outline', 'Settings', true, null],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity key={label} style={styles.navItem} activeOpacity={0.8} onPress={onPress || undefined}>
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : secondaryTextColor} />
            <Text style={[styles.navLabel, active && styles.navLabelActive, { color: active ? GOLD : secondaryTextColor }]}>{label}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 110,
    backgroundColor: OCEAN_DEEP,
  },

  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SLATE_300,
  },
  tabLabelActive: {
    color: GOLD,
  },

  // Profile Section Styles
  sectionTitle: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subsectionTitle: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
    letterSpacing: 0.2,
  },

  profileCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 16,
    marginBottom: 14,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: SLATE_100,
    fontSize: 16,
    fontWeight: '700',
  },
  profileEmail: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 4,
  },
  badgeWrap: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  badge: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Form Card Styles
  formCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 14,
    marginBottom: 14,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: SLATE_100,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.25)',
    backgroundColor: CARD_ALT_BG,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: SLATE_100,
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  infoBoxText: {
    color: SLATE_300,
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  // Button Styles
  saveButton: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.5)',
    opacity: 0.6,
  },
  saveButtonText: {
    color: OCEAN_DEEP,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.2,
  },

  updateButton: {
    backgroundColor: CARD_ALT_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  updateButtonDisabled: {
    borderColor: 'rgba(203, 213, 225, 0.25)',
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  updateButtonText: {
    color: SLATE_100,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.2,
  },
  updateButtonTextDisabled: {
    color: SLATE_300,
  },

  // Summary Card (Scholar Management)
  summaryCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: 14,
    marginBottom: 12,
  },
  summaryTitle: {
    color: SLATE_100,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  summaryText: {
    color: SLATE_300,
    fontSize: 12,
  },
  summaryCount: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },

  // Search Styles
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.25)',
    backgroundColor: CARD_ALT_BG,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: SLATE_100,
    fontSize: 13,
    paddingVertical: 10,
  },

  loaderContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },

  // Empty State
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
    marginTop: 5,
  },

  // Scholar Card
  scholarCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 12,
    marginBottom: 10,
  },
  scholarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scholarInfo: {
    flex: 1,
  },
  scholarName: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
  },
  scholarMeta: {
    color: SLATE_300,
    fontSize: 12,
    marginTop: 2,
  },
  schoolItemCard: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolItemName: {
    color: SLATE_100,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  schoolDeleteButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolDeleteButtonText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
  },
  deleteButton: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    borderColor: 'rgba(203, 213, 225, 0.25)',
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  deleteButtonText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  deleteButtonTextDisabled: {
    color: SLATE_300,
  },

  // Bottom Navigation
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
  darkModeToggle: {
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
};