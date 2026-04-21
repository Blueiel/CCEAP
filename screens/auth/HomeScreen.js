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

const { width } = Dimensions.get('window');

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const PRIMARY = '#ec5b13';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const HERO_IMAGE_ASSET = Image.resolveAssetSource(require('../../assets/cceap.png'));
const HERO_IMAGE_ASPECT_RATIO =
  HERO_IMAGE_ASSET?.width && HERO_IMAGE_ASSET?.height
    ? HERO_IMAGE_ASSET.width / HERO_IMAGE_ASSET.height
    : 4 / 3;

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={OCEAN_DEEP} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          
          {/* Hero Image */}
          <View style={styles.imageWrapper}>
            <View style={styles.imageGradientBorder}>
              <Image
                source={require('../../assets/cceap.png')}
                style={styles.heroImage}
                resizeMode="contain"
              />
              <View style={styles.imageGradientOverlay} />
            </View>
          </View>

          {/* Branding */}
          <Text style={styles.mainTitle}>SCHOLR</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.subtitle}>
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
              style={styles.secondaryButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryButtonText}>LOG IN</Text>
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
});
