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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ref, get, push, set } from 'firebase/database';
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

export default function Announcement() {
  const navigation = useNavigation();
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);

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
  }, []);

  const handlePostAnnouncement = async () => {
    const user = auth.currentUser;
    const normalizedTitle = title.trim();
    const normalizedMessage = message.trim();

    if (!normalizedTitle || !normalizedMessage) {
      Alert.alert('Missing fields', 'Please enter both title and announcement message.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Session expired', 'Please log in again.');
      navigation?.replace('Login');
      return;
    }

    try {
      setPosting(true);

      const announcementsRef = ref(database, 'announcements');
      const newAnnouncementRef = push(announcementsRef);

      await set(newAnnouncementRef, {
        title: normalizedTitle,
        message: normalizedMessage,
        createdAt: Date.now(),
        createdBy: user.uid,
        createdByName: headerFullName || user?.displayName || 'Admin',
        status: 'posted',
      });

      setTitle('');
      setMessage('');
      Alert.alert('Posted', 'Announcement has been posted successfully.');
    } catch {
      Alert.alert('Post failed', 'Unable to post announcement right now.');
    } finally {
      setPosting(false);
    }
  };

  const handleGoHome = () => navigation.replace('AdminDashboard');
  const handleGoScholars = () => navigation.replace('ScholarRegistry');
  const handleGoReviews = () => navigation.replace('Reviews');
  const handleGoAlerts = () => navigation.replace('Alerts');
  const handleGoSettings = () => navigation.replace('AdminSettings');

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
  };

  const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const headerBgColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
  const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
  const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
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
        <Text style={[styles.pageTitle, { color: textColor }]}>Post Announcement</Text>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.1)' }]}>
          <Text style={[styles.label, { color: textColor }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : 'rgba(212, 175, 55, 0.05)', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}
            placeholder="Enter announcement title"
            placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
            value={title}
            onChangeText={setTitle}
            editable={!posting}
          />

          <Text style={[styles.label, { color: textColor }]}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: darkMode ? CARD_ALT_BG : 'rgba(212, 175, 55, 0.05)', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}
            placeholder="Write your announcement here"
            placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
            multiline
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
            editable={!posting}
          />

          <TouchableOpacity
            style={[styles.postButton, posting && styles.disabledButton]}
            activeOpacity={0.85}
            onPress={handlePostAnnouncement}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator color={OCEAN_DEEP} />
            ) : (
              <Text style={styles.postButtonText}>POST ANNOUNCEMENT</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.22)' : 'rgba(212, 175, 55, 0.1)' }]}>
        {[
          ['home-outline', 'Home', false, handleGoHome],
          ['account-group-outline', 'Scholars', false, handleGoScholars],
          ['file-document-outline', 'Reviews', false, handleGoReviews],
          ['bell-outline', 'Alerts', false, handleGoAlerts],
          ['cog-outline', 'Settings', false, handleGoSettings],
        ].map(([icon, label, active, onPress]) => (
          <TouchableOpacity
            key={label}
            style={styles.navItem}
            activeOpacity={0.8}
            onPress={onPress || undefined}
          >
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
    backgroundColor: OCEAN_DEEP,
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
    paddingTop: 16,
    paddingBottom: 110,
    backgroundColor: OCEAN_DEEP,
  },
  pageTitle: {
    color: SLATE_100,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    borderRadius: 14,
    padding: 14,
  },
  label: {
    color: SLATE_300,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: CARD_ALT_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 10,
    color: SLATE_100,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 120,
  },
  postButton: {
    marginTop: 6,
    backgroundColor: GOLD,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  postButtonText: {
    color: OCEAN_DEEP,
    fontSize: 13,
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
