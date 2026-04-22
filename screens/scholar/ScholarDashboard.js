import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	Image,
	Alert,
	BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth, database } from '../../lib/firebase';
import { get, ref } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { useTheme } from '../../lib/ThemeContext';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';
const SUCCESS = '#4ade80';

// Light mode colors
const LIGHT_BG = '#f5f5f5';
const LIGHT_CARD = '#ffffff';
const LIGHT_TEXT = '#1a1a1a';
const LIGHT_TEXT_SECONDARY = '#666666';

const DEFAULT_REQUIREMENTS_CHECKLIST = [
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

export default function ScholarDashboard({ navigation }) {
	const { darkMode, toggleDarkMode } = useTheme();
	const [headerFirstName, setHeaderFirstName] = React.useState('Scholar');
	const [scholarName, setScholarName] = React.useState('Scholar User');
	const [scholarSchool, setScholarSchool] = React.useState('School not set');
	const [scholarYearLevel, setScholarYearLevel] = React.useState('Year level not set');
	const [grantClaimingDate, setGrantClaimingDate] = React.useState('Schedule not set yet');
	const [grantClaimingLocation, setGrantClaimingLocation] = React.useState('Location to be announced');
	const [claimingQueueNumber, setClaimingQueueNumber] = React.useState('Not set');
	const [assignedCashierName, setAssignedCashierName] = React.useState('Not assigned');
	const [requirementsChecklist, setRequirementsChecklist] = React.useState(
		DEFAULT_REQUIREMENTS_CHECKLIST.map((item, index) => ({
			...normalizeRequirement(item, index),
			completed: false,
		}))
	);

	const formatNameToLastFirstMiddle = (profile, fullName) => {
		const lastName = profile?.lastName?.trim() || '';
		const firstName = profile?.firstName?.trim() || '';
		const middleName = profile?.middleName?.trim() || '';

		if (lastName && firstName) {
			// Use DB fields if available
			return middleName
				? `${lastName}, ${firstName} ${middleName}`
				: `${lastName}, ${firstName}`;
		}

		// Parse from fullName
		const parts = fullName.trim().split(/\s+/);
		if (parts.length === 1) {
			return parts[0];
		} else if (parts.length === 2) {
			return `${parts[1]}, ${parts[0]}`;
		} else {
			// Assume last part is lastName, rest are first and middle names
			const last = parts[parts.length - 1];
			const rest = parts.slice(0, -1).join(' ');
			return `${last}, ${rest}`;
		}
	};

	const loadProfile = React.useCallback(async () => {
		const user = auth.currentUser;

		if (!user) {
			return;
		}

		try {
			const [profileSnapshot, grantScheduleSnapshot, requirementsSnapshot] = await Promise.all([
				get(ref(database, `users/${user.uid}`)),
				get(ref(database, 'grantClaimingSchedule/current')),
				get(ref(database, 'adminConfig/requirements')),
			]);
			const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;
			const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Scholar User';
			const requirementsConfig = requirementsSnapshot.exists() ? requirementsSnapshot.val() : null;
			const scholarRequirements = profile?.requirements || {};
			const scholarSchoolName = (profile?.school || '').trim();

			let configuredRequirements = [];
			if (Array.isArray(requirementsConfig?.items) && requirementsConfig.items.length) {
				configuredRequirements = requirementsConfig.items
					.map((item, index) => normalizeRequirement(item, index))
					.filter((item) => item.required !== false);
			} else {
				const selectedIds = requirementsConfig?.selectedIds || {};
				configuredRequirements = DEFAULT_REQUIREMENTS_CHECKLIST.map((item, index) =>
					normalizeRequirement(
						{
							...item,
							required: selectedIds[item.id] !== false,
						},
						index
					)
				).filter((item) => item.required !== false);
			}

			setRequirementsChecklist(
				configuredRequirements.map((item) => ({
					...item,
					completed: !!scholarRequirements[item.id],
				}))
			);

			const firstName =
				profile?.firstName?.trim() ||
				fullName.split(/\s+/)[0] ||
				'Scholar';

			setHeaderFirstName(firstName);
			setScholarName(formatNameToLastFirstMiddle(profile, fullName));
			setScholarSchool(profile?.school?.trim() || 'School not set');
			setScholarYearLevel(profile?.yearLevel?.trim() || 'Year level not set');

			const queueNumber = Number(profile?.claimingInfo?.queueNumber || 0);
			setClaimingQueueNumber(queueNumber > 0 ? `#${queueNumber}` : 'Not set');

			// Fetch current cashier assignment based on school (priority: dynamic > stored)
			let matchedCashierName = 'Not assigned';
			
			// Only attempt cashier lookup if scholar has a school assigned
			if (scholarSchoolName) {
				try {
					const cashiersSnapshot = await get(ref(database, 'adminConfig/cashiers'));
					const rawCashiers = cashiersSnapshot.exists() ? cashiersSnapshot.val() : null;
					const cashierItems = Array.isArray(rawCashiers?.items) ? rawCashiers.items : [];
					const normalizedScholarSchool = scholarSchoolName.toLowerCase();

					const matchedCashier = cashierItems
						.map((item) => {
							const schools = Array.isArray(item?.schools)
								? item.schools.map((entry) => String(entry || '').trim()).filter(Boolean)
								: (item?.school || item?.counterLabel || '').trim()
								? [String(item?.school || item?.counterLabel).trim()]
								: [];

							return {
								fullName: (item?.fullName || '').trim(),
								schools,
								active: item?.active !== false,
							};
						})
						.filter((item) => item.active && item.fullName)
						.sort((a, b) => a.fullName.localeCompare(b.fullName))
						.find((item) =>
							item.schools.some((school) => school.trim().toLowerCase() === normalizedScholarSchool)
						);

					// Use dynamically matched cashier if found, otherwise fall back to stored value
					matchedCashierName = matchedCashier?.fullName || (profile?.claimingInfo?.cashierAssigned || '').trim() || 'Not assigned';
				} catch {
					// If fetch fails, use stored value as fallback
					matchedCashierName = (profile?.claimingInfo?.cashierAssigned || '').trim() || 'Not assigned';
				}
			} else {
				// No school assigned yet, use stored value if available
				matchedCashierName = (profile?.claimingInfo?.cashierAssigned || '').trim() || 'Not assigned';
			}

			setAssignedCashierName(matchedCashierName);

			if (grantScheduleSnapshot.exists()) {
				const grantSchedule = grantScheduleSnapshot.val() || {};
				const dateText = (grantSchedule?.date || '').trim();
				const timeText = (grantSchedule?.time || '').trim();
				const scheduleText = [dateText, timeText].filter(Boolean).join(' • ');

				setGrantClaimingDate(scheduleText || 'Schedule not set yet');
				setGrantClaimingLocation(
					(grantSchedule?.location || '').trim() || 'Location to be announced'
				);
			} else {
				setGrantClaimingDate('Schedule not set yet');
				setGrantClaimingLocation('Location to be announced');
			}
		} catch {
			const fallbackFullName = user?.displayName?.trim() || 'Scholar User';
			const fallbackName = fallbackFullName.split(/\s+/)[0] || 'Scholar';
			setHeaderFirstName(fallbackName);
			setScholarName(formatNameToLastFirstMiddle({}, fallbackFullName));
			setScholarSchool('School not set');
			setScholarYearLevel('Year level not set');
			setGrantClaimingDate('Schedule not set yet');
			setGrantClaimingLocation('Location to be announced');
			setClaimingQueueNumber('Not set');
			setAssignedCashierName('Not assigned');
			setRequirementsChecklist(
				DEFAULT_REQUIREMENTS_CHECKLIST.map((item, index) => ({
					...normalizeRequirement(item, index),
					completed: false,
				}))
			);
		}
	}, []);

	useFocusEffect(
		React.useCallback(() => {
			const onBackPress = () => {
				Alert.alert('Restricted', 'Use the logout button to sign out.');
				return true;
			};

			const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
			return () => subscription.remove();
		}, [])
	);

	useFocusEffect(
		React.useCallback(() => {
			loadProfile();
		}, [loadProfile])
	);

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

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor }]}>
			<StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

			<View style={[styles.header, { backgroundColor: headerBgColor }]}>
				<View style={styles.headerLeft}>
					<Text style={[styles.brand, { color: textColor }]}>Hi, {headerFirstName}</Text>
					<View style={[styles.headerTag, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.2)' }]}>
						<Text style={styles.headerTagText}>ACTIVE SCHOLAR</Text>
					</View>
				</View>

				<View style={styles.headerActions}>
					<TouchableOpacity style={[styles.darkModeToggle, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleDarkModeToggle}>
						<MaterialCommunityIcons name={darkMode ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={GOLD} />
					</TouchableOpacity>

					<TouchableOpacity style={[styles.notifButton, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleLogout}>
						<MaterialCommunityIcons name="logout" size={22} color={GOLD} />
					</TouchableOpacity>
				</View>
			</View>

			<ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
				<View style={styles.section}>
					<View style={styles.sectionHeaderRow}>
					<Text style={[styles.sectionTitle, { color: textColor }]}>My Status</Text>
					<View style={[styles.badge, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.2)' }]}>
						<Text style={styles.badgeText}>{scholarYearLevel}</Text>
					</View>
				</View>

				<View style={[styles.statusCard, { backgroundColor: darkMode ? GOLD : '#FFE4B5' }]}>
							<View style={styles.statusTopRow}>
								<View>
									<Text style={[styles.statusName, { color: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>{scholarName}</Text>
									<Text style={[styles.statusSchool, { color: darkMode ? 'rgba(0, 27, 46, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>{scholarSchool}</Text>
							</View>
						</View>

						<View style={styles.slotCard}>
							<View style={styles.slotLeft}>
								<View style={styles.slotIconWrap}>
									<MaterialCommunityIcons name="calendar-check-outline" size={20} color={GOLD} />
								</View>
								<View>
									<Text style={styles.slotLabel}>GRANT CLAIMING SCHEDULE</Text>
									<Text style={styles.slotValue}>{grantClaimingDate}</Text>
									<Text style={styles.slotSubValue}>{grantClaimingLocation}</Text>
								</View>
							</View>
						</View>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: textColor }]}>My Appointment</Text>
					<TouchableOpacity
						style={[styles.timelineCard, { backgroundColor: cardBgColor, borderLeftColor: GOLD }]}
						activeOpacity={0.85}
						onPress={() => navigation?.replace('Appointment')}
					>
						<MaterialCommunityIcons name="calendar-check-outline" size={22} color={GOLD} style={styles.timelineIcon} />
						<Text style={[styles.timelineStep, { color: GOLD }]}>Scheduling</Text>
						<Text style={[styles.timelineTitle, { color: textColor }]}>Book or Update Appointment</Text>
						<View style={styles.timelineStateRow}>
							<MaterialCommunityIcons name="arrow-right-circle-outline" size={12} color={GOLD} />
							<Text style={[styles.timelineState, styles.timelineStateActive]}>OPEN APPOINTMENT PAGE</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.section}>
					<View style={[styles.claimingCard, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(212, 175, 55, 0.1)', borderColor: darkMode ? GOLD : 'rgba(212, 175, 55, 0.5)' }]}>
						<View style={styles.claimingHeaderRow}>
							<View style={styles.claimingTitleWrap}>
								<View style={[styles.claimingTitleIcon, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.14)' : 'rgba(212, 175, 55, 0.2)' }]}>
									<MaterialCommunityIcons name="cash-register" size={16} color={GOLD} />
								</View>
								<Text style={[styles.claimingTitle, { color: textColor }]}>My Claiming Info</Text>
							</View>
						</View>

								<View style={styles.claimingInfoRow}>
									<View style={[styles.claimingQueueCard, { backgroundColor: darkMode ? GOLD : '#FFE4B5' }]}>
										<Text style={[styles.claimingLabel, { color: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>QUEUE NUMBER</Text>
										<Text style={[styles.claimingQueue, { color: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>{claimingQueueNumber}</Text>
									</View>

									<View style={[styles.claimingCashierCard, { backgroundColor: darkMode ? GOLD : '#FFE4B5' }]}>
										<Text style={[styles.claimingLabel, { color: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>CASHIER ASSIGNED</Text>
										<View style={[styles.claimingCashierPill, { backgroundColor: darkMode ? 'rgba(0, 27, 46, 0.15)' : 'rgba(26, 26, 26, 0.1)', borderColor: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>
											<Text style={[styles.claimingCounter, { color: darkMode ? OCEAN_DEEP : LIGHT_TEXT }]}>{assignedCashierName}</Text>
								</View>
							</View>
						</View>
					</View>
				</View>

				<View style={styles.section}>
					<View style={[styles.whiteCard, { backgroundColor: cardBgColor }]}>
						<Text style={[styles.cardTitle, { color: textColor }]}>Requirements</Text>
						{requirementsChecklist.length === 0 ? (
									<Text style={[styles.noRequirementsText, { color: secondaryTextColor }]}>No required items configured yet.</Text>
						) : (
							requirementsChecklist.map((item) => {
								const isCompleted = !!item.completed;

								return (
									<View key={item.id} style={[styles.checkItem, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', borderColor: darkMode ? 'rgba(212, 175, 55, 0.32)' : 'rgba(212, 175, 55, 0.15)' }]}>
										<Text style={[styles.checkLabel, { color: textColor }]}>{item.label}</Text>
										<Text style={[styles.checkSubtext, { color: secondaryTextColor }]}>{item.detail}</Text>
										<View style={styles.checkStatusRow}>
											<MaterialCommunityIcons
												name={isCompleted ? 'check-circle' : 'alert-circle-outline'}
												size={12}
												color={isCompleted ? SUCCESS : GOLD}
											/>
											<Text
												style={[
													styles.checkStatusText,
													isCompleted ? styles.checkStatusCompleted : styles.checkStatusIncomplete,
												]}
											>
												{isCompleted ? 'Completed' : 'Lacking / Not Complete'}
											</Text>
										</View>
									</View>
								);
							})
						)}
					</View>
				</View>

			</ScrollView>

			<View style={[styles.bottomNav, { backgroundColor: cardBgColor }]}>
				{[
					['view-dashboard-outline', 'Status', true, null],
					['calendar-check-outline', 'Appointment', false, 'Appointment'],
					['bullhorn-outline', 'Announcement', false, 'ScholarAnnouncement'],
					['cog-outline', 'Settings', false, 'Settings'],
				].map(([icon, label, active, route]) => (
					<TouchableOpacity
						key={label}
						style={[styles.navItem, active && styles.navItemActive]}
						activeOpacity={0.85}
						onPress={() => route && navigation?.replace(route)}
					>
						<MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : SLATE_300} />
						<Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
					</TouchableOpacity>
				))}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
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
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	profileWrap: {
		width: 40,
		height: 40,
		borderRadius: 20,
		overflow: 'hidden',
		backgroundColor: CARD_BG,
		borderWidth: 2,
		borderColor: GOLD,
		marginRight: 10,
	},
	profileImage: {
		width: '100%',
		height: '100%',
	},
	brand: {
		color: SLATE_100,
		fontSize: 19,
		fontWeight: '700',
		letterSpacing: 0.2,
		marginRight: 10,
	},
	headerTag: {
		backgroundColor: 'rgba(212, 175, 55, 0.12)',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.3)',
	},
	headerTagText: {
		color: GOLD,
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 0.4,
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
	notifButton: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.24)',
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 110,
		backgroundColor: OCEAN_DEEP,
	},
	section: {
		marginBottom: 22,
	},
	sectionHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	sectionTitle: {
		color: SLATE_100,
		fontSize: 19,
		fontWeight: '700',
		marginBottom: 12,
	},
	badge: {
		backgroundColor: 'rgba(212, 175, 55, 0.12)',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
	},
	badgeText: {
		color: GOLD,
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	statusCard: {
		backgroundColor: GOLD,
		borderRadius: 16,
		padding: 16,
	},
	statusTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 14,
	},
	statusName: {
		fontSize: 22,
		fontWeight: '700',
		color: OCEAN_DEEP,
	},
	statusSchool: {
		fontSize: 13,
		color: 'rgba(0, 27, 46, 0.8)',
		marginTop: 2,
	},
	slotCard: {
		backgroundColor: 'rgba(0, 27, 46, 0.18)',
		borderRadius: 14,
		padding: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	slotLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	slotIconWrap: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: 'rgba(212, 175, 55, 0.12)',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 10,
	},
	slotLabel: {
		fontSize: 10,
		fontWeight: '700',
		color: 'rgba(0, 27, 46, 0.8)',
		letterSpacing: 0.4,
	},
	slotValue: {
		fontSize: 13,
		fontWeight: '700',
		color: OCEAN_DEEP,
		marginTop: 2,
	},
	slotSubValue: {
		fontSize: 11,
		fontWeight: '600',
		color: 'rgba(0, 27, 46, 0.78)',
		marginTop: 2,
	},
	slotStatus: {
		backgroundColor: '#d1fae5',
		color: '#047857',
		fontSize: 10,
		fontWeight: '700',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		marginLeft: 8,
	},
	timelineCard: {
		width: '100%',
		backgroundColor: CARD_BG,
		borderRadius: 14,
		padding: 12,
		borderLeftWidth: 4,
		borderLeftColor: GOLD,
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 1,
	},
	timelineIcon: {
		marginBottom: 8,
	},
	timelineStep: {
		color: GOLD,
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		marginBottom: 4,
	},
	timelineTitle: {
		color: SLATE_100,
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 8,
	},
	timelineStateRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	timelineState: {
		color: SLATE_300,
		fontSize: 10,
		fontWeight: '700',
		marginLeft: 4,
	},
	timelineStateActive: {
		color: GOLD,
	},
	whiteCard: {
		backgroundColor: CARD_BG,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.2)',
	},
	cardTitle: {
		color: SLATE_100,
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 12,
	},
	checkItem: {
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: 10,
		marginBottom: 8,
		backgroundColor: CARD_ALT_BG,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.32)',
	},
	checkLabel: {
		color: SLATE_100,
		fontSize: 14,
		fontWeight: '600',
	},
	checkSubtext: {
		marginTop: 4,
		color: SLATE_300,
		fontSize: 12,
		lineHeight: 18,
	},
	noRequirementsText: {
		color: SLATE_300,
		fontSize: 12,
		lineHeight: 18,
	},
	checkStatusRow: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	checkStatusText: {
		fontSize: 11,
		fontWeight: '700',
		marginLeft: 6,
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	checkStatusCompleted: {
		color: SUCCESS,
	},
	checkStatusIncomplete: {
		color: GOLD,
	},
	claimingCard: {
		backgroundColor: 'rgba(212, 175, 55, 0.15)',
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: GOLD,
	},
	claimingHeaderRow: {
		marginBottom: 12,
	},
	claimingTitleWrap: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	claimingTitleIcon: {
		width: 26,
		height: 26,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(212, 175, 55, 0.14)',
		marginRight: 8,
	},
	claimingTitle: {
		color: SLATE_100,
		fontSize: 18,
		fontWeight: '700',
	},
	claimingInfoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'stretch',
		gap: 10,
	},
	claimingQueueCard: {
		flex: 0.9,
		backgroundColor: GOLD,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: GOLD,
	},
	claimingCashierCard: {
		flex: 1.1,
		backgroundColor: GOLD,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: GOLD,
	},
	claimingLabel: {
		color: OCEAN_DEEP,
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	claimingQueue: {
		color: OCEAN_DEEP,
		fontSize: 30,
		fontWeight: '800',
		marginTop: 6,
	},
	claimingCashierPill: {
		marginTop: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 10,
		backgroundColor: 'rgba(0, 27, 46, 0.15)',
		borderWidth: 1,
		borderColor: OCEAN_DEEP,
	},
	claimingCounter: {
		color: OCEAN_DEEP,
		fontSize: 16,
		fontWeight: '700',
	},
	claimingLocation: {
		backgroundColor: 'rgba(0, 27, 46, 0.18)',
		borderRadius: 10,
		padding: 10,
		flexDirection: 'row',
		alignItems: 'center',
	},
	claimingLocationText: {
		marginLeft: 8,
	},
	claimingLocationTitle: {
		color: OCEAN_DEEP,
		fontSize: 13,
		fontWeight: '700',
	},
	claimingLocationSub: {
		color: 'rgba(0, 27, 46, 0.8)',
		fontSize: 11,
		marginTop: 1,
	},
	notifyCard: {
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.16)',
		borderRadius: 14,
		padding: 12,
		marginBottom: 10,
		flexDirection: 'row',
	},
	notifyIconWrap: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 10,
	},
	notifyTextWrap: {
		flex: 1,
	},
	notifyTitle: {
		color: SLATE_100,
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 2,
	},
	notifyBody: {
		color: SLATE_300,
		fontSize: 12,
		lineHeight: 18,
	},
	notifyTime: {
		color: SLATE_300,
		fontSize: 10,
		fontWeight: '700',
		marginTop: 8,
	},
	notifyTimePrimary: {
		color: GOLD,
	},
	bottomNav: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		height: 84,
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		backgroundColor: CARD_BG,
		borderTopWidth: 1,
		borderTopColor: 'rgba(212, 175, 55, 0.22)',
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 12,
	},
	navItem: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	navItemActive: {
		backgroundColor: 'rgba(212, 175, 55, 0.12)',
	},
	navText: {
		fontSize: 10,
		fontWeight: '700',
		color: SLATE_300,
		marginTop: 2,
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	navTextActive: {
		color: GOLD,
	},
});
