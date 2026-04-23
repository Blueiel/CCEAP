import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set, get, serverTimestamp } from 'firebase/database';
import { auth, database } from '../../lib/firebase';
import { useTheme } from '../../lib/ThemeContext';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#003550';
const CARD_ALT_BG = '#12324E';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';

// Light mode colors
const LIGHT_BG = '#f5f5f5';
const LIGHT_CARD = '#ffffff';
const LIGHT_TEXT = '#1a1a1a';
const LIGHT_TEXT_SECONDARY = '#666666';
const LIGHT_DROPDOWN_BG = '#f9f9f9';
const PICKER_OPTION_COLOR = Platform.OS === 'android' ? OCEAN_DEEP : SLATE_100;
const PICKER_PLACEHOLDER_COLOR = Platform.OS === 'android' ? '#64748b' : SLATE_300;

const getSignupErrorMessage = (code) => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use. Try logging in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase Auth settings.';
    default:
      return 'Unable to create account right now. Please try again.';
  }
};

export default function SignupScreen({ navigation }) {
  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [school, setSchool] = React.useState('');
  const [yearLevel, setYearLevel] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const { darkMode, setDarkMode } = useTheme();
  const [schoolOptions, setSchoolOptions] = React.useState([]);
  const [loadingSchools, setLoadingSchools] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Force light mode for auth screens
    setDarkMode(false);
  }, [setDarkMode]);

  const handleDarkModeToggle = () => {
    setDarkMode(false);
  };

  const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const headerBgColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
  const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
  const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
  const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

  React.useEffect(() => {
    const loadSchoolOptions = async () => {
      try {
        setLoadingSchools(true);
        const snapshot = await get(ref(database, 'adminConfig/schools'));

        if (!snapshot.exists()) {
          setSchoolOptions([]);
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

        setSchoolOptions(normalized);
      } catch {
        setSchoolOptions([]);
      } finally {
        setLoadingSchools(false);
      }
    };

    loadSchoolOptions();
  }, []);

  const handleSignup = async () => {
    const normalizedFirstName = firstName.trim();
    const normalizedMiddleName = middleName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSchool = school.trim();
    const normalizedYearLevel = yearLevel.trim();

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !password || !confirmPassword || !normalizedSchool || !normalizedYearLevel) {
      Alert.alert('Missing fields', 'Please complete all required fields (first name and last name are required).');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Password and confirm password must match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const { user } = userCredential;

      // Combine names for display
      const fullName = normalizedMiddleName 
        ? `${normalizedFirstName} ${normalizedMiddleName} ${normalizedLastName}`
        : `${normalizedFirstName} ${normalizedLastName}`;

      await updateProfile(user, { displayName: fullName });

      let profileSaved = true;
      try {
        await set(ref(database, `users/${user.uid}`), {
          uid: user.uid,
          firstName: normalizedFirstName,
          middleName: normalizedMiddleName,
          lastName: normalizedLastName,
          fullName: fullName,
          email: normalizedEmail,
          school: normalizedSchool,
          yearLevel: normalizedYearLevel,
          role: 'scholar',
          createdAt: serverTimestamp(),
        });
      } catch {
        profileSaved = false;
      }

      if (profileSaved) {
        Alert.alert('Account created', 'Your account has been created successfully.', [
          { text: 'OK', onPress: () => navigation?.replace('Login') },
        ]);
      } else {
        Alert.alert(
          'Account created',
          'Sign up succeeded, but profile sync failed. You can still sign in now.',
          [{ text: 'OK', onPress: () => navigation?.replace('Login') }]
        );
      }
    } catch (error) {
      Alert.alert('Sign up failed', getSignupErrorMessage(error?.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color={textColor} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="school" size={32} color={GOLD} />
          </View>
        </View>

        <View style={styles.container}>
          <Text style={[styles.title, { color: textColor }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Join Scholar and track your academic journey</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>First Name</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="John"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Middle Name</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Michael (optional)"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={middleName}
                onChangeText={setMiddleName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Last Name</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Doe"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>School</Text>
            <View style={[styles.pickerWrapper, { backgroundColor: LIGHT_DROPDOWN_BG, borderColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="school-outline" size={20} color={GOLD} style={styles.pickerIconLeft} />
              <Picker
                selectedValue={school}
                onValueChange={setSchool}
                style={[styles.picker, { color: LIGHT_TEXT, backgroundColor: LIGHT_DROPDOWN_BG }]}
                dropdownIconColor={GOLD}
                mode="dropdown"
                itemStyle={[styles.pickerItem, { color: LIGHT_TEXT, backgroundColor: LIGHT_DROPDOWN_BG }]}
              >
                <Picker.Item
                  label={loadingSchools ? 'Loading schools...' : schoolOptions.length ? 'Select School' : 'No schools available'}
                  value=""
                  color={LIGHT_TEXT_SECONDARY}
                />
                {schoolOptions.map((schoolName) => (
                  <Picker.Item key={schoolName} label={schoolName} value={schoolName} color={LIGHT_TEXT} />
                ))}
              </Picker>
            </View>
            {!loadingSchools && schoolOptions.length === 0 ? (
              <Text style={[styles.helperText, { color: secondaryTextColor }]}>No school options yet. Please contact admin.</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Year Level</Text>
            <View style={[styles.pickerWrapper, { backgroundColor: LIGHT_DROPDOWN_BG, borderColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="clipboard-outline" size={20} color={GOLD} style={styles.pickerIconLeft} />
              <Picker
                selectedValue={yearLevel}
                onValueChange={setYearLevel}
                style={[styles.picker, { color: LIGHT_TEXT, backgroundColor: LIGHT_DROPDOWN_BG }]}
                dropdownIconColor={GOLD}
                mode="dropdown"
                itemStyle={[styles.pickerItem, { color: LIGHT_TEXT, backgroundColor: LIGHT_DROPDOWN_BG }]}
              >
                <Picker.Item label="Select Year Level" value="" color={LIGHT_TEXT_SECONDARY} />
                <Picker.Item label="1st Year" value="1st Year" color={LIGHT_TEXT} />
                <Picker.Item label="2nd Year" value="2nd Year" color={LIGHT_TEXT} />
                <Picker.Item label="3rd Year" value="3rd Year" color={LIGHT_TEXT} />
                <Picker.Item label="4th Year" value="4th Year" color={LIGHT_TEXT} />
              </Picker>
            </View>
            <Text style={[styles.helperText, { color: secondaryTextColor }]}>Scroll to select your year level</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Email</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="email-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="your@email.com"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Password</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Create a password"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={GOLD}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Confirm Password</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="lock-check-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Confirm your password"
                placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.5)' : 'rgba(26, 26, 26, 0.4)'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialCommunityIcons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={GOLD}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.termsContainer}>
            <MaterialCommunityIcons name="checkbox-marked-outline" size={20} color={GOLD} />
            <Text style={[styles.termsText, { color: secondaryTextColor }]}>
              I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleSignup}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: secondaryTextColor }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: OCEAN_DEEP,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    backgroundColor: OCEAN_DEEP,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 32,
  },
  logoContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: SLATE_100,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: SLATE_300,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: SLATE_100,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  input: {
    flex: 1,
    color: SLATE_100,
    fontSize: 14,
    marginLeft: 10,
    marginRight: 10,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  termsText: {
    color: SLATE_300,
    fontSize: 12,
    marginLeft: 10,
    lineHeight: 18,
    flex: 1,
  },
  termsLink: {
    color: GOLD,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: OCEAN_DEEP,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    color: SLATE_300,
    fontSize: 13,
  },
  signInLink: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerWrapper: {
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pickerIconLeft: {
    position: 'absolute',
    left: 12,
    zIndex: 0,
    pointerEvents: 'none',
  },
  picker: {
    flex: 1,
    marginLeft: 28,
    height: 50,
    color: LIGHT_TEXT,
  },
  pickerItem: {
    color: LIGHT_TEXT,
    fontSize: 14,
    height: 50,
    backgroundColor: LIGHT_DROPDOWN_BG,
  },
  helperText: {
    fontSize: 11,
    color: SLATE_300,
    marginTop: 4,
    fontStyle: 'italic',
  },
  darkModeToggle: {
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
