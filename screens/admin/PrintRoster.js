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
import { get, ref } from 'firebase/database';
import { database } from '../../lib/firebase';

const GOLD = '#D4AF37';
const OCEAN_DEEP = '#001B2E';
const CARD_BG = '#0B2740';
const CARD_ALT_BG = '#12324E';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';

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
	const [scholars, setScholars] = React.useState([]);
	const [schools, setSchools] = React.useState([]);

	React.useEffect(() => {
		const loadRoster = async () => {
			try {
				setIsLoading(true);
				const snapshot = await get(ref(database, 'users'));

				if (!snapshot.exists()) {
					setScholars([]);
					setSchools([]);
					return;
				}

				const users = snapshot.val();
				const scholarRecords = Object.values(users)
					.filter((user) => user?.role === 'scholar')
					.map((user) => {
						const { firstName, middleName, lastName } = parseName(user);
						return {
							firstName,
							middleName,
							lastName,
							school: (user?.school || 'Not specified').trim() || 'Not specified',
							yearLevel: (user?.yearLevel || 'Not specified').trim() || 'Not specified',
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

				const uniqueSchools = Array.from(new Set(scholarRecords.map((item) => item.school))).sort();

				setScholars(scholarRecords);
				setSchools(uniqueSchools);
			} finally {
				setIsLoading(false);
			}
		};

		loadRoster();
	}, []);

	const filteredScholars = selectedSchool === 'All'
		? scholars
		: scholars.filter((item) => item.school === selectedSchool);

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar style="light" />

			<View style={styles.header}>
				<Text style={styles.headerTitle}>Print Roster</Text>
			</View>

			{isLoading ? (
				<View style={styles.loaderWrap}>
					<ActivityIndicator size="large" color={GOLD} />
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
					<Text style={styles.filterTitle}>Filter by School</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
						{['All', ...schools].map((school) => {
							const isActive = selectedSchool === school;
							return (
								<TouchableOpacity
									key={school}
									style={[styles.filterChip, isActive && styles.filterChipActive]}
									onPress={() => setSelectedSchool(school)}
									activeOpacity={0.85}
								>
									<Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{school}</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>

					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						<View style={styles.tableWrap}>
							<View style={[styles.row, styles.headerRow]}>
								<Text style={[styles.cellText, styles.colNo, styles.headerCellText]}>No.</Text>
								<Text style={[styles.cellText, styles.colLastName, styles.headerCellText]}>Lastname</Text>
								<Text style={[styles.cellText, styles.colFirstName, styles.headerCellText]}>First name</Text>
								<Text style={[styles.cellText, styles.colMiddleName, styles.headerCellText]}>Middlename</Text>
								<Text style={[styles.cellText, styles.colSchool, styles.headerCellText]}>School</Text>
								<Text style={[styles.cellText, styles.colYearLevel, styles.headerCellText]}>Yearlevel</Text>
							</View>

							{filteredScholars.length === 0 ? (
								<View style={styles.emptyTableRow}>
									<MaterialCommunityIcons name="table-off" size={20} color={SLATE_300} />
									<Text style={styles.emptyTableText}>No scholars found for this filter.</Text>
								</View>
							) : (
								filteredScholars.map((item, index) => (
									<View key={`${item.lastName}-${item.firstName}-${index}`} style={styles.row}>
										<Text style={[styles.cellText, styles.colNo]}>{index + 1}</Text>
										<Text style={[styles.cellText, styles.colLastName]}>{item.lastName || '-'}</Text>
										<Text style={[styles.cellText, styles.colFirstName]}>{item.firstName || '-'}</Text>
										<Text style={[styles.cellText, styles.colMiddleName]}>{item.middleName || '-'}</Text>
										<Text style={[styles.cellText, styles.colSchool]}>{item.school}</Text>
										<Text style={[styles.cellText, styles.colYearLevel]}>{item.yearLevel}</Text>
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
		backgroundColor: OCEAN_DEEP,
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(212, 175, 55, 0.2)',
	},
	headerTitle: {
		color: SLATE_100,
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
		color: SLATE_100,
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 8,
	},
	filterRow: {
		paddingBottom: 12,
	},
	filterChip: {
		backgroundColor: CARD_BG,
		borderWidth: 1,
		borderColor: 'rgba(212, 175, 55, 0.2)',
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginRight: 8,
	},
	filterChipActive: {
		backgroundColor: 'rgba(212, 175, 55, 0.16)',
		borderColor: GOLD,
	},
	filterChipText: {
		color: SLATE_300,
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
		backgroundColor: CARD_BG,
		minWidth: 880,
	},
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(212, 175, 55, 0.14)',
		backgroundColor: CARD_BG,
	},
	headerRow: {
		backgroundColor: CARD_ALT_BG,
	},
	cellText: {
		color: SLATE_100,
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
	emptyTableRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 22,
		backgroundColor: CARD_BG,
		gap: 8,
	},
	emptyTableText: {
		color: SLATE_300,
		fontSize: 12,
	},
});
