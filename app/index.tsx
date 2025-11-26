import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
    const [activeTab, setActiveTab] = useState<'staff' | 'admin'>('staff');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setLoading(true);
        try {
            await signIn(email, password, activeTab);
            if (activeTab === 'admin') {
                router.replace('/admin/dashboard');
            } else {
                router.replace('/staff/dashboard');
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isStaff = activeTab === 'staff';
    const gradientColors = isStaff
        ? ['#064e3b', '#065f46', '#059669'] as const
        : ['#1e3a8a', '#1e40af', '#3b82f6'] as const;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={gradientColors}
                style={StyleSheet.absoluteFillObject}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header / Logo Area */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoEmoji}>{isStaff ? '💼' : '🛡️'}</Text>
                        </View>
                        <Text style={styles.title}>
                            LIC MANAGER
                        </Text>
                        <Text style={styles.subtitle}>
                            {isStaff ? 'Staff Portal' : 'Admin Portal'}
                        </Text>
                    </View>

                    {/* Login Card */}
                    <View style={styles.card}>

                        {/* Tabs */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, isStaff && styles.tabActive]}
                                onPress={() => setActiveTab('staff')}
                            >
                                <Text style={[styles.tabText, isStaff && styles.tabTextActive]}>Staff</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, !isStaff && styles.tabActive]}
                                onPress={() => setActiveTab('admin')}
                            >
                                <Text style={[styles.tabText, !isStaff && styles.tabTextActive]}>Admin</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email Address</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={isStaff ? "staff@lic.com" : "admin@lic.com"}
                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                <Text style={[styles.buttonText, isStaff ? styles.buttonTextStaff : styles.buttonTextAdmin]}>
                                    {loading ? 'Verifying...' : 'Sign In'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Dev Tools (Subtle) */}
                    <View style={styles.devTools}>
                        <Text style={styles.devToolsTitle}>
                            Developer Tools
                        </Text>
                        <View style={styles.devToolsButtons}>
                            <TouchableOpacity
                                style={styles.devToolButton}
                                onPress={async () => {
                                    const { seedDatabase } = await import('../lib/seed');
                                    seedDatabase();
                                }}
                            >
                                <Text style={styles.devToolButtonText}>Seed Policies</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.devToolButton}
                                onPress={async () => {
                                    const { createTestUsers } = await import('../lib/seed');
                                    createTestUsers();
                                }}
                            >
                                <Text style={styles.devToolButtonText}>Create Users</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    logoEmoji: {
        fontSize: 36,
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 1.5,
        textAlign: 'center',
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 18,
        marginTop: 4,
        fontWeight: '300',
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: 4,
        borderRadius: 12,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#ffffff',
    },
    tabText: {
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    tabTextActive: {
        color: '#065f46',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 8,
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
    },
    buttonTextStaff: {
        color: '#064e3b',
    },
    buttonTextAdmin: {
        color: '#1e3a8a',
    },
    devTools: {
        marginTop: 48,
        alignItems: 'center',
    },
    devToolsTitle: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 1.5,
    },
    devToolsButtons: {
        flexDirection: 'row',
        gap: 16,
    },
    devToolButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    devToolButtonText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
    },
});
