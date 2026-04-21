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

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';

const checklist = [
	{
		id: '1',
		label: 'Duly Accomplished Application Form',
		detail: '(1) Photocopy of Accomplished Application Form',
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

export default function ScholarDashboard({ navigation }) {
	const [headerFirstName, setHeaderFirstName] = React.useState('Scholar');
	const [scholarName, setScholarName] = React.useState('Scholar User');
	const [scholarSchool, setScholarSchool] = React.useState('School not set');
	const [scholarYearLevel, setScholarYearLevel] = React.useState('Year level not set');
	const [grantClaimingDate, setGrantClaimingDate] = React.useState('Schedule not set yet');
	const [grantClaimingLocation, setGrantClaimingLocation] = React.useState('Location to be announced');

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
			const [profileSnapshot, grantScheduleSnapshot] = await Promise.all([
				get(ref(database, `users/${user.uid}`)),
				get(ref(database, 'grantClaimingSchedule/current')),
			]);
			const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;
			const fullName = profile?.fullName?.trim() || user?.displayName?.trim() || 'Scholar User';

			const firstName =
				profile?.firstName?.trim() ||
				fullName.split(/\s+/)[0] ||
				'Scholar';

			setHeaderFirstName(firstName);
			setScholarName(formatNameToLastFirstMiddle(profile, fullName));
			setScholarSchool(profile?.school?.trim() || 'School not set');
			setScholarYearLevel(profile?.yearLevel?.trim() || 'Year level not set');

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

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar style="light" />

			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<Text style={styles.brand}>Hi, {headerFirstName}</Text>
					<View style={styles.headerTag}>
						<Text style={styles.headerTagText}>ACTIVE SCHOLAR</Text>
					</View>
				</View>

				<TouchableOpacity style={styles.notifButton} activeOpacity={0.85} onPress={handleLogout}>
					<MaterialCommunityIcons name="logout" size={22} color={GOLD} />
				</TouchableOpacity>
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				<View style={styles.section}>
					<View style={styles.sectionHeaderRow}>
						<Text style={styles.sectionTitle}>My Status</Text>
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{scholarYearLevel}</Text>
						</View>
					</View>

					<View style={styles.statusCard}>
						<View style={styles.statusTopRow}>
							<View>
								<Text style={styles.statusName}>{scholarName}</Text>
								<Text style={styles.statusSchool}>{scholarSchool}</Text>
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
					<Text style={styles.sectionTitle}>My Appointment</Text>
					<TouchableOpacity
						style={styles.timelineCard}
						activeOpacity={0.85}
						onPress={() => navigation?.navigate('Appointment')}
					>
						<MaterialCommunityIcons name="calendar-check-outline" size={22} color={GOLD} style={styles.timelineIcon} />
						<Text style={styles.timelineStep}>Scheduling</Text>
						<Text style={styles.timelineTitle}>Book or Update Appointment</Text>
						<View style={styles.timelineStateRow}>
							<MaterialCommunityIcons name="arrow-right-circle-outline" size={12} color={GOLD} />
							<Text style={[styles.timelineState, styles.timelineStateActive]}>OPEN APPOINTMENT PAGE</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.section}>
					<View style={styles.whiteCard}>
						<Text style={styles.cardTitle}>Requirements</Text>
						{checklist.map((item) => (
							<View key={item.id} style={styles.checkItem}>
								<Text style={styles.checkLabel}>{item.label}</Text>
								<Text style={styles.checkSubtext}>{item.detail}</Text>
							</View>
						))}
					</View>
				</View>

				<View style={styles.section}>
					<View style={styles.claimingCard}>
						<Text style={styles.claimingTitle}>My Claiming Info</Text>

						<View style={styles.claimingTopRow}>
							<View>
								<Text style={styles.claimingLabel}>QUEUE NUMBER</Text>
								<Text style={styles.claimingQueue}>#A-242</Text>
							</View>

							<View style={styles.claimingRight}>
								<Text style={styles.claimingLabel}>CASHIER ASSIGNED</Text>
								<Text style={styles.claimingCounter}>Counter 04</Text>
							</View>
						</View>

						<View style={styles.claimingLocation}>
							<MaterialCommunityIcons name="map-marker-outline" size={20} color={SLATE_100} />
							<View style={styles.claimingLocationText}>
								<Text style={styles.claimingLocationTitle}>City Convention Center</Text>
								<Text style={styles.claimingLocationSub}>Main Hall - Gate 2</Text>
							</View>
						</View>
					</View>
				</View>

			</ScrollView>

			<View style={styles.bottomNav}>
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
						onPress={() => route && navigation?.navigate(route)}
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
	claimingCard: {
		backgroundColor: GOLD,
		borderRadius: 16,
		padding: 16,
	},
	claimingTitle: {
		color: OCEAN_DEEP,
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 12,
	},
	claimingTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	claimingLabel: {
		color: 'rgba(0, 27, 46, 0.8)',
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	claimingQueue: {
		color: OCEAN_DEEP,
		fontSize: 34,
		fontWeight: '800',
		marginTop: 2,
	},
	claimingRight: {
		alignItems: 'flex-end',
	},
	claimingCounter: {
		color: OCEAN_DEEP,
		fontSize: 22,
		fontWeight: '700',
		marginTop: 2,
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
