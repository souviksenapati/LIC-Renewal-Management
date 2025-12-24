import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

export interface SectionFilterState {
    searchQuery: string;
    dateFrom: string | null;
    dateTo: string | null;
    amountMin: number;
    amountMax: number;
    sortBy: 'newest' | 'oldest' | 'amount_high' | 'amount_low';
}

interface PolicyFilterPanelProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: SectionFilterState) => void;
    initialFilters: SectionFilterState;
    sectionTitle: string;
}

export default function PolicyFilterPanel({
    visible,
    onClose,
    onApply,
    initialFilters,
    sectionTitle,
}: PolicyFilterPanelProps) {
    const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || '');
    const [dateTo, setDateTo] = useState(initialFilters.dateTo || '');
    const [amountMax, setAmountMax] = useState(initialFilters.amountMax);
    const [sortBy, setSortBy] = useState(initialFilters.sortBy);

    const handleApply = () => {
        onApply({
            ...initialFilters,
            dateFrom: dateFrom.trim() || null,
            dateTo: dateTo.trim() || null,
            amountMin: 0,
            amountMax,
            sortBy,
        });
        onClose();
    };

    const handleClear = () => {
        setDateFrom('');
        setDateTo('');
        setAmountMax(100000);
        setSortBy('newest');
        onApply({
            searchQuery: initialFilters.searchQuery,
            dateFrom: null,
            dateTo: null,
            amountMin: 0,
            amountMax: 100000,
            sortBy: 'newest',
        });
        onClose();
    };

    const sortOptions = [
        { key: 'newest', label: 'Due Date (Latest)', icon: '📅' },
        { key: 'oldest', label: 'Due Date (Earliest)', icon: '⏰' },
        { key: 'amount_high', label: 'Amount (High)', icon: '📈' },
        { key: 'amount_low', label: 'Amount (Low)', icon: '📉' },
    ] as const;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.panel}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.headerIcon}>🔧</Text>
                            <Text style={styles.title}>Filters</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>for {sectionTitle}</Text>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Date Range Filter */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📅 Due Date Range</Text>
                            <View style={styles.dateRow}>
                                <View style={styles.dateInputContainer}>
                                    <Text style={styles.dateLabel}>From</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        placeholder="DD/MM/YYYY"
                                        placeholderTextColor="#9ca3af"
                                        value={dateFrom}
                                        onChangeText={setDateFrom}
                                        maxLength={10}
                                    />
                                </View>
                                <View style={styles.dateInputContainer}>
                                    <Text style={styles.dateLabel}>To</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        placeholder="DD/MM/YYYY"
                                        placeholderTextColor="#9ca3af"
                                        value={dateTo}
                                        onChangeText={setDateTo}
                                        maxLength={10}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Amount Range Filter */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>💰 Premium Amount</Text>
                            <View style={styles.amountDisplay}>
                                <Text style={styles.amountLabel}>Up to:</Text>
                                <Text style={styles.amountValue}>₹{amountMax.toLocaleString()}</Text>
                            </View>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={100000}
                                step={1000}
                                value={amountMax}
                                onValueChange={setAmountMax}
                                minimumTrackTintColor="#10b981"
                                maximumTrackTintColor="#e5e7eb"
                                thumbTintColor="#059669"
                            />
                            <View style={styles.sliderLabels}>
                                <Text style={styles.sliderLabel}>₹0</Text>
                                <Text style={styles.sliderLabel}>₹1,00,000</Text>
                            </View>
                        </View>

                        {/* Sort Options */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔄 Sort By</Text>
                            <View style={styles.sortGrid}>
                                {sortOptions.map(option => (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={[
                                            styles.sortOption,
                                            sortBy === option.key && styles.sortOptionActive
                                        ]}
                                        onPress={() => setSortBy(option.key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.sortIcon,
                                            sortBy === option.key && styles.sortIconActive
                                        ]}>
                                            {option.icon}
                                        </Text>
                                        <Text style={[
                                            styles.sortLabel,
                                            sortBy === option.key && styles.sortLabelActive
                                        ]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                            <Text style={styles.clearText}>Clear All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                            <Text style={styles.applyText}>Apply Filters 🔍</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    panel: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        fontSize: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        paddingHorizontal: 24,
        paddingBottom: 16,
        fontWeight: '500',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: {
        fontSize: 20,
        color: '#6b7280',
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 12,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateInputContainer: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 6,
        fontWeight: '600',
    },
    dateInput: {
        borderWidth: 1.5,
        borderColor: '#d1d5db',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
        backgroundColor: '#f9fafb',
    },
    amountDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    amountLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
    amountValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#059669',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    sliderLabel: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '500',
    },
    sortGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    sortOption: {
        width: '48%',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    sortOptionActive: {
        borderColor: '#059669',
        backgroundColor: '#f0fdf4',
    },
    sortIcon: {
        fontSize: 28,
        marginBottom: 8,
        opacity: 0.6,
    },
    sortIconActive: {
        opacity: 1,
    },
    sortLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
        textAlign: 'center',
    },
    sortLabelActive: {
        color: '#059669',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    clearButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    clearText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6b7280',
    },
    applyButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#059669',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    applyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
});
