import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import EnvironmentBadge from '../components/EnvironmentBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import NetworkBanner from '../components/NetworkBanner';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function RootLayoutNav() {
    const { isLoading } = useAuth();

    // Show loading screen while checking auth state
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    return (
        <>
            <NetworkBanner />
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
                <Stack.Screen name="admin/policies" options={{ headerShown: false }} />
                <Stack.Screen name="admin/add-policy" options={{ headerShown: false }} />
                <Stack.Screen name="admin/upload-pdf" options={{ headerShown: false }} />
                <Stack.Screen name="manager/dashboard" options={{ headerShown: false }} />
                <Stack.Screen name="manager/current-policies" options={{ headerShown: false }} />
                <Stack.Screen name="manager/add-all-policy" options={{ headerShown: false }} />
                <Stack.Screen name="manager/all-policies" options={{ headerShown: false }} />
                <Stack.Screen name="admin/add-all-policy" options={{ headerShown: false }} />
                <Stack.Screen name="admin/all-policies" options={{ headerShown: false }} />
                <Stack.Screen name="admin/edit-all-policy" options={{ headerShown: false }} />
                <Stack.Screen name="staff/dashboard" options={{ headerShown: false }} />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <SafeAreaProvider>
                <AuthProvider>
                    <RootLayoutNav />
                    <EnvironmentBadge />
                </AuthProvider>
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
});