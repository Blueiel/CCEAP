import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../lib/ThemeContext';

const { width } = Dimensions.get('window');

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const PRIMARY = '#ec5b13';
const CARD_BG = '#003550';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const LIGHT_BG = '#f5f5f5';
const LIGHT_CARD = '#ffffff';
const LIGHT_TEXT = '#1a1a1a';
const LIGHT_TEXT_SECONDARY = '#666666';
const HERO_IMAGE_ASSET = Image.resolveAssetSource(require('../../assets/cceap.png'));
const HERO_IMAGE_ASPECT_RATIO =
  HERO_IMAGE_ASSET?.width && HERO_IMAGE_ASSET?.height
    ? HERO_IMAGE_ASSET.width / HERO_IMAGE_ASSET.height
    : 4 / 3;

export default function HomeScreen({ navigation }) {
  const { darkMode, setDarkMode } = useTheme();

  React.useEffect(() => {
    // Force light mode for auth screens
    setDarkMode(false);
  }, [setDarkMode]);

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
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          
          {/* Hero Image */}
          <View style={styles.imageWrapper}>
            <View style={[styles.imageGradientBorder, { borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(212, 175, 55, 0.2)' }]}>
              <Image
                source={require('../../assets/cceap.png')}
                style={styles.heroImage}
                resizeMode="contain"
              />
              <View style={[styles.imageGradientOverlay, { backgroundColor: darkMode ? OCEAN_DEEP : LIGHT_BG }]} />
            </View>
          </View>

          {/* Branding */}
          <Text style={[styles.mainTitle, { color: textColor }]}>SCHOLR</Text>
          
          <View style={styles.divider} />
          
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
            The Definitive Tracking System for{`\n`}
            <Text style={styles.goldText}>CCEAP Scholars</Text>
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.primaryButtonText}>SIGN UP</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.secondaryButton, { borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(212, 175, 55, 0.2)' }]} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={[styles.secondaryButtonText, { color: textColor }]}>LOG IN</Text>
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
    paddingHorizontal: 16,
    backgroundColor: OCEAN_DEEP,
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  imageWrapper: {
    width: width - 32,
    maxWidth: 320,
    marginBottom: 32,
    aspectRatio: HERO_IMAGE_ASPECT_RATIO,
  },
  imageGradientBorder: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  imageGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: OCEAN_DEEP,
    opacity: 0.35,
  },
  mainTitle: {
    fontFamily: 'serif',
    fontSize: 64,
    fontWeight: '700',
    color: SLATE_100,
    marginBottom: 16,
    letterSpacing: -2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  divider: {
    width: 96,
    height: 1,
    backgroundColor: GOLD,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: SLATE_300,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 24,
    maxWidth: 320,
  },
  goldText: {
    color: GOLD,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: OCEAN_DEEP,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButtonText: {
    color: SLATE_100,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  darkModeToggle: {
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
