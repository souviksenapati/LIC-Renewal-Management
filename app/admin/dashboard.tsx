import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useState, useCallback } from 'react';
import { collection, query, getDocs, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';

export default function AdminDashboard() {
    const { signOut, user } = useAuth();
    const router = useRouter();
    const [clearModalVisible, setClearModalVisible] = useState(false);
    const [stats, setStats] = useState({
        totalDue: 0,
        verifiedCount: 0,
        pendingCount: 0,
        totalAmount: 0,
        totalCommission: 0,
        activeAllPolicies: 0,
        lapsedAllPolicies: 0
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [clearing, setClearing] = useState(false);

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

            // Fetch current month policies stats
            const q = query(collection(db, 'policies'));
            const querySnapshot = await getDocs(q);

            let totalDue = 0;
            let verifiedCount = 0;
            let pendingCount = 0;
            let totalAmount = 0;
            let totalCommission = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                totalDue++;
                totalAmount += data.amount || 0;
                if (data.status === 'verified') {
                    verifiedCount++;
                    totalCommission += data.commission || 0;
                } else {
                    pendingCount++;
                }
            });

            // Fetch all_policies stats
            const allPoliciesQuery = query(collection(db, 'all_policies'));
            const allPoliciesSnapshot = await getDocs(allPoliciesQuery);

            let activeAllPolicies = 0;
            let lapsedAllPolicies = 0;

            allPoliciesSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.policyStatus === 'active') {
                    activeAllPolicies++;
                } else if (['lapsed', 'matured', 'surrendered'].includes(data.policyStatus)) {
                    lapsedAllPolicies++;
                }
            });

            setStats({
                totalDue,
                verifiedCount,
                pendingCount,
                totalAmount,
                totalCommission,
                activeAllPolicies,
                lapsedAllPolicies
            });
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

    const clearAllPolicies = async () => {
        try {
            setClearing(true);
            const q = query(collection(db, 'policies'));
            const querySnapshot = await getDocs(q);

            // Batch deletions to prevent memory issues (max 500 per batch)
            const BATCH_SIZE = 500;
            const totalDocs = querySnapshot.size;
            let deleted = 0;

            for (let i = 0; i < querySnapshot.docs.length; i += BATCH_SIZE) {
                const batch = querySnapshot.docs.slice(i, i + BATCH_SIZE);
                const deletePromises = batch.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                deleted += batch.length;
                console.log(`Deleted ${deleted}/${totalDocs} policies`);
            }

            Alert.alert('Success', `Deleted ${totalDocs} policies`);
            fetchStats();
            setClearModalVisible(false);
        } catch (error) {
            console.error("Error clearing policies:", error);
            Alert.alert('Error', 'Failed to clear policies');
        } finally {
            setClearing(false);
        }
    };

    const clearVerifiedPolicies = async () => {
        try {
            setClearing(true);
            const q = query(collection(db, 'policies'), where('status', '==', 'verified'));
            const querySnapshot = await getDocs(q);

            // Batch deletions to prevent memory issues (max 500 per batch)
            const BATCH_SIZE = 500;
            const totalDocs = querySnapshot.size;
            let deleted = 0;

            for (let i = 0; i < querySnapshot.docs.length; i += BATCH_SIZE) {
                const batch = querySnapshot.docs.slice(i, i + BATCH_SIZE);
                const deletePromises = batch.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                deleted += batch.length;
                console.log(`Deleted ${deleted}/${totalDocs} verified policies`);
            }

            Alert.alert('Success', `Deleted ${totalDocs} verified policies`);
            fetchStats();
            setClearModalVisible(false);
        } catch (error) {
            console.error("Error clearing verified policies:", error);
            Alert.alert('Error', 'Failed to clear verified policies');
        } finally {
            setClearing(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#3b82f6'] as const}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                    <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.headerSubtitle}>Welcome, {user?.email}</Text>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#3b82f6']}
                        tintColor="#3b82f6"
                    />
                }
            >
                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Policies</Text>
                        <Text style={styles.statValue}>{stats.totalDue}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Amount</Text>
                        <Text style={styles.statValue}>₹{stats.totalAmount.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardGreen]}
                        onPress={() => router.push('/admin/policies?status=verified')}
                    >
                        <Text style={styles.statLabel}>Verified</Text>
                        <Text style={styles.statValueGreen}>{stats.verifiedCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardOrange]}
                        onPress={() => router.push('/admin/policies?status=pending')}
                    >
                        <Text style={styles.statLabel}>Pending</Text>
                        <Text style={styles.statValueOrange}>{stats.pendingCount}</Text>
                    </TouchableOpacity>
                    <View style={[styles.statCard, styles.statCardBlue]}>
                        <Text style={styles.statLabel}>Total Commission</Text>
                        <Text style={styles.statValueBlue}>₹{stats.totalCommission.toLocaleString()}</Text>
                        <Text style={styles.statSubtext}>(Verified only)</Text>
                    </View>

                    {/* New All Policies Stats */}
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardTeal]}
                        onPress={() => router.push('/admin/all-policies?status=active')}
                    >
                        <Text style={styles.statLabel}>Total Active</Text>
                        <Text style={styles.statValueTeal}>{stats.activeAllPolicies}</Text>
                        <Text style={styles.statSubtext}>All policies • Master DB</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardRed]}
                        onPress={() => router.push('/admin/all-policies?status=lapsed')}
                    >
                        <Text style={styles.statLabel}>Total Lapsed</Text>
                        <Text style={styles.statValueRed}>{stats.lapsedAllPolicies}</Text>
                        <Text style={styles.statSubtext}>All policies • Master DB</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/admin/policies')}
                    >
                        <View style={styles.actionIcon}>
                            <Text style={styles.actionIconText}>P</Text>
                        </View>
                        <View>
                            <Text style={styles.actionTitle}>Manage Policies</Text>
                            <Text style={styles.actionSubtitle}>View all, add new, or verify receipts</Text>
                        </View>
                    </TouchableOpacity>



                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/admin/upload-pdf')}
                    >
                        <View style={[styles.actionIcon, styles.actionIconRed]}>
                            <Text style={[styles.actionIconText, styles.actionIconTextRed]}>📄</Text>
                        </View>
                        <View>
                            <Text style={styles.actionTitle}>Upload PDF List</Text>
                            <Text style={styles.actionSubtitle}>Bulk import from Premium Due List</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => setClearModalVisible(true)}
                    >
                        <View style={[styles.actionIcon, styles.actionIconOrange]}>
                            <Text style={[styles.actionIconText, styles.actionIconTextOrange]}>🗑️</Text>
                        </View>
                        <View>
                            <Text style={styles.actionTitle}>Clear Policies</Text>
                            <Text style={styles.actionSubtitle}>Remove all or verified policies for new month</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Clear Policies Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={clearModalVisible}
                onRequestClose={() => setClearModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Clear Policies</Text>
                        <Text style={styles.modalSubtitle}>Choose which policies to delete:</Text>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonDanger]}
                            onPress={() => {
                                Alert.alert(
                                    'Clear All Policies',
                                    'This will delete ALL policies. Are you sure?',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete All', style: 'destructive', onPress: clearAllPolicies }
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.modalButtonText}>🗑️ Clear All Policies</Text>
                            <Text style={styles.modalButtonSubtext}>Delete all {stats.totalDue} policies</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonWarning]}
                            onPress={() => {
                                Alert.alert(
                                    'Clear Verified Policies',
                                    `This will delete ${stats.verifiedCount} verified policies. Are you sure?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete Verified', style: 'destructive', onPress: clearVerifiedPolicies }
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.modalButtonText}>✓ Clear Verified Only</Text>
                            <Text style={styles.modalButtonSubtext}>Delete {stats.verifiedCount} verified policies</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalButtonCancel}
                            onPress={() => setClearModalVisible(false)}
                        >
                            <Text style={styles.modalButtonCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        paddingTop: 48,
        paddingBottom: 24,
        paddingHorizontal: 20,
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
        fontWeight: '800',
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
        fontSize: 14,
        fontWeight: '600',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#bfdbfe',
        marginTop: 4,
    },
    scrollView: {
        flex: 1,
        padding: 20,
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
    statCardGreen: {
        backgroundColor: '#dcfce7',
    },
    statCardOrange: {
        backgroundColor: '#ffedd5',
    },
    statCardBlue: {
        backgroundColor: '#dbeafe',
    },
    statCardTeal: {
        backgroundColor: '#ccfbf1',
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
    statValueGreen: {
        fontSize: 24,
        fontWeight: '700',
        color: '#16a34a',
        marginTop: 4,
    },
    statValueOrange: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ea580c',
        marginTop: 4,
    },
    statValueBlue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2563eb',
        marginTop: 4,
    },
    statValueTeal: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0d9488',
        marginTop: 4,
    },
    statValueRed: {
        fontSize: 24,
        fontWeight: '700',
        color: '#dc2626',
        marginTop: 4,
    },
    statSubtext: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 12,
    },
    actionsContainer: {
        gap: 12,
    },
    actionCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionIconRed: {
        backgroundColor: '#ef4444',
    },
    actionIconOrange: {
        backgroundColor: '#f97316',
    },
    actionIconText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    actionIconTextRed: {
        fontSize: 24,
    },
    actionIconTextOrange: {
        fontSize: 20,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 13,
        color: '#6b7280',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 20,
    },
    modalButton: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    modalButtonDanger: {
        backgroundColor: '#fee2e2',
    },
    modalButtonWarning: {
        backgroundColor: '#fef3c7',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    modalButtonSubtext: {
        fontSize: 13,
        color: '#6b7280',
    },
    modalButtonCancel: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        marginTop: 8,
    },
    modalButtonCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6b7280',
        textAlign: 'center',
    },
});