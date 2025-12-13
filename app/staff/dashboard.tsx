import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView, Image, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Policy } from '../../types';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import ReceiptVerificationProgress from '../../components/ReceiptVerificationProgress';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { parseError } from '../../utils/errorParser';
import PolicyFilterPanel, { SectionFilterState } from '../../components/PolicyFilterPanel';

export default function StaffDashboard() {
    const { signOut, user } = useAuth();
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [verificationInProgress, setVerificationInProgress] = useState(false);
    const [uploadId, setUploadId] = useState('');

    const [failedPolicies, setFailedPolicies] = useState<Record<string, string>>({});
    const [successMessage, setSuccessMessage] = useState('');
    const { isOnline } = useNetworkStatus();

    // NEW: Global search and status filter
    const [globalSearch, setGlobalSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('pending');

    // NEW: Separate filters for each section
    const [pendingFilters, setPendingFilters] = useState<SectionFilterState>({
        searchQuery: '',
        dateFrom: null,
        dateTo: null,
        amountMin: 0,
        amountMax: 100000,
        sortBy: 'newest',
    });

    const [completedFilters, setCompletedFilters] = useState<SectionFilterState>({
        searchQuery: '',
        dateFrom: null,
        dateTo: null,
        amountMin: 0,
        amountMax: 100000,
        sortBy: 'newest',
    });

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);

    const [activeFilterSection, setActiveFilterSection] = useState<'pending' | 'completed' | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'policies'));
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

    // Sync selectedPolicy with real-time updates
    useEffect(() => {
        if (selectedPolicy) {
            const updatedPolicy = policies.find(p => p.id === selectedPolicy.id);
            if (updatedPolicy) {
                setSelectedPolicy(updatedPolicy);
            }
        }
    }, [policies]);

    // Helper function to parse DD/MM/YYYY with proper error handling
    const parseDMY = (dateStr: string): number => {
        if (!dateStr || typeof dateStr !== 'string') return -1;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return -1;
        const [day, month, year] = parts.map(Number);
        if (!day || !month || !year) return -1;
        if (day > 31 || month > 12 || year < 1900) return -1;
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) return -1;
        return date.getTime();
    };

    // Filter and sort policies
    const getFilteredPolicies = (status: 'pending' | 'verified', filters: SectionFilterState) => {
        let filtered = policies.filter(p => p.status === status);

        // Apply global search with null safety
        if (globalSearch.trim()) {
            const query = globalSearch.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.policyNumber?.toLowerCase().includes(query) || false) ||
                (p.customerName?.toLowerCase().includes(query) || false)
            );
        }

        // Apply section-specific search with null safety
        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.policyNumber?.toLowerCase().includes(query) || false) ||
                (p.customerName?.toLowerCase().includes(query) || false)
            );
        }

        // Filter by date range
        if (filters.dateFrom) {
            const fromDate = parseDMY(filters.dateFrom);
            if (fromDate > 0) {
                filtered = filtered.filter(p => {
                    const policyDate = parseDMY(p.dueDate);
                    return policyDate > 0 && policyDate >= fromDate;
                });
            }
        }
        if (filters.dateTo) {
            const toDate = parseDMY(filters.dateTo);
            if (toDate > 0) {
                filtered = filtered.filter(p => {
                    const policyDate = parseDMY(p.dueDate);
                    return policyDate > 0 && policyDate <= toDate;
                });
            }
        }

        // Filter by amount range with null safety
        filtered = filtered.filter(p => {
            const amount = p.amount ?? 0;
            return amount >= filters.amountMin && amount <= filters.amountMax;
        });

        // Sort with null safety
        switch (filters.sortBy) {
            case 'oldest':
                filtered.sort((a, b) => parseDMY(a.dueDate) - parseDMY(b.dueDate));
                break;
            case 'amount_high':
                filtered.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
                break;
            case 'amount_low':
                filtered.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => parseDMY(b.dueDate) - parseDMY(a.dueDate));
        }

        return filtered;
    };

    const pendingPolicies = useMemo(() => getFilteredPolicies('pending', pendingFilters), [policies, globalSearch, pendingFilters]);
    const completedPolicies = useMemo(() => getFilteredPolicies('verified', completedFilters), [policies, globalSearch, completedFilters]);

    // Get policies to display based on status filter
    const getDisplayPolicies = () => {
        if (statusFilter === 'pending') return pendingPolicies;
        if (statusFilter === 'verified') return completedPolicies;
        // Show all = pending + completed
        return [...pendingPolicies, ...completedPolicies];
    };

    // Count active filters
    const getActiveFilterCount = (filters: SectionFilterState) => {
        let count = 0;
        if (filters.dateFrom || filters.dateTo) count++;
        if (filters.amountMax < 100000) count++;
        if (filters.sortBy !== 'newest') count++;
        return count;
    };

    // Pull-to-refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // onSnapshot listener auto-updates, just provide user feedback
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    // Render policy item in FlatList
    const renderPolicyItem = ({ item }: { item: Policy }) => (
        <TouchableOpacity
            style={styles.policyItem}
            onPress={() => openPolicyDetails(item)}
            activeOpacity={0.7}
        >
            <View style={styles.policyRow}>
                <View style={styles.policyLeft}>
                    <Text style={styles.policyIcon}>
                        {item.status === 'verified' ? '✅' : '📄'}
                    </Text>
                    <View style={styles.policyInfo}>
                        <Text style={styles.policyName} numberOfLines={1}>
                            {item.customerName}
                        </Text>
                        <Text style={styles.policyNumber}>#{item.policyNumber}</Text>
                    </View>
                </View>
                <View style={styles.policyRight}>
                    <Text style={styles.policyAmount}>₹{item.amount.toLocaleString()}</Text>
                    <Text style={styles.viewArrow}>›</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const openPolicyDetails = (policy: Policy) => {
        setSelectedPolicy(policy);
        setModalVisible(true);
        setVerificationInProgress(false);
        setSuccessMessage('');
        setUploadId('');
    };

    const pickImage = async () => {
        if (!selectedPolicy) return;

        if (!isOnline) {
            Alert.alert('No connection', 'Connect to upload receipts');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,  // Disabled to capture full portrait receipts
            quality: 0.7,  // Increased quality for receipt clarity
        });

        if (!result.canceled) {
            uploadReceipt(selectedPolicy.id, result.assets[0].uri);
        }
    };

    const uploadReceipt = async (policyId: string, uri: string) => {
        setUploading(true);
        setSuccessMessage('');

        setFailedPolicies(prev => {
            const newErrors = { ...prev };
            delete newErrors[policyId];
            return newErrors;
        });

        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const filename = `receipts/${policyId}.jpg`;
            const storageRef = ref(storage, filename);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(doc(db, 'policies', policyId), {
                receiptUrl: downloadURL,
                uploadedBy: user?.uid,
                uploadedAt: Date.now(),
            });

            setUploadId(policyId);
            setVerificationInProgress(true);
            setUploading(false);
        } catch (error) {
            console.error("Upload error:", error);
            const userError = parseError(error, 'upload');
            Alert.alert(userError.title, userError.message);
            setUploading(false);
        }
    };

    const handleVerificationComplete = (success: boolean, message?: string) => {
        setVerificationInProgress(false);

        if (!selectedPolicy) return;

        if (success) {
            setSelectedPolicy(prev => prev ? { ...prev, status: 'verified' } : null);
            setFailedPolicies(prev => {
                const newErrors = { ...prev };
                delete newErrors[selectedPolicy.id];
                return newErrors;
            });
            setSuccessMessage('✅ Receipt verified successfully!');
            setTimeout(() => setSuccessMessage(''), 2000);
        } else {
            setFailedPolicies(prev => ({
                ...prev,
                [selectedPolicy.id]: message || 'Verification failed'
            }));
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Loading policies...</Text>
            </View>
        );
    }

    const showPendingCard = statusFilter === 'all' || statusFilter === 'pending';
    const showCompletedCard = statusFilter === 'all' || statusFilter === 'verified';

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <LinearGradient
                colors={['#064e3b', '#065f46', '#059669'] as const}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Staff Portal</Text>
                    <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.headerSubtitle}>Agent: {user?.email}</Text>
            </LinearGradient>

            {/* Global Search & Status Filter */}
            <View style={styles.globalSearchContainer}>
                {/* Enhanced Search Bar with Hamburger */}
                <View style={styles.searchWrapper}>
                    {/* Hamburger Menu (Left) */}
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={() => setActiveFilterSection(statusFilter === 'pending' || statusFilter === 'all' ? 'pending' : 'completed')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.hamburgerIcon}>☰</Text>
                        {(getActiveFilterCount(pendingFilters) > 0 || getActiveFilterCount(completedFilters) > 0) && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>
                                    {getActiveFilterCount(pendingFilters) + getActiveFilterCount(completedFilters)}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Search Input (Center) */}
                    <TextInput
                        style={styles.globalSearchInput}
                        placeholder="Search all policies..."
                        placeholderTextColor="#9ca3af"
                        value={globalSearch}
                        onChangeText={setGlobalSearch}
                    />

                    {/* Search Icon (Right) */}
                    <Text style={styles.searchIconRight}>🔍</Text>
                </View>

                {/* Status Tabs */}
                <View style={styles.statusTabs}>
                    <TouchableOpacity
                        style={[styles.statusTab, statusFilter === 'pending' && styles.statusTabActive]}
                        onPress={() => setStatusFilter('pending')}
                    >
                        <View style={[styles.statusDot, statusFilter === 'pending' && styles.statusDotActive]} />
                        <Text style={[styles.statusTabText, statusFilter === 'pending' && styles.statusTabTextActive]}>
                            Pending ({pendingPolicies.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statusTab, statusFilter === 'verified' && styles.statusTabActive]}
                        onPress={() => setStatusFilter('verified')}
                    >
                        <View style={[styles.statusDot, statusFilter === 'verified' && styles.statusDotActive]} />
                        <Text style={[styles.statusTabText, statusFilter === 'verified' && styles.statusTabTextActive]}>
                            Verified ({completedPolicies.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statusTab, statusFilter === 'all' && styles.statusTabActive]}
                        onPress={() => setStatusFilter('all')}
                    >
                        <View style={[styles.statusDot, statusFilter === 'all' && styles.statusDotActive]} />
                        <Text style={[styles.statusTabText, statusFilter === 'all' && styles.statusTabTextActive]}>
                            All ({pendingPolicies.length + completedPolicies.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Policy List - Direct FlatList */}
            <FlatList
                data={getDisplayPolicies()}
                renderItem={renderPolicyItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.policyList}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#059669']}
                        tintColor="#059669"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No policies found</Text>
                    </View>
                }
            />

            {/* Filter Panel */}
            {activeFilterSection === 'pending' && (
                <PolicyFilterPanel
                    visible={true}
                    onClose={() => setActiveFilterSection(null)}
                    onApply={setPendingFilters}
                    initialFilters={pendingFilters}
                    sectionTitle="Pending Policies"
                />
            )}

            {activeFilterSection === 'completed' && (
                <PolicyFilterPanel
                    visible={true}
                    onClose={() => setActiveFilterSection(null)}
                    onApply={setCompletedFilters}
                    initialFilters={completedFilters}
                    sectionTitle="Completed Policies"
                />
            )}

            {/* Policy Detail Modal (Keep existing modal code) */}
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
                                            <Text style={styles.detailLabel}>Due Date</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.dueDate}</Text>
                                        </View>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>FUP Date</Text>
                                            <Text style={styles.detailValue}>{selectedPolicy.fup || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailRowDouble}>
                                        <View style={styles.detailHalf}>
                                            <Text style={styles.detailLabel}>Status</Text>
                                            <View style={[styles.statusBadge, selectedPolicy.status === 'verified' ? styles.statusVerified : styles.statusPending]}>
                                                <Text style={[styles.statusText, selectedPolicy.status === 'verified' ? styles.statusTextVerified : styles.statusTextPending]}>
                                                    {selectedPolicy.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.detailHalf} />
                                    </View>
                                </View>

                                {selectedPolicy.receiptUrl && !verificationInProgress && (
                                    <View style={styles.receiptSection}>
                                        <Text style={styles.receiptLabel}>Uploaded Receipt:</Text>
                                        <Image source={{ uri: selectedPolicy.receiptUrl }} style={styles.receiptImage} resizeMode="contain" />
                                    </View>
                                )}

                                {verificationInProgress && (
                                    <ReceiptVerificationProgress
                                        uploadId={uploadId}
                                        onComplete={handleVerificationComplete}
                                    />
                                )}

                                {(failedPolicies[selectedPolicy.id] || successMessage) && !verificationInProgress && (
                                    <View style={[
                                        styles.messageBanner,
                                        successMessage ? styles.successBanner : styles.failureBanner
                                    ]}>
                                        <Text style={[
                                            styles.messageText,
                                            successMessage ? styles.successText : styles.failureText
                                        ]}>
                                            {successMessage || failedPolicies[selectedPolicy.id]}
                                        </Text>
                                    </View>
                                )}

                                {selectedPolicy.status === 'pending' && !verificationInProgress && (
                                    <TouchableOpacity
                                        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                                        onPress={pickImage}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.uploadButtonText}>
                                                {failedPolicies[selectedPolicy.id] ? '📷 Retry Upload' : '📷 Upload Receipt'}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                )}

                                {selectedPolicy.status === 'verified' && (
                                    <View style={styles.verifiedBanner}>
                                        <Text style={styles.verifiedText}>✓ Payment Verified</Text>
                                    </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
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
        marginBottom: 16,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    logoutButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    logoutText: {
        color: '#ffffff',
        fontWeight: '500',
        fontSize: 12,
    },
    headerSubtitle: {
        color: '#a7f3d0',
        fontWeight: '500',
    },
    globalSearchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        paddingHorizontal: 4,
        paddingVertical: 4,
        marginBottom: 12,
    },
    hamburgerButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
        position: 'relative',
    },
    hamburgerIcon: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
    },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    filterBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    globalSearchInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 4,
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
    },
    searchIconRight: {
        fontSize: 18,
        marginLeft: 8,
        paddingHorizontal: 8,
    },
    statusTabs: {
        flexDirection: 'row',
        gap: 8,
    },
    statusTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        gap: 6,
    },
    statusTabActive: {
        backgroundColor: '#dcfce7',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#9ca3af',
    },
    statusDotActive: {
        backgroundColor: '#059669',
    },
    statusTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    statusTabTextActive: {
        color: '#059669',
    },
    cardsContainer: {
        flex: 1,
    },
    policyList: {
        paddingBottom: 100,
    },
    policyItem: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    policyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    policyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
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
        color: '#111827',
        marginBottom: 4,
    },
    policyNumber: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    policyRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    policyAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669',
    },
    viewArrow: {
        fontSize: 24,
        color: '#9ca3af',
        fontWeight: '300',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 15,
        color: '#9ca3af',
        fontWeight: '500',
    },
    // Modal styles (keep existing)
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '80%',
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
    },
    closeText: {
        color: '#6b7280',
        fontSize: 18,
    },
    modalScroll: {
        flex: 1,
    },
    detailsCard: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    detailRow: {
        marginBottom: 16,
    },
    detailLabel: {
        color: '#6b7280',
        fontSize: 14,
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    detailAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e3a8a',
    },
    detailRowDouble: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    detailHalf: {
        width: '48%',
    },
    statusBadge: {
        alignSelf: 'flex-start',
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
        fontWeight: '700',
    },
    statusTextVerified: {
        color: '#15803d',
    },
    statusTextPending: {
        color: '#c2410c',
    },
    receiptSection: {
        marginBottom: 24,
    },
    receiptLabel: {
        color: '#1f2937',
        fontWeight: '700',
        marginBottom: 8,
    },
    receiptImage: {
        width: '100%',
        height: 192,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
    },
    uploadButton: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 32,
    },
    uploadButtonDisabled: {
        opacity: 0.7,
    },
    uploadButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginRight: 8,
    },
    messageBanner: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
    },
    successBanner: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    failureBanner: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    messageText: {
        fontWeight: '600',
    },
    successText: {
        color: '#166534',
    },
    failureText: {
        color: '#991b1b',
    },
    verifiedBanner: {
        backgroundColor: '#f0fdf4',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    verifiedText: {
        color: '#166534',
        fontWeight: '700',
    },
});
