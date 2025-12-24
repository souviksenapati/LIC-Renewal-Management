import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Policy } from '../types';
import { LinearGradient } from 'expo-linear-gradient';

interface PolicySectionCardProps {
    title: string;
    count: number;
    policies: Policy[];
    color: readonly [string, string, string];
    icon: string;
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onFilterPress: () => void;
    onPolicyPress: (policy: Policy) => void;
    activeFilterCount?: number;
}

export default function PolicySectionCard({
    title,
    count,
    policies,
    color,
    icon,
    searchQuery,
    onSearchChange,
    onFilterPress,
    onPolicyPress,
    activeFilterCount = 0,
}: PolicySectionCardProps) {
    const renderPolicy = ({ item }: { item: Policy }) => (
        <TouchableOpacity
            style={styles.policyItem}
            onPress={() => onPolicyPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.policyContent}>
                <View style={styles.policyLeft}>
                    <Text style={styles.policyIcon}>{icon}</Text>
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

    return (
        <View style={styles.container}>
            {/* Card Header with Gradient */}
            <LinearGradient
                colors={color}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{count}</Text>
                    </View>
                </View>

                {/* Integrated Search Bar */}
                <View style={styles.searchContainer}>
                    {/* Hamburger Menu */}
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={onFilterPress}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.hamburgerIcon}>☰</Text>
                        {activeFilterCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Search Input */}
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search in ${title.toLowerCase()}...`}
                        placeholderTextColor="rgba(255, 255, 255, 0.6)"
                        value={searchQuery}
                        onChangeText={onSearchChange}
                    />

                    {/* Search Icon */}
                    <View style={styles.searchIconContainer}>
                        <Text style={styles.searchIcon}>🔍</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Policy List */}
            <View style={styles.listContainer}>
                {policies.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No policies found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={policies}
                        renderItem={renderPolicy}
                        keyExtractor={item => item.id}
                        scrollEnabled={false}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        overflow: 'hidden',
    },
    header: {
        padding: 16,
        paddingBottom: 20,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    countBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        minWidth: 40,
        alignItems: 'center',
    },
    countText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    hamburgerButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginRight: 8,
        position: 'relative',
    },
    hamburgerIcon: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '600',
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
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    searchIconContainer: {
        padding: 8,
        marginLeft: 4,
    },
    searchIcon: {
        fontSize: 18,
    },
    listContainer: {
        minHeight: 100,
    },
    listContent: {
        paddingVertical: 8,
    },
    policyItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    policyContent: {
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
        marginBottom: 2,
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
        paddingVertical: 40,
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
});
