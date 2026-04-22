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

const DEFAULT_REQUIREMENTS = [
  {
    id: '1',
    label: 'Duly Accomplished CCEAP Application Form',
    detail: '(1) Photocopy of Accomplished CCEAP Form',
  },
  {
    id: '2',
    label: '1pc 1x1 ID Picture',
    detail: 'Recent photo with plain background',
  },
  {
    id: '3',
    label: "Voter's Certificate",
    detail: '(1) Original, (2) Photocopies',
  },
  {
    id: '4',
    label: 'Certificate of Registration / Assessment Form',
    detail:
      '(1) Original, (2) Photocopies, or School Certification/Proof of Enrollment Signed by your Authorized School Representative',
  },
];

const normalizeRequirement = (item, index) => ({
  id: String(item?.id || Date.now() + index),
  label: (item?.label || '').trim() || `Requirement ${index + 1}`,
  detail: (item?.detail || '').trim(),
  required: item?.required !== false,
});

const getDefaultRequirements = () =>
  DEFAULT_REQUIREMENTS.map((item, index) => normalizeRequirement({ ...item, required: true }, index));

export default function RequirementsSetup() {
  const navigation = useNavigation();
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [darkMode, setDarkMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [requirements, setRequirements] = React.useState([]);
  const [formLabel, setFormLabel] = React.useState('');
  const [formDetail, setFormDetail] = React.useState('');
  const [editingRequirementId, setEditingRequirementId] = React.useState('');

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
      setRequirements(getDefaultRequirements());
      setLoading(false);
      return;
    }

    try {
      const [profileSnapshot, configSnapshot] = await Promise.all([
        get(ref(database, `users/${user.uid}`)),
        get(ref(database, 'adminConfig/requirements')),
      ]);

      const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;
      const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Admin';
      setHeaderFullName(fullName);

      const savedConfig = configSnapshot.exists() ? configSnapshot.val() : null;
      let configuredList = [];

      if (Array.isArray(savedConfig?.items) && savedConfig.items.length) {
        configuredList = savedConfig.items.map((item, index) => normalizeRequirement(item, index));
      } else {
        const selectedIds = savedConfig?.selectedIds || {};
        configuredList = DEFAULT_REQUIREMENTS.map((item, index) =>
          normalizeRequirement(
            {
              ...item,
              required: selectedIds[item.id] !== false,
            },
            index
          )
        );
      }

      setRequirements(configuredList);
    } catch {
      setHeaderFullName(user?.displayName?.trim() || 'Admin');
      setRequirements(getDefaultRequirements());
      Alert.alert('Notice', 'Unable to load saved requirement setup. Showing defaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRequirement = (id) => {
    setRequirements((prev) =>
      prev.map((item) => (item.id === id ? { ...item, required: !item.required } : item))
    );
  };

  const resetForm = () => {
    setFormLabel('');
    setFormDetail('');
    setEditingRequirementId('');
  };

  const handleSubmitRequirement = () => {
    const label = formLabel.trim();
    const detail = formDetail.trim();

    if (!label) {
      Alert.alert('Validation', 'Requirement name is required.');
      return;
    }

    if (editingRequirementId) {
      setRequirements((prev) =>
        prev.map((item) =>
          item.id === editingRequirementId
            ? {
                ...item,
                label,
                detail,
              }
            : item
        )
      );
      resetForm();
      return;
    }

    const nextItem = normalizeRequirement(
      {
        id: `${Date.now()}`,
        label,
        detail,
        required: true,
      },
      requirements.length
    );

    setRequirements((prev) => [...prev, nextItem]);
    resetForm();
  };

  const handleEditRequirement = (item) => {
    setEditingRequirementId(item.id);
    setFormLabel(item.label || '');
    setFormDetail(item.detail || '');
  };

  const handleDeleteRequirement = (item) => {
    Alert.alert('Delete requirement', `Remove "${item.label}" from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setRequirements((prev) => prev.filter((entry) => entry.id !== item.id));

          if (editingRequirementId === item.id) {
            resetForm();
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!requirements.length) {
      Alert.alert('Validation', 'Add at least one requirement before saving.');
      return;
    }

    const selectedCount = requirements.filter((item) => item.required).length;

    if (!selectedCount) {
      Alert.alert('Validation', 'Select at least one requirement.');
      return;
    }

    try {
      setSaving(true);
      const selectedIds = requirements.reduce((acc, item) => {
        acc[item.id] = item.required;
        return acc;
      }, {});

      await set(ref(database, 'adminConfig/requirements'), {
        items: requirements.map((item, index) => normalizeRequirement(item, index)),
        selectedIds,
        updatedBy: auth.currentUser?.uid || 'unknown-admin',
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Saved', 'Requirement setup has been updated.');
    } catch {
      Alert.alert('Error', 'Unable to save requirement setup right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor }]}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.brand, { color: textColor }]}>Requirements Setup</Text>
          <Text style={[styles.headerSubtitle, { color: secondaryTextColor }]}>Hi, {headerFullName || 'Admin'}</Text>
        </View>

        <TouchableOpacity style={[styles.darkModeToggle, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleDarkModeToggle}>
          <MaterialCommunityIcons name={darkMode ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={GOLD} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={[styles.loadingText, { color: secondaryTextColor }]}>Loading requirement setup...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}>
            <Text style={[styles.heroTitle, { color: textColor }]}>Assign scholar requirements</Text>
            <Text style={[styles.heroText, { color: secondaryTextColor }]}>
              Add, edit, or delete requirement items. Checked items are required for scholars to submit.
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: cardBgColor }]}>
            <Text style={[styles.formTitle, { color: textColor }]}>{editingRequirementId ? 'Edit requirement' : 'Add requirement'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor }]}
              placeholder="Requirement name"
              placeholderTextColor={secondaryTextColor}
              value={formLabel}
              onChangeText={setFormLabel}
            />
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor }]}
              placeholder="Details (optional)"
              placeholderTextColor={secondaryTextColor}
              multiline
              value={formDetail}
              onChangeText={setFormDetail}
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.formPrimaryButton} activeOpacity={0.85} onPress={handleSubmitRequirement}>
                <MaterialCommunityIcons
                  name={editingRequirementId ? 'content-save-edit-outline' : 'plus-circle-outline'}
                  size={18}
                  color={darkMode ? OCEAN_DEEP : '#ffffff'}
                />
                <Text style={[styles.formPrimaryText, { color: darkMode ? OCEAN_DEEP : '#ffffff' }]}>{editingRequirementId ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>

              {editingRequirementId ? (
                <TouchableOpacity style={[styles.formGhostButton, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)', borderColor: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]} activeOpacity={0.85} onPress={resetForm}>
                  <MaterialCommunityIcons name="close" size={18} color={GOLD} />
                  <Text style={[styles.formGhostText, { color: GOLD }]}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {requirements.map((item) => (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: cardBgColor }]}>
              <View style={styles.itemLeft}>
                <TouchableOpacity style={styles.itemIconWrap} activeOpacity={0.85} onPress={() => toggleRequirement(item.id)}>
                  <MaterialCommunityIcons
                    name={item.required ? 'check-circle' : 'circle-outline'}
                    size={22}
                    color={item.required ? GOLD : secondaryTextColor}
                  />
                </TouchableOpacity>
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemTitle, { color: textColor }]}>{item.label}</Text>
                  {item.detail ? <Text style={[styles.itemDetail, { color: secondaryTextColor }]}>{item.detail}</Text> : null}
                </View>
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.itemActionButton}
                  activeOpacity={0.85}
                  onPress={() => handleEditRequirement(item)}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={GOLD} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.itemActionButton}
                  activeOpacity={0.85}
                  onPress={() => handleDeleteRequirement(item)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={darkMode ? OCEAN_DEEP : '#ffffff'} />
            ) : (
              <MaterialCommunityIcons name="content-save-outline" size={18} color={darkMode ? OCEAN_DEEP : '#ffffff'} />
            )}
            <Text style={[styles.saveButtonText, { color: darkMode ? OCEAN_DEEP : '#ffffff' }]}>{saving ? 'Saving...' : 'Save Setup'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingHorizontal: 10,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 14,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    padding: 12,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formPrimaryButton: {
    borderRadius: 10,
    backgroundColor: GOLD,
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  formPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formGhostButton: {
    marginLeft: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  formGhostText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  itemActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(203, 213, 225, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemDetail: {
    fontSize: 11,
    marginTop: 3,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: GOLD,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});