import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
                    <Stack.Screen name="admin/policies" options={{ headerShown: false }} />
                    <Stack.Screen name="admin/add-policy" options={{ headerShown: false }} />
                    <Stack.Screen name="admin/upload-pdf" options={{ headerShown: false }} />
                    <Stack.Screen name="staff/dashboard" options={{ headerShown: false }} />
                </Stack>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
