import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateInput } from '../../utils/errorParser';
import DateInput from '../../components/DateInput';

export default function AddPolicy() {
    const [policyNumber, setPolicyNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleAdd = async () => {
        // Validate all fields
        if (!policyNumber || !customerName || !amount || !dueDate) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        // Validate amount is a valid number
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount greater than 0');
            return;
        }

        // Validate date format DD/MM/YYYY
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dueDate)) {
            Alert.alert('Error', 'Please enter date in DD/MM/YYYY format');
            return;
        }

        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'policies'), {
                policyNumber: policyNumber.trim(),
                customerName: customerName.trim(),
                amount: numAmount,
                dueDate,
                status: 'pending',
                createdAt: Date.now()
            });

            // Add id field for consistency with type definition
            await updateDoc(docRef, { id: docRef.id });

            Alert.alert('Success', 'Policy added successfully');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to add policy');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#3b82f6'] as const}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Policy</Text>
            </LinearGradient>

            <ScrollView style={styles.scrollView}>
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Policy Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. P123456"
                            value={policyNumber}
                            onChangeText={setPolicyNumber}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Customer Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. John Doe"
                            value={customerName}
                            onChangeText={setCustomerName}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Amount (₹)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 5000"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                        />
                    </View>

                    <DateInput
                        label="Due Date"
                        value={dueDate}
                        onChangeText={setDueDate}
                        placeholder="DD/MM/YYYY or DDMMYYYY"
                        required
                    />

                    <TouchableOpacity
                        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                        onPress={handleAdd}
                        disabled={loading}
                    >
                        <Text style={styles.saveButtonText}>Save Policy</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        letterSpacing: 0.5,
    },
    scrollView: {
        padding: 24,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: '#374151',
        marginBottom: 4,
        fontWeight: '500',
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 12,
        padding: 12,
        fontSize: 18,
    },
    saveButton: {
        backgroundColor: '#1e3a8a',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
});
