import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Network status banner - shows at bottom when offline
 * Features innovative electric blue gradient with pulse animation
 */
export const NetworkBanner = () => {
    const { isOnline } = useNetworkStatus();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!isOnline) {
            // Subtle pulse animation for offline state
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.03,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [isOnline]);

    // Don't render if online
    if (isOnline) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ scale: pulseAnim }] }
            ]}
        >
            <LinearGradient
                colors={['#FCD34D', '#F59E0B', '#D97706'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Text style={styles.text}>OFFLINE - Connect to Internet</Text>

                {/* Decorative elements */}
                <View style={styles.decoration1} />
                <View style={styles.decoration2} />
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    gradient: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
    },
    text: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5,
        zIndex: 2,
    },
    // Decorative geometric elements
    decoration1: {
        position: 'absolute',
        top: -20,
        right: 40,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        zIndex: 0,
    },
    decoration2: {
        position: 'absolute',
        bottom: -15,
        left: 30,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        zIndex: 0,
    },
});

export default NetworkBanner;