import { View, Text, StyleSheet } from 'react-native';

export default function EnvironmentBadge() {
    // Check environment from build-time variable
    const env = process.env.EXPO_PUBLIC_ENV || process.env.EAS_BUILD_PROFILE || 'production';

    // Only show in testing environment
    if (env !== 'testing') {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.badge}>
                <Text style={styles.text}>⚠️ TEST ENVIRONMENT</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        right: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none', // Allow touches to pass through
        alignItems: 'center',
    },
    badge: {
        backgroundColor: 'rgba(255, 152, 0, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
