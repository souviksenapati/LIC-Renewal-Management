import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Modal, FlatList, ActivityIndicator } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Frequency, AllPolicyStatus } from '../../types';
import { formatDateInput } from '../../utils/errorParser';
import DateInput from '../../components/DateInput';

export default function AdminEditAllPolicy() {
    const [policyNumber, setPolicyNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerNumber, setCustomerNumber] = useState('');
    const [dateOfCreation, setDateOfCreation] = useState('');
    const [frequency, setFrequency] = useState<Frequency>('Monthly');
    const [instalmentAmount, setInstalmentAmount] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [address, setAddress] = useState('');
    const [nomineeName, setNomineeName] = useState('');
    const [nomineeNumber, setNomineeNumber] = useState('');
    const [policyStatus, setPolicyStatus] = useState<AllPolicyStatus>('active');
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);

    const router = useRouter();
    const params = useLocalSearchParams();
    const policyId = params.id as string;
    const { user } = useAuth();

    // Load existing policy data
    useEffect(() => {
        const loadPolicy = async () => {
            if (!policyId) {
                Alert.alert('Error', 'No policy ID provided');
                router.back();
                return;
            }

            try {
                const docRef = doc(db, 'all_policies', policyId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const policy = docSnap.data();
                    setPolicyNumber(policy.policyNumber || '');
                    setCustomerName(policy.customerName || '');
                    setCustomerNumber(policy.customerNumber || '');
                    setDateOfCreation(policy.dateOfCreation || '');
                    setFrequency(policy.frequency || 'Monthly');
                    setInstalmentAmount(policy.instalmentAmount?.toString() || '');
                    setDateOfBirth(policy.dateOfBirth || '');
                    setAddress(policy.address === 'N/A' ? '' : (policy.address || ''));
                    setNomineeName(policy.nomineeName === 'N/A' ? '' : (policy.nomineeName || ''));
                    setNomineeNumber(policy.nomineeNumber === 'N/A' ? '' : (policy.nomineeNumber || ''));
                    setPolicyStatus(policy.policyStatus || 'active');
                } else {
                    Alert.alert('Error', 'Policy not found');
                    router.back();
                }
            } catch (error) {
                console.error('Error loading policy:', error);
                Alert.alert('Error', 'Failed to load policy data');
                router.back();
            } finally {
                setFetchingData(false);
            }
        };

        loadPolicy();
    }, [policyId]);

    // Validation helpers
    const validateName = (value: string): boolean => {
        if (!value || value.length < 2 || value.length > 100) return false;
        return /^[a-zA-Z]+([ '\-.][a-zA-Z]+)*$/.test(value);
    };

    const validatePhone = (value: string): boolean => {
        return /^(0|\+91[\-\s]?|91[\-\s]?)?[6-9]\d{9}$/.test(value);
    };

    const validatePolicyNumber = (value: string): boolean => {
        return /^\d{8,9}$/.test(value);
    };

    const validateDate = (value: string): boolean => {
        if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/((19|20)\d{2})$/.test(value)) {
            return false;
        }
        const [day, month, year] = value.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) return false;
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return false; // Invalid calendar date (e.g., 31/02/2024)
        }
        return true;
    };

    const validateDateOfBirth = (value: string): boolean => {
        if (!validateDate(value)) return false;

        const [day, month, year] = value.split('/').map(Number);
        const dobTime = new Date(year, month - 1, day).getTime();
        const age = (Date.now() - dobTime) / (365.25 * 24 * 60 * 60 * 1000);

        return age >= 18 && age <= 100;
    };

    const validateAmount = (value: string): boolean => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 100 && num <= 10000000;
    };

    const validateAddress = (value: string): boolean => {
        if (!value || value.trim() === '') return true; // Optional
        if (value.length < 10 || value.length > 200) return false;
        return /^[a-zA-Z0-9\s,.\-\/]{10,200}$/.test(value);
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!policyNumber.trim()) {
            Alert.alert('Error', 'Enter policy number');
            return;
        }
        if (!validatePolicyNumber(policyNumber.trim())) {
            Alert.alert('Error', 'Policy number must be 8-9 digits');
            return;
        }

        if (!customerName.trim()) {
            Alert.alert('Error', 'Enter customer name');
            return;
        }
        if (!validateName(customerName.trim())) {
            Alert.alert('Error', 'Enter valid name (letters only, 2-100 characters)');
            return;
        }

        if (!customerNumber.trim()) {
            Alert.alert('Error', 'Enter customer phone number');
            return;
        }
        if (!validatePhone(customerNumber.trim())) {
            Alert.alert('Error', 'Enter valid 10-digit mobile number (starting with 6/7/8/9)');
            return;
        }

        if (!dateOfCreation.trim()) {
            Alert.alert('Error', 'Enter date of creation');
            return;
        }
        if (!validateDate(dateOfCreation.trim())) {
            Alert.alert('Error', 'Enter valid date in DD/MM/YYYY format');
            return;
        }

        if (!instalmentAmount.trim()) {
            Alert.alert('Error', 'Enter instalment amount');
            return;
        }
        if (!validateAmount(instalmentAmount.trim())) {
            Alert.alert('Error', 'Enter valid amount (₹100 - ₹1,00,00,000)');
            return;
        }

        if (!dateOfBirth.trim()) {
            Alert.alert('Error', 'Enter date of birth');
            return;
        }
        if (!validateDateOfBirth(dateOfBirth.trim())) {
            Alert.alert('Error', 'Enter valid date of birth (age must be 18-100 years)');
            return;
        }

        // Validate optional fields if provided
        if (address.trim() && !validateAddress(address.trim())) {
            Alert.alert('Error', 'Address must be 10-200 characters or leave empty');
            return;
        }

        if (nomineeName.trim() && !validateName(nomineeName.trim())) {
            Alert.alert('Error', 'Enter valid nominee name or leave empty');
            return;
        }

        if (nomineeNumber.trim() && !validatePhone(nomineeNumber.trim())) {
            Alert.alert('Error', 'Enter valid nominee phone number or leave empty');
            return;
        }

        setLoading(true);
        try {
            const docRef = doc(db, 'all_policies', policyId);
            await updateDoc(docRef, {
                policyNumber: policyNumber.trim(),
                customerName: customerName.trim(),
                customerNumber: customerNumber.trim(),
                dateOfCreation: dateOfCreation.trim(),
                frequency,
                instalmentAmount: parseFloat(instalmentAmount),
                dateOfBirth: dateOfBirth.trim(),
                address: address.trim() || 'N/A',
                nomineeName: nomineeName.trim() || 'N/A',
                nomineeNumber: nomineeNumber.trim() || 'N/A',
                policyStatus,
                updatedBy: user?.uid || '',
                updatedAt: Date.now(),
            });

            Alert.alert('Success', 'Policy updated successfully');
            router.back();
        } catch (error) {
            console.error('Error updating policy:', error);
            Alert.alert('Error', 'Failed to update policy');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#3b82f6']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Policy</Text>
                </View>
            </LinearGradient>

            {fetchingData ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1e3a8a" />
                    <Text style={styles.loadingText}>Loading policy data...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
                    <View style={styles.form}>
                        {/* Policy Number */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Policy Number *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="8-9 digits (e.g., 123456789)"
                                value={policyNumber}
                                onChangeText={setPolicyNumber}
                                keyboardType="numeric"
                                maxLength={9}
                            />
                        </View>

                        {/* Customer Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Customer Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Amit Kumar"
                                value={customerName}
                                onChangeText={setCustomerName}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Customer Phone */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Customer Phone Number *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="10 digits (e.g., 9876543210)"
                                value={customerNumber}
                                onChangeText={setCustomerNumber}
                                keyboardType="phone-pad"
                                maxLength={13}
                            />
                        </View>

                        {/* Date of Creation */}
                        <DateInput
                            label="Date of Creation"
                            value={dateOfCreation}
                            onChangeText={setDateOfCreation}
                            placeholder="DD/MM/YYYY or DDMMYYYY"
                            required
                        />

                        {/* Frequency */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Payment Frequency *</Text>
                            <View style={styles.buttonGroup}>
                                {(['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] as Frequency[]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq}
                                        style={[styles.optionButton, frequency === freq && styles.optionButtonSelected]}
                                        onPress={() => setFrequency(freq)}
                                    >
                                        <Text style={[styles.optionButtonText, frequency === freq && styles.optionButtonTextSelected]}>{freq}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Instalment Amount */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Instalment Amount (₹) *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 5000"
                                value={instalmentAmount}
                                onChangeText={setInstalmentAmount}
                                keyboardType="decimal-pad"
                            />
                        </View>

                        {/* Date of Birth */}
                        <DateInput
                            label="Date of Birth"
                            value={dateOfBirth}
                            onChangeText={setDateOfBirth}
                            placeholder="DD/MM/YYYY or DDMMYYYY"
                            required
                        />

                        {/* Address */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Address (Optional)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Full address (leave empty if not available)"
                                value={address}
                                onChangeText={setAddress}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Nominee Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nominee Name (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Leave empty if not available"
                                value={nomineeName}
                                onChangeText={setNomineeName}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Nominee Phone */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nominee Phone (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="10 digits (leave empty if not available)"
                                value={nomineeNumber}
                                onChangeText={setNomineeNumber}
                                keyboardType="phone-pad"
                                maxLength={13}
                            />
                        </View>

                        {/* Policy Status */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Policy Status *</Text>
                            <View style={styles.buttonGroup}>
                                {(['active', 'lapsed', 'matured', 'surrendered'] as AllPolicyStatus[]).map((status) => (
                                    <TouchableOpacity
                                        key={status}
                                        style={[styles.optionButton, policyStatus === status && styles.optionButtonSelected]}
                                        onPress={() => setPolicyStatus(status)}
                                    >
                                        <Text style={[styles.optionButtonText, policyStatus === status && styles.optionButtonTextSelected]}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Updating...' : 'Update Policy'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
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
    headerContent: {
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
    scrollView: {
        flex: 1,
    },
    form: {
        padding: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#ffffff',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    buttonGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#ffffff',
    },
    optionButtonSelected: {
        backgroundColor: '#1e3a8a',
        borderColor: '#1e3a8a',
    },
    optionButtonText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    optionButtonTextSelected: {
        color: '#ffffff',
        fontWeight: '700',
    },
    submitButton: {
        backgroundColor: '#1e3a8a',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
});
