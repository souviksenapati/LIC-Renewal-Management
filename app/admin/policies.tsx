import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Image, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Policy } from '../../types';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function AdminPolicies() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'action_needed' | 'awaiting'>('action_needed');

    const router = useRouter();
    const params = useLocalSearchParams();
    const statusFilter = params.status as string | undefined;

    useEffect(() => {
        const q = query(collection(db, 'policies'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const policiesData: Policy[] = [];
            snapshot.forEach((doc) => {
                policiesData.push({ id: doc.id, ...doc.data() } as Policy);
            });
            setPolicies(policiesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter Logic
    const getFilteredData = () => {
        // Sanitize user input to prevent regex injection
        const sanitizeString = (str: string) => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const searchLower = sanitizeString(filter.toLowerCase());

        if (statusFilter === 'pending') {
            if (activeTab === 'action_needed') {
                return policies.filter(p =>
                    p.status === 'pending' && p.receiptUrl &&
                    (p.policyNumber.toLowerCase().includes(searchLower) || p.customerName.toLowerCase().includes(searchLower))
                );
            } else {
                return policies.filter(p =>
                    p.status === 'pending' && !p.receiptUrl &&
                    (p.policyNumber.toLowerCase().includes(searchLower) || p.customerName.toLowerCase().includes(searchLower))
                );
            }
        }

        return policies.filter(p => {
            const matchesSearch = p.policyNumber.toLowerCase().includes(searchLower) ||
                p.customerName.toLowerCase().includes(searchLower);
            const matchesStatus = statusFilter ? p.status === statusFilter : true;
            return matchesSearch && matchesStatus;
        });
    };

    const filteredPolicies = getFilteredData();

    // Counts for tabs
    const actionNeededCount = policies.filter(p => p.status === 'pending' && p.receiptUrl).length;
    const awaitingCount = policies.filter(p => p.status === 'pending' && !p.receiptUrl).length;

    const verifyPolicy = async (id: string) => {
        try {
            await updateDoc(doc(db, 'policies', id), {
                status: 'verified',
                verifiedAt: Date.now()
            });
            Alert.alert('Success', 'Policy verified successfully');
            if (selectedPolicy?.id === id) {
                setModalVisible(false);
                setSelectedPolicy(null);
            }
        } catch (error) {
            console.error("Error verifying policy:", error);
            Alert.alert('Error', 'Failed to verify policy');
        }
    };

    const openPolicyDetails = (policy: Policy) => {
        setSelectedPolicy(policy);
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: Policy }) => (
        <TouchableOpacity
            style={styles.policyCard}
            onPress={() => openPolicyDetails(item)}
        >
            <View style={styles.policyHeader}>
                <View>
                    <Text style={styles.policyName}>{item.customerName}</Text>
                    <Text style={styles.policyNumber}>#{item.policyNumber}</Text>
                </View>
                <View style={[styles.statusBadge, item.status === 'verified' ? styles.statusVerified : styles.statusPending]}>
                    <Text style={[styles.statusText, item.status === 'verified' ? styles.statusTextVerified : styles.statusTextPending]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.policyDetails}>
                <Text style={styles.policyAmount}>₹{item.amount.toLocaleString()}</Text>
                <Text style={styles.policyDue}>Due: {item.dueDate}</Text>
            </View>

            {item.status === 'pending' && item.receiptUrl && (
                <View style={styles.actionRequiredBadge}>
                    <Text style={styles.actionRequiredText}>⚠️ Action Required</Text>
                </View>
            )}

            <Text style={styles.viewDetailsText}>View Details &gt;</Text>
        </TouchableOpacity>
    );

    const getHeaderTitle = () => {
        if (statusFilter === 'verified') return 'Verified Policies';
        if (statusFilter === 'pending') return 'Pending Policies';
        return 'All Policies';
    };

    const getGradientColors = () => {
        if (statusFilter === 'verified') return ['#064e3b', '#065f46', '#059669'] as const;
        if (statusFilter === 'pending') return ['#7c2d12', '#9a3412', '#ea580c'] as const;
        return ['#1e3a8a', '#1e40af', '#3b82f6'] as const;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={getGradientColors()}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or policy number..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={filter}
                    onChangeText={setFilter}
                />
            </LinearGradient>

            {statusFilter === 'pending' && (
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'action_needed' && styles.activeTab]}
                        onPress={() => setActiveTab('action_needed')}
                    >
                        <Text style={[styles.tabText, activeTab === 'action_needed' && styles.activeTabText]}>
                            Action Needed ({actionNeededCount})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'awaiting' && styles.activeTab]}
                        onPress={() => setActiveTab('awaiting')}
                    >
                        <Text style={[styles.tabText, activeTab === 'awaiting' && styles.activeTabText]}>
                            Awaiting Upload ({awaitingCount})
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1e3a8a" />
                </View>
            ) : (
                <FlatList
                    data={filteredPolicies}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No policies found</Text>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/admin/add-policy')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Policy Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Policy Details</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedPolicy && (
                            <ScrollView style={styles.modalScroll}>
                                <View style={styles.detailsCard}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Policy Number</Text>
                                        <Text style={styles.detailValue}>{selectedPolicy.policyNumber}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Name of Assured</Text>
                                        <Text style={styles.detailValue}>{selectedPolicy.customerName}</Text>
                                    </View>

                                    <View style={styles.detailRowDouble}>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>Total Premium</Text>
                                            <Text style={styles.detailAmount}>₹{selectedPolicy.amount}</Text>
                                        </View>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>Mode</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.mod || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailRowDouble}>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>D.o.C</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.dateOfCommencement || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>Due Date</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.dueDate}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailRowDouble}>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>FUP Date</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.fup || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>Status</Text>
                                            <View style={[styles.statusBadge, selectedPolicy.status === 'verified' ? styles.statusVerified : styles.statusPending]}>
                                                <Text style={[styles.statusText, selectedPolicy.status === 'verified' ? styles.statusTextVerified : styles.statusTextPending]}>
                                                    {selectedPolicy.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Commission (Admin Only) */}
                                    {selectedPolicy.commission !== undefined && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Estimated Commission</Text>
                                            <Text style={[styles.detailValue, { color: '#2563eb' }]}>₹{selectedPolicy.commission}</Text>
                                        </View>
                                    )}
                                </View>

                                {selectedPolicy.receiptUrl ? (
                                    <View style={styles.receiptSection}>
                                        <Text style={styles.receiptLabel}>Uploaded Receipt:</Text>
                                        <Image source={{ uri: selectedPolicy.receiptUrl }} style={styles.receiptImage} resizeMode="contain" />
                                    </View>
                                ) : (
                                    <View style={styles.noReceiptSection}>
                                        <Text style={styles.noReceiptText}>No receipt uploaded yet</Text>
                                    </View>
                                )}

                                {selectedPolicy.status === 'pending' && selectedPolicy.receiptUrl && (
                                    <TouchableOpacity
                                        style={styles.verifyButton}
                                        onPress={() => verifyPolicy(selectedPolicy.id)}
                                    >
                                        <Text style={styles.verifyButtonText}>Verify Receipt Manually</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
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
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
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
        letterSpacing: 0.5,
    },
    searchInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: '#ffffff',
        padding: 12,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    // Tabs
    tabContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeTab: {
        backgroundColor: '#ea580c', // Orange for pending context
        borderColor: '#ea580c',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    activeTabText: {
        color: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    policyCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    policyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    policyName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    policyNumber: {
        color: '#6b7280',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    statusVerified: {
        backgroundColor: '#dcfce7',
    },
    statusPending: {
        backgroundColor: '#ffedd5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statusTextVerified: {
        color: '#15803d',
    },
    statusTextPending: {
        color: '#c2410c',
    },
    policyDetails: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    policyAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    policyDue: {
        color: '#6b7280',
        fontSize: 14,
    },
    actionRequiredBadge: {
        marginTop: 12,
        backgroundColor: '#fee2e2',
        padding: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    actionRequiredText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: '700',
    },
    viewDetailsText: {
        marginTop: 12,
        color: '#2563eb',
        fontWeight: '500',
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 40,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        backgroundColor: '#1e3a8a',
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '700',
        paddingBottom: 4,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1f2937',
    },
    closeButton: {
        padding: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
    },
    closeText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '600',
    },
    modalScroll: {
        flex: 1,
    },
    detailsCard: {
        backgroundColor: '#f9fafb',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
    },
    detailRow: {
        marginBottom: 16,
    },
    detailRowDouble: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    detailHalf: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    detailAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    receiptSection: {
        marginBottom: 24,
    },
    receiptLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 12,
    },
    receiptImage: {
        width: '100%',
        height: 400,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
    },
    noReceiptSection: {
        padding: 32,
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        marginBottom: 24,
    },
    noReceiptText: {
        color: '#9ca3af',
        fontSize: 16,
    },
    verifyButton: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 32,
    },
    verifyButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});
