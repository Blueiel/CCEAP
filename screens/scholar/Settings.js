import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
	StyleSheet,
	Text,
	View,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
	EmailAuthProvider,
	reauthenticateWithCredential,
	signOut,
	updatePassword,
	updateProfile,
} from 'firebase/auth';
import { get, ref, serverTimestamp, update } from 'firebase/database';
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
const YEAR_LEVEL_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const splitFullName = (fullName = '') => {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return { firstName: '', middleName: '', lastName: '' };
	}

	if (parts.length === 1) {
		return { firstName: parts[0], middleName: '', lastName: '' };
	}

	if (parts.length === 2) {
		return { firstName: parts[0], middleName: '', lastName: parts[1] };
	}

	return {
		firstName: parts[0],
		middleName: parts.slice(1, -1).join(' '),
		lastName: parts[parts.length - 1],
	};
};

export default function Settings({ navigation }) {
	const { darkMode, toggleDarkMode } = useTheme();
	const [headerFirstName, setHeaderFirstName] = React.useState('Scholar');
	const [isLoading, setIsLoading] = React.useState(true);
	const [isSavingProfile, setIsSavingProfile] = React.useState(false);
	const [isSavingAccount, setIsSavingAccount] = React.useState(false);

	const [firstName, setFirstName] = React.useState('');
	const [middleName, setMiddleName] = React.useState('');
	const [lastName, setLastName] = React.useState('');
	const [yearLevel, setYearLevel] = React.useState('');
	const [school, setSchool] = React.useState('');

	const [email, setEmail] = React.useState('');
	const [currentPassword, setCurrentPassword] = React.useState('');
	const [newPassword, setNewPassword] = React.useState('');
	const [confirmPassword, setConfirmPassword] = React.useState('');

	const handleDarkModeToggle = () => {
		toggleDarkMode();
	};

	const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
	const headerBgColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
	const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
	const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
	const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

	const loadProfile = React.useCallback(async () => {
		const user = auth.currentUser;

		if (!user) {
			setIsLoading(false);
			Alert.alert('Session expired', 'Please log in again.');
			navigation?.replace('Login');
			return;
		}

		try {
			const snapshot = await get(ref(database, `users/${user.uid}`));
			const profile = snapshot.exists() ? snapshot.val() : {};
			const nameParts = splitFullName(profile?.fullName || user.displayName || '');
			setHeaderFirstName((profile?.firstName || nameParts.firstName || 'Scholar').trim() || 'Scholar');

			setFirstName(profile?.firstName || nameParts.firstName || '');
			setMiddleName(profile?.middleName || nameParts.middleName || '');
			setLastName(profile?.lastName || nameParts.lastName || '');
			setYearLevel(profile?.yearLevel || '');
			setSchool(profile?.school || '');

			const accountEmail = user.email || profile?.email || '';
			setEmail(accountEmail);
		} catch {
			setHeaderFirstName('Scholar');
			Alert.alert('Error', 'Unable to load profile settings right now.');
		} finally {
			setIsLoading(false);
		}
	}, [navigation]);

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

	const handleGoStatus = () => navigation.replace('ScholarDashboard');
	const handleGoAppointment = () => navigation.replace('Appointment');
	const handleGoAnnouncement = () => navigation.replace('ScholarAnnouncement');

	React.useEffect(() => {
		loadProfile();
	}, [loadProfile]);

	const handleSaveProfile = async () => {
		const user = auth.currentUser;

		if (!user) {
			Alert.alert('Session expired', 'Please log in again.');
			navigation?.replace('Login');
			return;
		}

		const normalizedFirstName = firstName.trim();
		const normalizedMiddleName = middleName.trim();
		const normalizedLastName = lastName.trim();
		const normalizedYearLevel = yearLevel.trim();
		const normalizedSchool = school.trim();

		if (!normalizedFirstName || !normalizedLastName || !normalizedYearLevel) {
			Alert.alert('Missing fields', 'First name, last name, and year level are required.');
			return;
		}

		const fullName = [normalizedFirstName, normalizedMiddleName, normalizedLastName]
			.filter(Boolean)
			.join(' ');

		try {
			setIsSavingProfile(true);

			await update(ref(database, `users/${user.uid}`), {
				firstName: normalizedFirstName,
				middleName: normalizedMiddleName,
				lastName: normalizedLastName,
				fullName,
				yearLevel: normalizedYearLevel,
				school: normalizedSchool,
				updatedAt: serverTimestamp(),
			});

			await updateProfile(user, { displayName: fullName });

			Alert.alert('Profile updated', 'Your profile details were saved successfully.');
		} catch {
			Alert.alert('Update failed', 'Unable to save profile right now. Please try again.');
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleUpdateAccount = async () => {
		const user = auth.currentUser;

		if (!user || !user.email) {
			Alert.alert('Session expired', 'Please log in again.');
			navigation?.replace('Login');
			return;
		}

		const shouldUpdatePassword = Boolean(newPassword);

		if (!shouldUpdatePassword) {
			Alert.alert('No changes', 'Enter a new password first.');
			return;
		}

		if (!currentPassword) {
			Alert.alert('Current password required', 'Enter your current password to continue.');
			return;
		}

		if (shouldUpdatePassword) {
			if (newPassword.length < 6) {
				Alert.alert('Weak password', 'New password must be at least 6 characters.');
				return;
			}

			if (newPassword !== confirmPassword) {
				Alert.alert('Password mismatch', 'New password and confirm password do not match.');
				return;
			}
		}

		try {
			setIsSavingAccount(true);

			const credential = EmailAuthProvider.credential(user.email, currentPassword);
			await reauthenticateWithCredential(user, credential);

			await updatePassword(user, newPassword);

			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');

			Alert.alert('Account updated', 'Your account credentials were updated successfully.');
		} catch (error) {
			Alert.alert('Update failed', error?.message || 'Unable to update account right now.');
		} finally {
			setIsSavingAccount(false);
		}
	};

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor }]}>
			<StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

