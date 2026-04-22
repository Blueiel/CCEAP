import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { auth, database } from '../../lib/firebase';
import { useTheme } from '../../lib/ThemeContext';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#003550';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';

// Light mode colors
const LIGHT_BG = '#f5f5f5';
const LIGHT_CARD = '#ffffff';
const LIGHT_TEXT = '#1a1a1a';
const LIGHT_TEXT_SECONDARY = '#666666';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { darkMode, setDarkMode } = useTheme();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successState, setSuccessState] = React.useState({
    visible: false,
    name: '',
    targetScreen: 'ScholarDashboard',
  });

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

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const { user } = userCredential;

      const profileSnapshot = await get(ref(database, `users/${user.uid}`));
      const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;

      if (!profile) {
        await signOut(auth);
        Alert.alert(
          'Account unavailable',
          'This account no longer exists in scholar records. Please contact admin.'
        );
        return;
      }

      const fullName = profile?.fullName?.trim() || user.displayName?.trim() || 'Scholar User';
      const role = profile?.role;

      const targetScreen = role === 'admin' ? 'AdminDashboard' : 'ScholarDashboard';

      setSuccessState({
        visible: true,
        name: fullName,
        targetScreen,
      });
    } catch (error) {
      const errorCode = (error?.code || '').toString();
      const errorMessage = (error?.message || '').toString();
      const normalizedErrorMessage = errorMessage.toLowerCase();
      const isWrongPassword =
        errorCode === 'auth/wrong-password' ||
        (errorCode === 'auth/invalid-credential' && normalizedErrorMessage.includes('password'));
      const isPermissionDenied =
        errorCode === 'PERMISSION_DENIED' ||
        errorCode === 'permission_denied' ||
        normalizedErrorMessage.includes('permission_denied') ||
        normalizedErrorMessage.includes('permission denied') ||
        normalizedErrorMessage.includes('access denied');

      if (isWrongPassword) {
        Alert.alert('Login failed', 'Wrong password!');
      } else if (isPermissionDenied) {
        Alert.alert(
          'Login blocked',
          'Permission denied.'
        );
      } else {
        Alert.alert('Login failed', 'Unable to sign in right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
        
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color={textColor} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="school" size={32} color={GOLD} />
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.container}>
          <Text style={[styles.title, { color: textColor }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Sign in to your Scholar account</Text>

          {/* Email Input */}
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

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>Password</Text>
            <View style={[styles.inputContainer, { borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={GOLD} />
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Enter your password"
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

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: GOLD }]}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]} />
            <Text style={[styles.dividerText, { color: secondaryTextColor }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]} />
          </View>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: secondaryTextColor }]}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Signup')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={successState.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSuccessState((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      >
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: cardBgColor }]}>
            <View style={styles.successIconWrap}>
              <MaterialCommunityIcons name="check-decagram" size={34} color={GOLD} />
            </View>

            <Text style={[styles.successTitle, { color: textColor }]}>Login Successful</Text>
            <Text style={[styles.successMessage, { color: secondaryTextColor }]}>Welcome, {successState.name}</Text>

            <TouchableOpacity
              style={styles.successButton}
              activeOpacity={0.85}
              onPress={() => {
                const destination = successState.targetScreen;
                setSuccessState((prev) => ({
                  ...prev,
                  visible: false,
                }));
                navigation?.replace(destination);
              }}
            >
              <Text style={styles.successButtonText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: GOLD,
    fontSize: 12,
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(203, 213, 225, 0.2)',
  },
  dividerText: {
    color: SLATE_300,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: SLATE_300,
    fontSize: 13,
  },
  signUpLink: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 27, 46, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0B2740',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
  },
  successIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    color: SLATE_100,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  successMessage: {
    color: SLATE_300,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 22,
  },
  successButton: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  successButtonText: {
    color: OCEAN_DEEP,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  darkModeToggle: {
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
