import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Policy } from '../../types';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

export default function AdminPolicies() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const router = useRouter();

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

    const filteredPolicies = policies.filter(p =>
        p.policyNumber.toLowerCase().includes(filter.toLowerCase()) ||
        p.customerName.toLowerCase().includes(filter.toLowerCase())
    );

    const verifyPolicy = async (id: string) => {
        try {
            await updateDoc(doc(db, 'policies', id), {
                status: 'verified',
                verifiedAt: Date.now()
            });
        } catch (error) {
            console.error("Error verifying policy:", error);
        }
    };

    const renderItem = ({ item }: { item: Policy }) => (
        <View style={styles.policyCard}>
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

            {item.receiptUrl && (
                <View style={styles.receiptContainer}>
                    <Text style={styles.receiptLabel}>Receipt:</Text>
                    <Image source={{ uri: item.receiptUrl }} style={styles.receiptImage} resizeMode="cover" />
                </View>
            )}

            {item.status === 'pending' && item.receiptUrl && (
                <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={() => verifyPolicy(item.id)}
                >
                    <Text style={styles.verifyButtonText}>Verify Receipt</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#3b82f6'] as const}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>All Policies</Text>
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or policy number..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={filter}
                    onChangeText={setFilter}
                />
            </LinearGradient>

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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
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
    receiptContainer: {
        marginTop: 12,
    },
    receiptLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    receiptImage: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
    },
    verifyButton: {
        marginTop: 12,
        backgroundColor: '#2563eb',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyButtonText: {
        color: '#ffffff',
        fontWeight: '700',
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
});