<View style={[styles.header, { backgroundColor: headerBgColor }]}>
			<View style={styles.headerLeft}>
				<Text style={[styles.brand, { color: textColor }]}>Hi, {headerFirstName}</Text>
				<View style={styles.headerTag}>
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
			<View style={[styles.card, { backgroundColor: cardBgColor }]}>
				<Text style={[styles.sectionTitle, { color: textColor }]}>Edit Profile</Text>

				<Text style={[styles.label, { color: textColor }]}>First Name</Text>
					<TextInput
						style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
						value={firstName}
						onChangeText={setFirstName}
						placeholder="First name"
						placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>Middle Name</Text>
				<TextInput
					style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={middleName}
					onChangeText={setMiddleName}
					placeholder="Middle name"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>Last Name</Text>
				<TextInput
					style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={lastName}
					onChangeText={setLastName}
					placeholder="Last name"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>Year Level</Text>
				<View
					style={[
						styles.pickerWrapper,
						{
							backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9',
							borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)',
						},
					]}
				>
					<Picker
						selectedValue={yearLevel}
						onValueChange={setYearLevel}
					style={[styles.picker, { color: textColor, backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
					dropdownIconColor={GOLD}
					mode="dropdown"
					itemStyle={[styles.pickerItem, { color: textColor, backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9' }]}
					>
						<Picker.Item
							label="Select year level"
							value=""
							color={darkMode ? 'rgba(203, 213, 225, 0.65)' : '#000000'}
						/>
						{YEAR_LEVEL_OPTIONS.map((option) => (
							<Picker.Item key={option} label={option} value={option} color={darkMode ? textColor : '#000000'} />
						))}
					</Picker>
				</View>

				<Text style={[styles.label, { color: textColor }]}>School</Text>
				<TextInput
					style={[styles.input, styles.readOnlyInput, { backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.08)' : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={school}
					editable={false}
					placeholder="School"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>
					<TouchableOpacity
						style={[styles.primaryButton, (isSavingProfile || isLoading) && styles.disabledButton]}
						disabled={isSavingProfile || isLoading}
						onPress={handleSaveProfile}
						activeOpacity={0.85}
					>
						<Text style={styles.primaryButtonText}>
							{isSavingProfile ? 'SAVING PROFILE...' : 'SAVE PROFILE'}
						</Text>
					</TouchableOpacity>
				</View>

			<View style={[styles.card, styles.cardSpacing, { backgroundColor: cardBgColor }]}>
				<Text style={[styles.sectionTitle, { color: textColor }]}>Account Security</Text>

				<Text style={[styles.label, { color: textColor }]}>Current Email</Text>
				<TextInput
					style={[styles.input, styles.readOnlyInput, { color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)', backgroundColor: darkMode ? 'rgba(212, 175, 55, 0.08)' : '#f9f9f9' }]}
					value={email}
					editable={false}
					placeholder="Email"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>Current Password (required)</Text>
				<TextInput
					style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={currentPassword}
					onChangeText={setCurrentPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					placeholder="Current password"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>New Password</Text>
				<TextInput
					style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={newPassword}
					onChangeText={setNewPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					placeholder="New password"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

				<Text style={[styles.label, { color: textColor }]}>Confirm New Password</Text>
				<TextInput
					style={[styles.input, { backgroundColor: darkMode ? CARD_ALT_BG : '#f9f9f9', color: textColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.15)' }]}
					value={confirmPassword}
					onChangeText={setConfirmPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					placeholder="Confirm new password"
					placeholderTextColor={darkMode ? 'rgba(203, 213, 225, 0.45)' : 'rgba(26, 26, 26, 0.4)'}
					/>

					<TouchableOpacity
						style={[styles.primaryButton, (isSavingAccount || isLoading) && styles.disabledButton]}
						disabled={isSavingAccount || isLoading}
						onPress={handleUpdateAccount}
						activeOpacity={0.85}
					>
						<Text style={styles.primaryButtonText}>
							{isSavingAccount ? 'UPDATING ACCOUNT...' : 'UPDATE PASSWORD'}
						</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>

			<View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.22)' : 'rgba(212, 175, 55, 0.1)' }]}>
				{[
					['view-dashboard-outline', 'Status', false, handleGoStatus],
					['calendar-check-outline', 'Appointment', false, handleGoAppointment],
					['bullhorn-outline', 'Announcement', false, handleGoAnnouncement],
					['cog-outline', 'Settings', true, null],
				].map(([icon, label, active, onPress]) => (
					<TouchableOpacity
						key={label}
						style={[styles.navItem, active && styles.navItemActive]}
						activeOpacity={0.85}
						onPress={onPress || undefined}
					>
						<MaterialCommunityIcons name={icon} size={20} color={active ? GOLD : secondaryTextColor} />
						<Text style={[styles.navText, active && styles.navTextActive, !active && { color: secondaryTextColor }]}>{label}</Text>
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
	brand: {
		color: SLATE_100,
		fontSize: 19,
		fontWeight: '700',
		letterSpacing: 0.2,
	},
	headerTag: {
		backgroundColor: 'rgba(212, 175, 55, 0.12)',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.3)',
		marginLeft: 10,
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
	scroll: {
		paddingHorizontal: 20,
		paddingVertical: 16,
		paddingBottom: 110,
		backgroundColor: OCEAN_DEEP,
	},
	card: {
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.2)',
		borderRadius: 14,
		padding: 14,
	},
	cardSpacing: {
		marginTop: 16,
	},
	sectionTitle: {
		color: SLATE_100,
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 14,
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
		borderColor: 'rgba(212, 175, 55, 0.22)',
		color: SLATE_100,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 12,
		marginBottom: 12,
		fontSize: 14,
	},
	pickerWrapper: {
		borderWidth: 1,
		borderRadius: 10,
		marginBottom: 12,
		overflow: 'hidden',
	},
	picker: {
		height: 50,
		color: SLATE_100,
	},
	pickerItem: {
		fontSize: 14,
	},
	readOnlyInput: {
		opacity: 0.75,
	},
	helperText: {
		fontSize: 12,
		marginTop: -4,
		marginBottom: 12,
	},
	primaryButton: {
		marginTop: 4,
		backgroundColor: GOLD,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
	},
	disabledButton: {
		opacity: 0.7,
	},
	primaryButtonText: {
		color: OCEAN_DEEP,
		fontSize: 13,
		fontWeight: '800',
		letterSpacing: 0.8,
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
