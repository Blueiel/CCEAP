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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { database } from '../../lib/firebase';
import { ref, get } from 'firebase/database';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const GOLD = '#D4AF37';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';
const REQUIREMENT_IDS = ['1', '2', '3', '4'];

const formatScholarName = (scholar = {}) => {
  const lastName = scholar?.lastName?.trim() || '';
  const firstName = scholar?.firstName?.trim() || '';
  const middleName = scholar?.middleName?.trim() || '';

  if (lastName && firstName) {
    return middleName ? `${lastName}, ${firstName} ${middleName}` : `${lastName}, ${firstName}`;
  }

  const fallbackFullName = scholar?.fullName?.trim() || '';
  if (!fallbackFullName) {
    return 'Unknown Scholar';
  }

  const parts = fallbackFullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[1]}, ${parts[0]}`;
  }

  const fallbackLastName = parts[parts.length - 1];
  const fallbackFirstMiddle = parts.slice(0, -1).join(' ');
  return `${fallbackLastName}, ${fallbackFirstMiddle}`;
};

export default function ScholarRegistry() {
  const navigation = useNavigation();
  const route = useRoute();
  const [headerFullName, setHeaderFullName] = React.useState('');
  const [schools, setSchools] = React.useState([]);
  const [activeRequirementIds, setActiveRequirementIds] = React.useState(REQUIREMENT_IDS);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSchool, setSelectedSchool] = React.useState('All');
  const [loading, setLoading] = React.useState(true);

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

  const loadScholars = React.useCallback(async () => {
    try {
      setLoading(true);
      const [usersSnapshot, requirementsSnapshot] = await Promise.all([
        get(ref(database, 'users')),
        get(ref(database, 'adminConfig/requirements')),
      ]);

      const requirementsConfig = requirementsSnapshot.exists() ? requirementsSnapshot.val() : null;
      let configuredRequirementIds = [];

      if (Array.isArray(requirementsConfig?.items) && requirementsConfig.items.length) {
        configuredRequirementIds = requirementsConfig.items
          .filter((item) => item?.required !== false)
          .map((item) => String(item?.id || '').trim())
          .filter(Boolean);
      } else {
        const selectedIds = requirementsConfig?.selectedIds || {};
        configuredRequirementIds = REQUIREMENT_IDS.filter((id) => selectedIds[id] !== false);
      }

      setActiveRequirementIds(configuredRequirementIds);

      if (!usersSnapshot.exists()) {
        setSchools([]);
        return;
      }

      const users = usersSnapshot.val();
      const groupedBySchool = {};

      Object.keys(users).forEach((uid) => {
        const user = users[uid];

        if (user?.role !== 'scholar') {
          return;
        }

        const school = (user.school || 'Not specified').trim();

        if (!groupedBySchool[school]) {
          groupedBySchool[school] = [];
        }

        groupedBySchool[school].push({
          uid,
          ...user,
        });
      });

      const schoolList = Object.keys(groupedBySchool)
        .sort()
        .map((schoolName) => ({
          name: schoolName,
          scholars: groupedBySchool[schoolName].sort((a, b) =>
            formatScholarName(a).localeCompare(formatScholarName(b))
          ),
          count: groupedBySchool[schoolName].length,
        }));

      setSchools(schoolList);
    } catch (error) {
      Alert.alert('Error', `Failed to load scholars: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

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
    loadScholars();
  }, [loadScholars]);

  useFocusEffect(
    React.useCallback(() => {
      loadScholars();
      // Reset school filter when focus returns (but it will be reapplied if route params exist)
      setSelectedSchool('All');
    }, [loadScholars])
  );

  // Apply school filter after schools data is loaded
  React.useEffect(() => {
    if (route.params?.schoolFilter && schools.length > 0) {
      const schoolNames = schools.map((s) => s.name);
      if (schoolNames.includes(route.params.schoolFilter)) {
        setSelectedSchool(route.params.schoolFilter);
      }
    }
  }, [route.params?.schoolFilter, schools]);

  const totalScholars = schools.reduce((count, school) => count + school.count, 0);

  const schoolOptions = React.useMemo(
    () => ['All', ...schools.map((school) => school.name)],
    [schools]
  );

  React.useEffect(() => {
    // Only reset to 'All' if we're not applying a route filter
    if (selectedSchool !== 'All' && !schoolOptions.includes(selectedSchool) && !route.params?.schoolFilter) {
      setSelectedSchool('All');
    }
  }, [selectedSchool, schoolOptions, route.params?.schoolFilter]);

  const filteredSections = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return schools
      .filter((school) => selectedSchool === 'All' || school.name === selectedSchool)
      .map((school) => {
        const filteredScholars = school.scholars.filter((scholar) => {
          if (!query) {
            return true;
          }

          const name = formatScholarName(scholar).toLowerCase();
          const fullName = (scholar.fullName || '').toLowerCase();
          const email = (scholar.email || '').toLowerCase();
          const yearLevel = (scholar.yearLevel || '').toLowerCase();

          return (
            name.includes(query) ||
            fullName.includes(query) ||
            email.includes(query) ||
            yearLevel.includes(query)
          );
        });

        return {
          title: school.name,
          count: filteredScholars.length,
          data: filteredScholars,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [schools, searchQuery, selectedSchool]);

  const visibleScholars = filteredSections.reduce(
    (count, section) => count + section.data.length,
    0
  );

  const flatRows = React.useMemo(() => {
    const rows = [];

    filteredSections.forEach((section) => {
      rows.push({
        type: 'header',
        id: `header-${section.title}`,
        title: section.title,
        count: section.count,
      });

      section.data.forEach((scholar, index) => {
        rows.push({
          type: 'scholar',
          id: `scholar-${scholar.uid}`,
          scholar,
          isLastInSection: index === section.data.length - 1,
        });
      });
    });

    return rows;
  }, [filteredSections]);

  const handleGoHome = () => navigation.replace('AdminDashboard');
  const handleGoReviews = () => navigation.replace('Reviews');
  const handleGoAlerts = () => navigation.replace('Alerts');
  const handleGoSettings = () => navigation.replace('AdminSettings');

  const renderListHeader = () => (
    <>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryLine}>
            <View style={styles.summaryLabelRow}>
              <MaterialCommunityIcons name="school-outline" size={13} color={GOLD} />
              <Text style={styles.summaryLabel}>Schools</Text>
            </View>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {schools.length}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryLine}>
            <View style={styles.summaryLabelRow}>
              <MaterialCommunityIcons name="account-outline" size={13} color={GOLD} />
              <Text style={styles.summaryLabel}>Visible Scholars</Text>
            </View>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {visibleScholars}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={18} color={SLATE_300} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or year level"
          placeholderTextColor={SLATE_300}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={SLATE_300} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {schoolOptions.map((option) => {
          const active = option === selectedSchool;

          return (
            <TouchableOpacity
              key={option}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSelectedSchool(option)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>Hi, {headerFullName || 'Admin'}</Text>
          </View>

          <TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
          </TouchableOpacity>
        </View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Hi, {headerFullName || 'Admin'}</Text>
        </View>

        <TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={styles.listContent}
        >
          {renderListHeader()}

          {flatRows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="information-outline" size={50} color={SLATE_300} />
              <Text style={styles.emptyText}>No scholars found</Text>
            </View>
          ) : (
            flatRows.map((item) => {
              if (item.type === 'header') {
                return (
                  <View key={item.id} style={styles.schoolContainer}>
                    <View style={styles.schoolHeader}>
                      <View style={styles.schoolInfoRow}>
                        <View style={styles.schoolIconWrap}>
                          <MaterialCommunityIcons name="school-outline" size={18} color={GOLD} />
                        </View>

                        <View style={styles.schoolInfo}>
                          <Text style={styles.schoolName}>{item.title}</Text>
                          <Text style={styles.scholarCount}>
                            {item.count} {item.count === 1 ? 'scholar' : 'scholars'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.schoolBadge}>
                        <Text style={styles.badgeText}>{item.count}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              const scholar = item.scholar;
              const isComplete =
                activeRequirementIds.length > 0 &&
                activeRequirementIds.every((id) => !!scholar?.requirements?.[id]);
              const displayName = formatScholarName(scholar);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.scholarItemWrap,
                    item.isLastInSection && styles.lastScholarItem,
                    item.isLastInSection && styles.lastInSection,
                  ]}
                >
                  <View style={styles.scholarItem}>
                    <View style={styles.scholarAvatar}>
                      <MaterialCommunityIcons name="account" size={16} color={GOLD} />
                    </View>

                    <View style={styles.scholarDetails}>
                      <Text style={styles.scholarName}>{displayName}</Text>
                      {!!scholar.yearLevel && <Text style={styles.scholarYearLevel}>{scholar.yearLevel}</Text>}
                    </View>

                    <View style={styles.scholarRightCol}>
                      <View style={[styles.statusBadge, !isComplete && styles.statusBadgeIncomplete]}>
                        <Text style={[styles.statusText, !isComplete && styles.statusTextIncomplete]}>
                          {isComplete ? 'Complete' : 'Incomplete'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View style={styles.bottomNav}>
        {[
          ['home-outline', 'Home', false, handleGoHome],
          ['account-group-outline', 'Scholars', true, null],
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
            <MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : SLATE_300} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
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
  container: {
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 110,
  },
  searchWrap: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: SLATE_100,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterRow: {
    paddingBottom: 10,
    paddingRight: 8,
  },
  filterChip: {
    minWidth: 72,
    height: 34,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: CARD_BG,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  filterChipText: {
    color: SLATE_300,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterChipTextActive: {
    color: GOLD,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  summaryValue: {
    color: SLATE_100,
    fontSize: 17,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
    marginLeft: 8,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 6,
  },
  summaryLabel: {
    color: SLATE_300,
    fontSize: 11,
    marginLeft: 5,
    flexShrink: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 28,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    color: SLATE_300,
    marginTop: 12,
  },
  schoolContainer: {
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_ALT_BG,
    marginTop: 0,
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(11, 39, 64, 0.9)',
  },
  schoolInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  schoolIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: '600',
    color: SLATE_100,
    letterSpacing: 0.3,
  },
  scholarCount: {
    fontSize: 12,
    color: SLATE_300,
    marginTop: 4,
  },
  schoolBadge: {
    backgroundColor: GOLD,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 10,
  },
  badgeText: {
    color: OCEAN_DEEP,
    fontSize: 12,
    fontWeight: '700',
  },
  scholarsListContainer: {
    backgroundColor: CARD_ALT_BG,
    borderTopWidth: 1,
    borderTopColor: CARD_BG,
    paddingVertical: 6,
  },
  scholarItemWrap: {
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  lastScholarItem: {
    borderBottomWidth: 0,
  },
  lastInSection: {
    marginBottom: 14,
  },
  scholarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.14)',
    backgroundColor: CARD_ALT_BG,
  },
  scholarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 39, 64, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scholarDetails: {
    flex: 1,
    marginLeft: 10,
  },
  scholarName: {
    fontSize: 14,
    fontWeight: '600',
    color: SLATE_100,
    lineHeight: 18,
  },
  scholarYearLevel: {
    fontSize: 11,
    color: GOLD,
    marginTop: 4,
    fontWeight: '600',
  },
  scholarRightCol: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  statusBadgeIncomplete: {
    backgroundColor: 'rgba(203, 213, 225, 0.12)',
    borderColor: 'rgba(203, 213, 225, 0.24)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
  },
  statusTextIncomplete: {
    color: SLATE_300,
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
