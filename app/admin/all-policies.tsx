import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AllPolicy } from '../../types';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ManagerAllPolicies() {
    const [policies, setPolicies] = useState<AllPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<AllPolicy | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const router = useRouter();
    const params = useLocalSearchParams();
    const statusFilter = params.status as 'active' | 'lapsed' | undefined;

    useEffect(() => {
        const q = query(collection(db, 'all_policies'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const policyData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AllPolicy[];
            setPolicies(policyData);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const getFilteredPolicies = () => {
        let filtered = policies;

        // Filter by status from URL
        if (statusFilter === 'active') {
            filtered = filtered.filter(p => p.policyStatus === 'active');
        } else if (statusFilter === 'lapsed') {
            filtered = filtered.filter(p => ['lapsed', 'matured', 'surrendered'].includes(p.policyStatus));
        }

        // Search by name, policy number, or customer number
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.policyNumber?.toLowerCase().includes(query) || false) ||
                (p.customerName?.toLowerCase().includes(query) || false) ||
                (p.customerNumber?.toLowerCase().includes(query) || false)
            );
        }

        return filtered;
    };

    const openPolicyDetails = (policy: AllPolicy) => {
        setSelectedPolicy(policy);
        setModalVisible(true);
    };

    const filteredPolicies = getFilteredPolicies();

    const getHeaderTitle = () => {
        if (statusFilter === 'active') return 'Active Policies';
        if (statusFilter === 'lapsed') return 'Lapsed Policies';
        return 'All Policies';
    };

    const formatDate = (dateStr: string) => dateStr || 'N/A';

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#3b82f6']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
                </View>
            </LinearGradient>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, number, or policy..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                </View>
            ) : (
                <FlatList
                    data={filteredPolicies}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.policyItem}
                            onPress={() => openPolicyDetails(item)}
                        >
                            <View style={styles.policyRow}>
                                <View style={styles.policyLeft}>
                                    <Text style={styles.policyIcon}>
                                        {item.policyStatus === 'active' ? '🟢' : '🔴'}
                                    </Text>
                                    <View style={styles.policyInfo}>
                                        <Text style={styles.policyName} numberOfLines={1}>
                                            {item.customerName}
                                        </Text>
                                        <Text style={styles.policyNumber}>#{item.policyNumber}</Text>
                                        <Text style={styles.policyFrequency}>{item.frequency}</Text>
                                    </View>
                                </View>
                                <View style={styles.policyRight}>
                                    <Text style={styles.policyAmount}>₹{item.instalmentAmount.toLocaleString()}</Text>
                                    <Text style={styles.viewArrow}>›</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No policies found</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/admin/add-all-policy')}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            {/* Policy Detail Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <LinearGradient
                        colors={['#1e3a8a', '#1e40af', '#3b82f6']}
                        style={styles.modalHeader}
                    >
                        <Text style={styles.modalTitle}>Policy Details</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
                        {selectedPolicy && (
                            <>
                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Policy Number</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.policyNumber}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Customer Name</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.customerName}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Customer Phone</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.customerNumber}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Date of Creation</Text>
                                    <Text style={styles.detailValue}>{formatDate(selectedPolicy.dateOfCreation)}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Frequency</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.frequency}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Instalment Amount</Text>
                                    <Text style={styles.detailValue}>₹{selectedPolicy.instalmentAmount.toLocaleString()}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Date of Birth</Text>
                                    <Text style={styles.detailValue}>{formatDate(selectedPolicy.dateOfBirth)}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Address</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.address || 'N/A'}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Nominee Name</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.nomineeName || 'N/A'}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Nominee Phone</Text>
                                    <Text style={styles.detailValue}>{selectedPolicy.nomineeNumber || 'N/A'}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        selectedPolicy.policyStatus === 'active' ? styles.statusActive : styles.statusInactive
                                    ]}>
                                        <Text style={styles.statusText}>
                                            {selectedPolicy.policyStatus.charAt(0).toUpperCase() + selectedPolicy.policyStatus.slice(1)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.adminActions}>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => {
                                            setModalVisible(false);
                                            router.push(`/admin/edit-all-policy?id=${selectedPolicy.id}`);
                                        }}
                                    >
                                        <Text style={styles.editButtonText}>✏️ Edit Policy</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={async () => {
                                            Alert.alert(
                                                'Delete Policy',
                                                'Are you sure? This cannot be undone.',
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'Delete',
                                                        style: 'destructive',
                                                        onPress: async () => {
                                                            try {
                                                                await deleteDoc(doc(db, 'all_policies', selectedPolicy.id));
                                                                Alert.alert('Success', 'Policy deleted successfully');
                                                                setModalVisible(false);
                                                            } catch (error) {
                                                                console.error('Delete error:', error);
                                                                Alert.alert('Error', 'Failed to delete policy');
                                                            }
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            </Modal>
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
        alignItems: 'center',
    },
    backButton: {
        marginRight: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 8,
        borderRadius: 20,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 18,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        margin: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    policyItem: {
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 6,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    policyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    policyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    policyIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    policyInfo: {
        flex: 1,
    },
    policyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    policyNumber: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 2,
    },
    policyFrequency: {
        fontSize: 12,
        color: '#9ca3af',
    },
    policyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    policyAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1f2937',
        marginRight: 8,
    },
    viewArrow: {
        fontSize: 20,
        color: '#9ca3af',
    },
    emptyContainer: {
        padding: 48,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1e3a8a',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    fabIcon: {
        fontSize: 32,
        color: '#ffffff',
        fontWeight: '300',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 48,
        paddingBottom: 24,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    closeButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 8,
        borderRadius: 20,
    },
    closeButtonText: {
        color: '#ffffff',
        fontSize: 18,
    },
    modalContent: {
        padding: 24,
    },
    detailCard: {
        marginBottom: 20,
    },
    detailLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
        fontWeight: '600',
    },
    detailValue: {
        fontSize: 16,
        color: '#1f2937',
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusActive: {
        backgroundColor: '#d1fae5',
    },
    statusInactive: {
        backgroundColor: '#fee2e2',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    note: {
        backgroundColor: '#fef3c7',
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
    },
    noteText: {
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    adminActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    editButton: {
        flex: 1,
        backgroundColor: '#1e3a8a',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    editButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#dc2626',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});
