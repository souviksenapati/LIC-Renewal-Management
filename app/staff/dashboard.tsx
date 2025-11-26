import { View, Text, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { Policy } from '../../types';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

export default function StaffDashboard() {
    const { signOut, user } = useAuth();
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [pendingExpanded, setPendingExpanded] = useState(true);
    const [completedExpanded, setCompletedExpanded] = useState(false);

    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

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

    const pendingPolicies = policies.filter(p => p.status === 'pending');
    const completedPolicies = policies.filter(p => p.status === 'verified');

    const openPolicyDetails = (policy: Policy) => {
        setSelectedPolicy(policy);
        setModalVisible(true);
    };

    const pickImage = async () => {
        if (!selectedPolicy) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadReceipt(selectedPolicy.id, result.assets[0].uri);
        }
    };

    const uploadReceipt = async (policyId: string, uri: string) => {
        setUploading(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `receipts/${policyId}_${Date.now()}.jpg`;
            const storageRef = ref(storage, filename);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(doc(db, 'policies', policyId), {
                receiptUrl: downloadURL,
                uploadedBy: user?.uid,
                uploadedAt: Date.now(),
            });

            Alert.alert('Success', 'Receipt uploaded successfully!');
            setModalVisible(false);
        } catch (error) {
            console.error("Upload error:", error);
            Alert.alert('Error', 'Failed to upload receipt');
        } finally {
            setUploading(false);
        }
    };

    const renderListItem = ({ item }: { item: Policy }) => (
        <TouchableOpacity
            style={styles.listItem}
            onPress={() => openPolicyDetails(item)}
        >
            <View>
                <Text style={styles.listItemName}>{item.customerName}</Text>
                <Text style={styles.listItemPolicy}>#{item.policyNumber}</Text>
            </View>
            <Text style={styles.listItemView}>View &gt;</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
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

            <ScrollView style={styles.scrollView}>
                {/* Pending Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.sectionHeader, styles.pendingBorder]}
                        onPress={() => setPendingExpanded(!pendingExpanded)}
                    >
                        <Text style={styles.sectionTitle}>Pending Policies ({pendingPolicies.length})</Text>
                        <Text style={styles.expandIcon}>{pendingExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {pendingExpanded && (
                        <View style={styles.sectionContent}>
                            {pendingPolicies.length === 0 ? (
                                <Text style={styles.emptyText}>No pending policies</Text>
                            ) : (
                                pendingPolicies.map(policy => (
                                    <View key={policy.id}>{renderListItem({ item: policy })}</View>
                                ))
                            )}
                        </View>
                    )}
                </View>

                {/* Completed Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.sectionHeader, styles.completedBorder]}
                        onPress={() => setCompletedExpanded(!completedExpanded)}
                    >
                        <Text style={styles.sectionTitle}>Completed Policies ({completedPolicies.length})</Text>
                        <Text style={styles.expandIcon}>{completedExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {completedExpanded && (
                        <View style={styles.sectionContent}>
                            {completedPolicies.length === 0 ? (
                                <Text style={styles.emptyText}>No completed policies</Text>
                            ) : (
                                completedPolicies.map(policy => (
                                    <View key={policy.id}>{renderListItem({ item: policy })}</View>
                                ))
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

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
                                </View>

                                {selectedPolicy.receiptUrl && (
                                    <View style={styles.receiptSection}>
                                        <Text style={styles.receiptLabel}>Uploaded Receipt:</Text>
                                        <Image source={{ uri: selectedPolicy.receiptUrl }} style={styles.receiptImage} resizeMode="contain" />
                                    </View>
                                )}

                                {selectedPolicy.status === 'pending' && (
                                    <TouchableOpacity
                                        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                                        onPress={pickImage}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.uploadButtonText}>📷 Upload Receipt</Text>
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
    scrollView: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    pendingBorder: {
        borderLeftColor: '#f97316',
    },
    completedBorder: {
        borderLeftColor: '#22c55e',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    expandIcon: {
        color: '#6b7280',
    },
    sectionContent: {
        marginTop: 8,
    },
    emptyText: {
        color: '#6b7280',
        textAlign: 'center',
        padding: 16,
    },
    listItem: {
        backgroundColor: '#ffffff',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listItemName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    listItemPolicy: {
        color: '#6b7280',
        fontSize: 14,
    },
    listItemView: {
        color: '#2563eb',
        fontWeight: '500',
    },
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
