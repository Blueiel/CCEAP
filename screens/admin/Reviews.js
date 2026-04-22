import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { database } from '../../lib/firebase';
import { ref, get, update, push, serverTimestamp } from 'firebase/database';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../../lib/ThemeContext';

const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const GOLD = '#D4AF37';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';

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

export default function Reviews() {
	const navigation = useNavigation();
	const { darkMode, toggleDarkMode } = useTheme();
	const [headerFullName, setHeaderFullName] = React.useState('');
	const [schools, setSchools] = React.useState([]);
	const [requirementsChecklist, setRequirementsChecklist] = React.useState(
		DEFAULT_REQUIREMENTS_CHECKLIST.map((item, index) => normalizeRequirement(item, index))
	);
	const [expandedSchools, setExpandedSchools] = React.useState({});
	const [expandedScholars, setExpandedScholars] = React.useState({});
	const [savingKey, setSavingKey] = React.useState('');
	const [loading, setLoading] = React.useState(true);
	const [modifiedScholars, setModifiedScholars] = React.useState({});
	const [applyingScholar, setApplyingScholar] = React.useState('');

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

	const loadScholars = React.useCallback(async () => {
		try {
			setLoading(true);
			const [usersSnapshot, requirementsSnapshot] = await Promise.all([
				get(ref(database, 'users')),
				get(ref(database, 'adminConfig/requirements')),
			]);

			const requirementsConfig = requirementsSnapshot.exists() ? requirementsSnapshot.val() : null;
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

			setRequirementsChecklist(configuredRequirements);

			if (usersSnapshot.exists()) {
				const data = usersSnapshot.val();
				const scholarsMap = {};

				Object.keys(data).forEach((key) => {
					const user = data[key];
					if (user.role === 'scholar') {
						const school = (user.school || 'Not specified').trim();
						if (!scholarsMap[school]) {
							scholarsMap[school] = [];
						}

						scholarsMap[school].push({
							uid: key,
							requirements: user.requirements || {},
							...user,
						});
					}
				});

				const schoolsArray = Object.keys(scholarsMap)
					.sort()
					.map((schoolName) => ({
						name: schoolName,
						scholars: scholarsMap[schoolName].sort((a, b) =>
							(a.fullName || '').localeCompare(b.fullName || '')
						),
						count: scholarsMap[schoolName].length,
					}));

				setSchools(schoolsArray);
			} else {
				setSchools([]);
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to load scholars: ' + error.message);
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
		}, [loadScholars])
	);

	const toggleSchool = (schoolName) => {
		setExpandedSchools((prev) => ({
			...prev,
			[schoolName]: !prev[schoolName],
		}));
	};

	const toggleScholar = (uid) => {
		setExpandedScholars((prev) => ({
			...prev,
			[uid]: !prev[uid],
		}));
	};

	const handleGoHome = () => {
		navigation.replace('AdminDashboard');
	};

	const handleGoScholars = () => {
		navigation.replace('ScholarRegistry');
	};

	const handleGoAlerts = () => {
		navigation.replace('Alerts');
	};

	const handleGoSettings = () => {
		navigation.replace('AdminSettings');
	};

	const handleToggleRequirement = async (uid, requirementId, currentValue) => {
		const updateId = `${uid}-${requirementId}`;

		try {
			setSavingKey(updateId);
			await update(ref(database, `users/${uid}`), {
				[`requirements/${requirementId}`]: !currentValue,
			});

			setModifiedScholars((prev) => ({
				...prev,
				[uid]: true,
			}));

			setSchools((prevSchools) =>
				prevSchools.map((school) => ({
					...school,
					scholars: school.scholars.map((scholar) => {
						if (scholar.uid !== uid) {
							return scholar;
						}

						return {
							...scholar,
							requirements: {
								...(scholar.requirements || {}),
								[requirementId]: !currentValue,
							},
						};
					}),
				}))
			);
		} catch {
			Alert.alert('Update failed', 'Unable to update requirement status right now.');
		} finally {
			setSavingKey('');
		}
	};

	const handleApplyChanges = async (uid, scholarData, schoolName) => {
		try {
			setApplyingScholar(uid);
			const activeRequirementIds = requirementsChecklist.map((item) => item.id);
			const completedRequirements = activeRequirementIds.filter((id) => !!scholarData?.requirements?.[id]);
			const totalRequirements = activeRequirementIds.length;
			const requirementsSummary = `${completedRequirements.length}/${totalRequirements} requirements completed`;

			const alertsRef = ref(database, 'alerts');
			await push(alertsRef, {
				type: 'requirement_update',
				scholar: {
					uid,
					name: scholarData.fullName || 'Unknown Scholar',
					email: scholarData.email || '',
					school: schoolName,
				},
				requirementsSummary,
				completedCount: completedRequirements.length,
				totalCount: totalRequirements,
				status: 'pending',
				createdAt: serverTimestamp(),
				adminName: headerFullName || 'Admin',
			});

			setModifiedScholars((prev) => {
				const updated = { ...prev };
				delete updated[uid];
				return updated;
			});

			Alert.alert('Saved', 'Requirement changes were applied.');
		} catch (error) {
			Alert.alert('Error', 'Failed to apply changes: ' + error.message);
		} finally {
			setApplyingScholar('');
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={[styles.safe, { backgroundColor }]}>
				<StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />
				<View style={[styles.header, { backgroundColor }]}>
					<View style={styles.headerLeft}>
						<Text style={[styles.brand, { color: textColor }]}>Hi, {headerFullName || 'Admin'}</Text>
					</View>

					<View style={styles.headerActions}>
						<TouchableOpacity style={[styles.notifButton, { backgroundColor: cardBgColor }]} activeOpacity={0.85} onPress={handleLogout}>
							<MaterialCommunityIcons name="logout" size={22} color={GOLD} />
						</TouchableOpacity>
					</View>
				</View>
				<View style={styles.loaderContainer}>
					<ActivityIndicator size="large" color={GOLD} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor }]}>
			<StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />
			<View style={[styles.header, { backgroundColor }]}>
				<View style={styles.headerLeft}>
					<Text style={[styles.brand, { color: textColor }]}>Hi, {headerFullName || 'Admin'}</Text>
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

			<ScrollView
				style={[styles.content, { backgroundColor }]}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 110, backgroundColor }}
			>
				{schools.length === 0 ? (
					<View style={styles.emptyContainer}>
						<MaterialCommunityIcons name="information-outline" size={50} color={secondaryTextColor} />
						<Text style={[styles.emptyText, { color: secondaryTextColor }]}>No scholars found</Text>
					</View>
				) : (
					schools.map((school) => (
						<View key={school.name} style={[styles.schoolContainer, { backgroundColor: cardBgColor, borderColor: darkMode ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.08)' }]}>
							<TouchableOpacity style={[styles.schoolHeader, { backgroundColor: cardBgColor }]} onPress={() => toggleSchool(school.name)}>
								<View style={styles.schoolLeftContent}>
									<MaterialCommunityIcons
										name={expandedSchools[school.name] ? 'chevron-down' : 'chevron-right'}
										size={24}
										color={GOLD}
									/>
								<View style={styles.schoolInfo}>
										<Text style={[styles.schoolName, { color: textColor }]}>{school.name}</Text>
										<Text style={[styles.scholarCount, { color: secondaryTextColor }]}>
											{school.count} {school.count === 1 ? 'scholar' : 'scholars'}
										</Text>
									</View>
								</View>
								<View style={styles.schoolBadge}>
									<Text style={styles.badgeText}>{school.count}</Text>
								</View>
							</TouchableOpacity>

							{expandedSchools[school.name] && (
										<View style={[styles.scholarsListContainer, { backgroundColor: darkMode ? CARD_ALT_BG : 'rgba(212, 175, 55, 0.05)' }]}>
									{school.scholars.map((scholar, scholIndex) => {
										const isExpanded = !!expandedScholars[scholar.uid];
										const isComplete =
											requirementsChecklist.length > 0 &&
											requirementsChecklist.every((item) => !!scholar?.requirements?.[item.id]);
										const isModified = !!modifiedScholars[scholar.uid];
										const isApplying = applyingScholar === scholar.uid;

										return (
											<View
												key={scholar.uid}
												style={[
													styles.scholarItemWrap,
													scholIndex === school.scholars.length - 1 && styles.lastScholarItem,
												]}
											>
												<TouchableOpacity
													style={styles.scholarItem}
													activeOpacity={0.85}
													onPress={() => toggleScholar(scholar.uid)}
												>
													<View style={styles.scholarAvatar}>
														<MaterialCommunityIcons name="account" size={16} color={GOLD} />
													</View>
													<View style={styles.scholarDetails}>
														<Text style={[styles.scholarName, { color: textColor }]}>{scholar.fullName || 'Unknown Scholar'}</Text>
														<Text style={[styles.scholarEmail, { color: secondaryTextColor }]}>{scholar.email}</Text>
														{scholar.yearLevel && <Text style={[styles.scholarYearLevel, { color: darkMode ? GOLD : LIGHT_TEXT_SECONDARY }]}>{scholar.yearLevel}</Text>}
													</View>
													<View style={styles.scholarRightCol}>
														<View
															style={[
																styles.statusBadge,
																{
																	backgroundColor: darkMode
																		? CARD_BG
																		: 'rgba(74, 222, 128, 0.18)',
																	borderColor: darkMode
																		? 'transparent'
																		: 'rgba(74, 222, 128, 0.4)',
																},
																isModified && styles.statusBadgeModified,
															]}
														>
															<Text
																style={[
																	styles.statusText,
																	{
																		color: isModified
																			? GOLD
																			: darkMode
																			? GOLD
																			: '#166534',
																	},
																]}
															>
																{isModified ? 'Modified' : (isComplete ? 'Complete' : 'Incomplete')}
															</Text>
														</View>
														<MaterialCommunityIcons
															name={isExpanded ? 'chevron-up' : 'chevron-down'}
															size={18}
															color={GOLD}
															style={styles.scholarChevron}
														/>
													</View>
												</TouchableOpacity>

												{isExpanded && (
													<View style={[styles.requirementsWrap, { backgroundColor: darkMode ? 'rgba(0, 27, 46, 0.2)' : '#fafafa' }]}>
														<Text style={[styles.requirementsTitle, { color: textColor }]}>Requirements Checklist</Text>
															{requirementsChecklist.length === 0 ? (
																<Text style={[styles.noRequirementsText, { color: secondaryTextColor }]}>No required items configured.</Text>
															) : null}
															{requirementsChecklist.map((item) => {
															const checked = !!scholar?.requirements?.[item.id];
															const isSaving = savingKey === `${scholar.uid}-${item.id}`;

															return (
																<TouchableOpacity
																	key={item.id}
																	style={styles.requirementRow}
																	activeOpacity={0.85}
																	onPress={() => handleToggleRequirement(scholar.uid, item.id, checked)}
																	disabled={isSaving}
																>
																	<MaterialCommunityIcons
																		name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
																		size={20}
																		color={checked ? GOLD : secondaryTextColor}
																		style={styles.checkIcon}
																	/>
																	<View style={styles.requirementTextWrap}>
																		<Text style={[styles.requirementLabel, { color: textColor }]}>{item.label}</Text>
																		<Text style={[styles.requirementDetail, { color: secondaryTextColor }]}>{item.detail}</Text>
																	</View>
																	{isSaving && <ActivityIndicator size="small" color={GOLD} />}
																</TouchableOpacity>
															);
														})}

														{isModified && (
															<TouchableOpacity
																style={[styles.applyButton, isApplying && styles.applyButtonDisabled]}
																onPress={() => handleApplyChanges(scholar.uid, scholar, school.name)}
																disabled={isApplying}
																activeOpacity={0.85}
															>
																{isApplying ? (
																	<ActivityIndicator size="small" color={OCEAN_DEEP} />
																) : (
																	<>
																		<MaterialCommunityIcons name="check-circle" size={18} color={OCEAN_DEEP} />
																		<Text style={styles.applyButtonText}>Apply & Notify</Text>
																	</>
																)}
															</TouchableOpacity>
														)}
													</View>
												)}
											</View>
										);
									})}
								</View>
							)}
						</View>
					))
				)}
			</ScrollView>

			<View style={[styles.bottomNav, { backgroundColor: cardBgColor, borderTopColor: darkMode ? 'rgba(212, 175, 55, 0.22)' : 'rgba(212, 175, 55, 0.1)' }]}>
				{[
					['home-outline', 'Home', false, handleGoHome],
					['account-group-outline', 'Scholars', false, handleGoScholars],
					['file-document-outline', 'Reviews', true, null],
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
	loaderContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyText: {
		fontSize: 16,
		color: SLATE_300,
		marginTop: 12,
	},
	schoolContainer: {
		marginBottom: 12,
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: CARD_ALT_BG,
	},
	schoolHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 14,
		paddingHorizontal: 14,
		backgroundColor: CARD_BG,
	},
	schoolLeftContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	schoolInfo: {
		flex: 1,
		marginLeft: 12,
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
		paddingVertical: 8,
	},
	scholarItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	scholarItemWrap: {
		borderBottomWidth: 1,
		borderBottomColor: CARD_BG,
	},
	lastScholarItem: {
		borderBottomWidth: 0,
	},
	scholarAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: CARD_BG,
		justifyContent: 'center',
		alignItems: 'center',
	},
	scholarDetails: {
		flex: 1,
		marginLeft: 12,
	},
	scholarName: {
		fontSize: 14,
		fontWeight: '600',
		color: SLATE_100,
	},
	scholarEmail: {
		fontSize: 12,
		color: SLATE_300,
		marginTop: 2,
	},
	scholarYearLevel: {
		fontSize: 11,
		color: GOLD,
		marginTop: 2,
		fontWeight: '600',
	},
	statusBadge: {
		backgroundColor: CARD_BG,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	statusBadgeModified: {
		backgroundColor: 'rgba(212, 175, 55, 0.3)',
		borderWidth: 1,
		borderColor: GOLD,
	},
	scholarRightCol: {
		alignItems: 'flex-end',
	},
	scholarChevron: {
		marginTop: 6,
	},
	statusText: {
		fontSize: 10,
		fontWeight: '700',
		color: GOLD,
	},
	requirementsWrap: {
		paddingHorizontal: 14,
		paddingBottom: 12,
		paddingTop: 2,
		backgroundColor: 'rgba(0, 27, 46, 0.2)',
	},
	requirementsTitle: {
		color: SLATE_100,
		fontSize: 13,
		fontWeight: '700',
		marginBottom: 8,
	},
	noRequirementsText: {
		color: SLATE_300,
		fontSize: 11,
		marginBottom: 8,
	},
	requirementRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: 'rgba(203, 213, 225, 0.12)',
	},
	checkIcon: {
		marginTop: 1,
		marginRight: 10,
	},
	requirementTextWrap: {
		flex: 1,
		paddingRight: 8,
	},
	requirementLabel: {
		color: SLATE_100,
		fontSize: 12,
		fontWeight: '600',
		marginBottom: 2,
	},
	requirementDetail: {
		color: SLATE_300,
		fontSize: 11,
		lineHeight: 16,
	},
	applyButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: GOLD,
		borderRadius: 8,
		paddingVertical: 12,
		marginTop: 16,
		gap: 8,
	},
	applyButtonDisabled: {
		opacity: 0.7,
	},
	applyButtonText: {
		color: OCEAN_DEEP,
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 0.5,
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
};
