import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { get, ref, update } from 'firebase/database';
import { database } from '../../lib/firebase';import { useTheme } from '../../lib/ThemeContext';
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

const parseName = (scholar) => {
	const dbFirstName = (scholar?.firstName || '').trim();
	const dbMiddleName = (scholar?.middleName || '').trim();
	const dbLastName = (scholar?.lastName || '').trim();

	if (dbFirstName || dbMiddleName || dbLastName) {
		return {
			firstName: dbFirstName,
			middleName: dbMiddleName,
			lastName: dbLastName,
		};
	}

	const fullName = (scholar?.fullName || '').trim();
	const parts = fullName.split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return {
			firstName: '',
			middleName: '',
			lastName: '',
		};
	}

	if (parts.length === 1) {
		return {
			firstName: parts[0],
			middleName: '',
			lastName: '',
		};
	}

	if (parts.length === 2) {
		return {
			firstName: parts[0],
			middleName: '',
			lastName: parts[1],
		};
	}

	return {
		firstName: parts[0],
		middleName: parts.slice(1, -1).join(' '),
		lastName: parts[parts.length - 1],
	};
};

export default function PrintRoster() {
	const [isLoading, setIsLoading] = React.useState(true);
	const [selectedSchool, setSelectedSchool] = React.useState('All');
	const [selectedCashier, setSelectedCashier] = React.useState('All');
	const [scholars, setScholars] = React.useState([]);
	const [schools, setSchools] = React.useState([]);
	const [cashiersInSchool, setCashiersInSchool] = React.useState([]);
	const { darkMode } = useTheme();

	const backgroundColor = darkMode ? OCEAN_DEEP : LIGHT_BG;
	const cardBgColor = darkMode ? CARD_BG : LIGHT_CARD;
	const textColor = darkMode ? SLATE_100 : LIGHT_TEXT;
	const secondaryTextColor = darkMode ? SLATE_300 : LIGHT_TEXT_SECONDARY;

	React.useEffect(() => {
		const loadRoster = async () => {
			try {
				setIsLoading(true);
				const [usersSnapshot, cashiersSnapshot] = await Promise.all([
					get(ref(database, 'users')),
					get(ref(database, 'adminConfig/cashiers')),
				]);

				if (!usersSnapshot.exists()) {
					setScholars([]);
					setSchools([]);
					return;
				}

				const users = usersSnapshot.val();
				const rawCashiers = cashiersSnapshot.exists() ? cashiersSnapshot.val() : null;
				const cashierItems = Array.isArray(rawCashiers?.items) ? rawCashiers.items : [];

				const normalizedCashiers = cashierItems
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
					.sort((a, b) => a.fullName.localeCompare(b.fullName));

				const scholarRecords = Object.entries(users)
					.filter(([, user]) => user?.role === 'scholar')
					.map(([uid, user]) => {
						const { firstName, middleName, lastName } = parseName(user);
						const schoolName = (user?.school || 'Not specified').trim() || 'Not specified';
						return {
							uid,
							firstName,
							middleName,
							lastName,
							school: schoolName,
							yearLevel: (user?.yearLevel || 'Not specified').trim() || 'Not specified',
							existingClaimingInfo: user?.claimingInfo || {},
						};
					})
					.sort((a, b) => {
						const lastCompare = a.lastName.localeCompare(b.lastName);
						if (lastCompare !== 0) {
							return lastCompare;
						}

						const firstCompare = a.firstName.localeCompare(b.firstName);
						if (firstCompare !== 0) {
							return firstCompare;
						}

						return a.middleName.localeCompare(b.middleName);
					});

				// Group scholars by school
				const scholarsBySchool = {};
				scholarRecords.forEach((item) => {
					const school = item.school;
					if (!scholarsBySchool[school]) {
						scholarsBySchool[school] = [];
					}
					scholarsBySchool[school].push(item);
				});

				const updates = {};
				const processedScholars = [];

				// For each school, distribute scholars among cashiers
				Object.entries(scholarsBySchool).forEach(([school, schoolScholars]) => {
					// Find all cashiers assigned to this school
					const schoolCashiers = normalizedCashiers.filter((cashier) => cashier.schools.includes(school));

					if (schoolCashiers.length === 0) {
						// No cashiers assigned to this school, mark as "Not assigned"
						schoolScholars.forEach((scholar) => {
							updates[`users/${scholar.uid}/claimingInfo/cashierAssigned`] = 'Not assigned';
							updates[`users/${scholar.uid}/claimingInfo/queueNumber`] = 0;
							updates[`users/${scholar.uid}/claimingInfo/updatedAt`] = Date.now();
							processedScholars.push({
								...scholar,
								cashierAssigned: 'Not assigned',
								queueNumber: '—',
							});
						});
					} else {
						// Distribute scholars evenly among cashiers
						const totalScholars = schoolScholars.length;
						const numCashiers = schoolCashiers.length;
						const baseFull = Math.floor(totalScholars / numCashiers);
						const remainder = totalScholars % numCashiers;

						let scholarIndex = 0;

						// Distribute scholars to each cashier
						schoolCashiers.forEach((cashier, cashierIndex) => {
							// Calculate how many scholars this cashier should get
							const scholarCount = cashierIndex < remainder ? baseFull + 1 : baseFull;

							// Assign scholars to this cashier
							for (let i = 0; i < scholarCount; i++) {
								const scholar = schoolScholars[scholarIndex];
								const queueNumber = i + 1; // Queue number starts from 1 for each cashier
								const existingQueue = Number(scholar?.existingClaimingInfo?.queueNumber || 0);
								const existingCashier = String(scholar?.existingClaimingInfo?.cashierAssigned || '').trim();
								const nextCashier = cashier.fullName;

								if (existingQueue !== queueNumber || existingCashier !== nextCashier) {
									updates[`users/${scholar.uid}/claimingInfo/queueNumber`] = queueNumber;
									updates[`users/${scholar.uid}/claimingInfo/cashierAssigned`] = nextCashier;
									updates[`users/${scholar.uid}/claimingInfo/updatedAt`] = Date.now();
								}

								processedScholars.push({
									...scholar,
									cashierAssigned: nextCashier,
									queueNumber: `#${queueNumber}`,
								});

								scholarIndex++;
							}
						});
					}
				});

				if (Object.keys(updates).length > 0) {
					await update(ref(database), updates);
				}

				const uniqueSchools = Array.from(new Set(scholarRecords.map((item) => item.school))).sort();
				const uniqueCashiers = Array.from(new Set(processedScholars.map((item) => item.cashierAssigned)))
					.filter((cashier) => cashier !== 'Not assigned')
					.sort();

				setScholars(processedScholars);
				setSchools(uniqueSchools);
				setCashiersInSchool(uniqueCashiers);
			} finally {
				setIsLoading(false);
			}
		};

		loadRoster();
	}, []);

	const filteredScholars = selectedSchool === 'All'
		? scholars
		: scholars.filter((item) => item.school === selectedSchool);

	const finalScholars = selectedCashier === 'All'
		? filteredScholars
		: filteredScholars.filter((item) => item.cashierAssigned === selectedCashier);

	// Calculate cashiers for the selected school
	const cashiersForSelectedSchool = selectedSchool === 'All'
		? cashiersInSchool
		: Array.from(new Set(
			scholars
				.filter((item) => item.school === selectedSchool)
				.map((item) => item.cashierAssigned)
				.filter((cashier) => cashier && cashier !== 'Not assigned')
		)).sort();

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor }]}>
			<StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent={true} backgroundColor="transparent" />

			<View style={[styles.header, { backgroundColor }]}>
				<Text style={[styles.headerTitle, { color: textColor }]}>Print Roster</Text>
			</View>

			{isLoading ? (
				<View style={styles.loaderWrap}>
					<ActivityIndicator size="large" color={GOLD} />
				</View>
			) : (
				<ScrollView contentContainerStyle={[styles.scroll, { backgroundColor }]} showsVerticalScrollIndicator={false}>
					<Text style={[styles.filterTitle, { color: textColor }]}>Filter by School</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
						{['All', ...schools].map((school) => {
							const isActive = selectedSchool === school;
							return (
								<TouchableOpacity
									key={school}
									style={[styles.filterChip, isActive && styles.filterChipActive]}
									onPress={() => {
										setSelectedSchool(school);
										setSelectedCashier('All');
									}}
									activeOpacity={0.85}
								>
									<Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, { color: isActive ? GOLD : secondaryTextColor }]}>{school}</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>

					{selectedSchool !== 'All' && cashiersForSelectedSchool.length > 0 && (
						<>
							<Text style={[styles.filterTitle, { color: textColor }]}>Filter by Cashier</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
								{['All', ...cashiersForSelectedSchool].map((cashier) => {
									const isActive = selectedCashier === cashier;
									return (
										<TouchableOpacity
											key={cashier}
											style={[styles.filterChip, isActive && styles.filterChipActive]}
											onPress={() => setSelectedCashier(cashier)}
											activeOpacity={0.85}
										>
											<Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, { color: isActive ? GOLD : secondaryTextColor }]}>{cashier}</Text>
										</TouchableOpacity>
									);
								})}
							</ScrollView>
						</>
					)}

					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						<View style={[styles.tableWrap, { backgroundColor: cardBgColor }]}>
							<View style={[styles.row, styles.headerRow, { backgroundColor: darkMode ? CARD_ALT_BG : '#f5f5f5' }]}>
								<Text style={[styles.cellText, styles.colNo, styles.headerCellText, { color: GOLD }]}>No.</Text>
								<Text style={[styles.cellText, styles.colLastName, styles.headerCellText, { color: GOLD }]}>Lastname</Text>
								<Text style={[styles.cellText, styles.colFirstName, styles.headerCellText, { color: GOLD }]}>First name</Text>
								<Text style={[styles.cellText, styles.colMiddleName, styles.headerCellText, { color: GOLD }]}>Middlename</Text>
								<Text style={[styles.cellText, styles.colSchool, styles.headerCellText, { color: GOLD }]}>School</Text>
								<Text style={[styles.cellText, styles.colYearLevel, styles.headerCellText, { color: GOLD }]}>Yearlevel</Text>
								<Text style={[styles.cellText, styles.colCashier, styles.headerCellText, { color: GOLD }]}>Cashier</Text>
								<Text style={[styles.cellText, styles.colQueue, styles.headerCellText, { color: GOLD }]}>Queue</Text>
							</View>

							{finalScholars.length === 0 ? (
								<View style={[styles.emptyTableRow, { backgroundColor: cardBgColor }]}>
									<MaterialCommunityIcons name="table-off" size={20} color={secondaryTextColor} />
									<Text style={[styles.emptyTableText, { color: secondaryTextColor }]}>No scholars found for this filter.</Text>
								</View>
							) : (
								finalScholars.map((item, index) => (
										<View key={`${item.lastName}-${item.firstName}-${index}`} style={[styles.row, { backgroundColor: cardBgColor }]}>
											<Text style={[styles.cellText, styles.colNo, { color: textColor }]}>{index + 1}</Text>
											<Text style={[styles.cellText, styles.colLastName, { color: textColor }]}>{item.lastName || '-'}</Text>
											<Text style={[styles.cellText, styles.colFirstName, { color: textColor }]}>{item.firstName || '-'}</Text>
											<Text style={[styles.cellText, styles.colMiddleName, { color: textColor }]}>{item.middleName || '-'}</Text>
											<Text style={[styles.cellText, styles.colSchool, { color: textColor }]}>{item.school}</Text>
											<Text style={[styles.cellText, styles.colYearLevel, { color: textColor }]}>{item.yearLevel}</Text>
											<Text style={[styles.cellText, styles.colCashier, { color: textColor }]}>{item.cashierAssigned || 'N/A'}</Text>
											<Text style={[styles.cellText, styles.colQueue, { color: textColor }]}>{item.queueNumber || '—'}</Text>
									</View>
								))
							)}
						</View>
					</ScrollView>
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
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(212, 175, 55, 0.2)',
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: '700',
	},
	loaderWrap: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 24,
	},
	filterTitle: {
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 8,
	},
	filterRow: {
		paddingBottom: 12,
	},
	filterChip: {
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.2)',
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginRight: 8,
	},
	filterChipActive: {
		borderColor: GOLD,
	},
	filterChipText: {
		fontSize: 12,
		fontWeight: '600',
	},
	filterChipTextActive: {
		color: GOLD,
	},
	tableWrap: {
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.2)',
		borderRadius: 12,
		overflow: 'hidden',
		minWidth: 1120,
	},
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(212, 175, 55, 0.14)',
	},
	headerRow: {
	},
	cellText: {
		fontSize: 12,
		paddingVertical: 10,
		paddingHorizontal: 10,
	},
	headerCellText: {
		fontWeight: '700',
		color: GOLD,
	},
	colNo: {
		width: 60,
	},
	colLastName: {
		width: 140,
	},
	colFirstName: {
		width: 140,
	},
	colMiddleName: {
		width: 160,
	},
	colSchool: {
		width: 260,
	},
	colYearLevel: {
		width: 120,
	},
	colCashier: {
		width: 140,
	},
	colQueue: {
		width: 100,
	},
	emptyTableRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 22,
		gap: 8,
	},
	emptyTableText: {
		fontSize: 12,
	},
});
