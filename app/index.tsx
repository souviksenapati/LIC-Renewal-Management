import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { parseError } from '../utils/errorParser';

export default function LoginScreen() {
    const [activeTab, setActiveTab] = useState<'staff' | 'manager' | 'admin'>('staff');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();
    const { isOnline } = useNetworkStatus();

    const handleLogin = async () => {
        // Check network first
        if (!isOnline) {
            Alert.alert('No connection', 'Login requires internet');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            Alert.alert('Invalid email', 'Enter a valid email address');
            return;
        }

        // Password validation
        if (!password || password.length < 6) {
            Alert.alert('Invalid password', 'Minimum 6 characters');
            return;
        }

        setLoading(true);
        try {
            await signIn(email, password, activeTab);
            if (activeTab === 'admin') {
                router.replace('/admin/dashboard');
            } else if (activeTab === 'manager') {
                router.replace('/manager/dashboard');
            } else {
                router.replace('/staff/dashboard');
            }
        } catch (error: any) {
            // User-friendly error message
            const userError = parseError(error, 'login');
            Alert.alert(userError.title, userError.message);
        } finally {
            setLoading(false);
        }
    };

    const getGradientColors = () => {
        if (activeTab === 'staff') return ['#064e3b', '#065f46', '#059669'] as const;
        if (activeTab === 'manager') return ['#92400e', '#b45309', '#f59e0b'] as const; // Orange
        return ['#1e3a8a', '#1e40af', '#3b82f6'] as const; // Admin blue
    };

    const getPortalIcon = () => {
        if (activeTab === 'staff') return '💼';
        if (activeTab === 'manager') return '👔';
        return '🛡️'; // Admin
    };

    const getPortalName = () => {
        if (activeTab === 'staff') return 'Staff Portal';
        if (activeTab === 'manager') return 'Manager Portal';
        return 'Admin Portal';
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={getGradientColors()}
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
                            <Text style={styles.logoEmoji}>{getPortalIcon()}</Text>
                        </View>
                        <Text style={styles.title}>
                            LIC MANAGER
                        </Text>
                        <Text style={styles.subtitle}>
                            {getPortalName()}
                        </Text>
                    </View>

                    {/* Login Card */}
                    <View style={styles.card}>

                        {/* Tabs */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'staff' && styles.tabActive]}
                                onPress={() => setActiveTab('staff')}
                            >
                                <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>Staff</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'manager' && styles.tabActive]}
                                onPress={() => setActiveTab('manager')}
                            >
                                <Text style={[styles.tabText, activeTab === 'manager' && styles.tabTextActive]}>Manager</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'admin' && styles.tabActive]}
                                onPress={() => setActiveTab('admin')}
                            >
                                <Text style={[styles.tabText, activeTab === 'admin' && styles.tabTextActive]}>Admin</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email Address</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={activeTab === 'staff' ? "staff@lic.com" : activeTab === 'manager' ? "manager@lic.com" : "admin@lic.com"}
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
                                <Text style={[styles.buttonText, activeTab === 'staff' ? styles.buttonTextStaff : activeTab === 'manager' ? styles.buttonTextManager : styles.buttonTextAdmin]}>
                                    {loading ? 'Verifying...' : 'Sign In'}
                                </Text>
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
    buttonTextManager: {
        color: '#92400e', // Orange for manager
    },
    buttonTextAdmin: {
        color: '#1e3a8a',
    },
    devTools: {
        marginTop: 48,
        alignItems: 'center',
    },
});
