import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateInput } from '../utils/errorParser';

interface DateInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    required?: boolean;
}

/**
 * Reusable date input component with calendar picker
 * Supports both manual entry (with auto-formatting) and calendar selection
 */
export default function DateInput({ label, value, onChangeText, placeholder = "DD/MM/YYYY or DDMMYYYY", required = false }: DateInputProps) {
    const [showPicker, setShowPicker] = useState(false);

    // Parse DD/MM/YYYY to Date object for picker
    const parseDate = (dateString: string): Date => {
        if (!dateString || dateString.length !== 10) {
            return new Date();
        }
        const [day, month, year] = dateString.split('/').map(Number);
        if (!day || !month || !year) {
            return new Date();
        }
        return new Date(year, month - 1, day);
    };

    // Format Date object to DD/MM/YYYY
    const formatDate = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        // On Android, picker closes automatically on selection
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (selectedDate) {
            const formatted = formatDate(selectedDate);
            onChangeText(formatted);
        }
    };

    const handleCalendarPress = () => {
        setShowPicker(true);
    };

    const handleClosePicker = () => {
        setShowPicker(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    value={value}
                    onChangeText={(text) => onChangeText(formatDateInput(text))}
                    keyboardType="number-pad"
                    maxLength={10}
                />

                {/* Calendar Icon Button */}
                <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={handleCalendarPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
            </View>

            {/* Date Picker */}
            {showPicker && (
                <>
                    {Platform.OS === 'ios' && (
                        <View style={styles.iosPickerContainer}>
                            <View style={styles.iosPickerHeader}>
                                <TouchableOpacity onPress={handleClosePicker}>
                                    <Text style={styles.iosPickerButton}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={parseDate(value)}
                                mode="date"
                                display="spinner"
                                onChange={handleDateChange}
                                style={styles.picker}
                            />
                        </View>
                    )}

                    {Platform.OS === 'android' && (
                        <DateTimePicker
                            value={parseDate(value)}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                        />
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
        fontWeight: '600',
    },
    required: {
        color: '#ef4444',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 12,
        padding: 14,
        paddingRight: 50, // Make room for calendar icon
        fontSize: 16,
        backgroundColor: '#ffffff',
    },
    calendarButton: {
        position: 'absolute',
        right: 12,
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarIcon: {
        fontSize: 20,
    },
    picker: {
        backgroundColor: '#ffffff',
    },
    // iOS-specific styles
    iosPickerContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#d1d5db',
        overflow: 'hidden',
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
    },
    iosPickerButton: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '600',
    },
});
