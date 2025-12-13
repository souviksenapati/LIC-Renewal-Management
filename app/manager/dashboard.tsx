import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useState, useCallback } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';

export default function ManagerDashboard() {
    const { signOut, user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        pendingCount: 0,
        verifiedCount: 0,
        activeCount: 0,
        lapsedCount: 0
    });
    const [loadingStats, setLoadingStats] = useState(true);

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchStats();
        }, [])
    );

    const fetchStats = async () => {
        try {
            setLoadingStats(true);

            // Fetch current month policies (pending & verified)
            const policiesQuery = query(collection(db, 'policies'));
            const policiesSnapshot = await getDocs(policiesQuery);

            let pendingCount = 0;
            let verifiedCount = 0;

            policiesSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.status === 'pending') {
                    pendingCount++;
                } else if (data.status === 'verified') {
                    verifiedCount++;
                }
            });

            // Fetch all policies (active & lapsed)
            const allPoliciesQuery = query(collection(db, 'all_policies'));
            const allPoliciesSnapshot = await getDocs(allPoliciesQuery);

            let activeCount = 0;
            let lapsedCount = 0;

            allPoliciesSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.policyStatus === 'active') {
                    activeCount++;
                } else if (['lapsed', 'matured', 'surrendered'].includes(data.policyStatus)) {
                    lapsedCount++;
                }
            });

            setStats({ pendingCount, verifiedCount, activeCount, lapsedCount });
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    // Pull-to-refresh handler
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#92400e', '#b45309', '#f59e0b']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Manager Portal</Text>
                    <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.headerSubtitle}>Welcome, {user?.email}</Text>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 100, padding: 20 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#f59e0b']}
                        tintColor="#f59e0b"
                    />
                }
            >
                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    {/* Card 1: Current Month Pending */}
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardOrange]}
                        onPress={() => router.push('/manager/current-policies?status=pending')}
                    >
                        <Text style={styles.statLabel}>Pending</Text>
                        <Text style={styles.statValue}>{stats.pendingCount}</Text>
                    </TouchableOpacity>

                    {/* Card 2: Current Month Verified */}
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardGreen]}
                        onPress={() => router.push('/manager/current-policies?status=verified')}
                    >
                        <Text style={styles.statLabel}>Verified</Text>
                        <Text style={styles.statValue}>{stats.verifiedCount}</Text>
                    </TouchableOpacity>

                    {/* Card 3: Total Active Policies */}
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardBlue]}
                        onPress={() => router.push('/manager/all-policies?status=active')}
                    >
                        <Text style={styles.statLabel}>Total Active</Text>
                        <Text style={styles.statValue}>{stats.activeCount}</Text>
                    </TouchableOpacity>

                    {/* Card 4: Total Lapsed */}
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardRed]}
                        onPress={() => router.push('/manager/all-policies?status=lapsed')}
                    >
                        <Text style={styles.statLabel}>Total Lapsed</Text>
                        <Text style={styles.statValue}>{stats.lapsedCount}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        paddingTop: 48,
        paddingBottom: 24,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
    },
    logoutButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    logoutText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        flex: 1,
        minWidth: '47%',
    },
    statCardOrange: {
        backgroundColor: '#ffedd5',
    },
    statCardGreen: {
        backgroundColor: '#dcfce7',
    },
    statCardBlue: {
        backgroundColor: '#dbeafe',
    },
    statCardRed: {
        backgroundColor: '#fee2e2',
    },
    statLabel: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 4,
    },
});
