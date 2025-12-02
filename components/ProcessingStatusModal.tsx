import { View, Text, Modal, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

interface ProcessingStatusProps {
    visible: boolean;
    type: 'pdf' | 'receipt';
    uploadId: string;
    onDismiss: () => void;
    minimized: boolean;
    onMinimizeChange: (isMinimized: boolean) => void;
}

type ProcessingStage = 'uploading' | 'processing' | 'parsing' | 'completed' | 'failed';

interface ProcessingStatus {
    stage: ProcessingStage;
    message: string;
    progress?: number;
    policiesFound?: number;
    error?: string;
}

const STAGES = [
    { key: 'uploading', label: 'Upload', icon: '📤' },
    { key: 'processing', label: 'Process', icon: '⚙️' },
    { key: 'parsing', label: 'Parse', icon: '📊' },
    { key: 'completed', label: 'Done', icon: '✓' },
];

export default function ProcessingStatusModal({
    visible,
    type,
    uploadId,
    onDismiss,
    minimized,
    onMinimizeChange
}: ProcessingStatusProps) {
    const [status, setStatus] = useState<ProcessingStatus>({
        stage: 'uploading',
        message: 'Uploading file...'
    });
    // minimized state now controlled by parent

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation for processing icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Rotation animation for processing spinner
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    // Listen to Firestore processing_logs/{uploadId} for real-time updates
    useEffect(() => {
        if (!visible || !uploadId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'processing_logs', uploadId),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    setStatus({
                        stage: data.stage || 'processing',
                        message: data.message || 'Processing...',
                        progress: data.progress,
                        policiesFound: data.policiesFound,
                        error: data.error
                    });
                    // NO AUTO-CLOSE - User must manually dismiss
                }
            },
            (error) => {
                console.error('Error listening to processing status:', error);
                setStatus({
                    stage: 'failed',
                    message: 'Failed to track processing status',
                    error: error.message
                });
            }
        );

        return () => unsubscribe();
    }, [visible, uploadId]);

    const getCurrentStageIndex = () => {
        return STAGES.findIndex(s => s.key === status.stage);
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const isProcessing = status.stage !== 'completed' && status.stage !== 'failed';

    return (
        <>
            {/* Minimized Floating Badge */}
            {minimized && visible && (
                <View style={styles.floatingBadge}>
                    <LinearGradient
                        colors={['#1e3a8a', '#3b82f6'] as const}
                        style={styles.floatingBadgeInner}
                    >
                        {/* Dismiss Button (❌) on LEFT - only when completed/failed */}
                        {!isProcessing && (
                            <TouchableOpacity
                                style={styles.dismissButton}
                                onPress={onDismiss}
                            >
                                <Text style={styles.dismissButtonText}>✕</Text>
                            </TouchableOpacity>
                        )}

                        {/* Tap to Maximize */}
                        <TouchableOpacity
                            style={styles.badgeContent}
                            onPress={() => onMinimizeChange(false)}
                            activeOpacity={0.8}
                        >
                            <Animated.Text style={[
                                styles.floatingIcon,
                                { transform: [{ scale: isProcessing ? pulseAnim : 1 }] }
                            ]}>
                                {status.stage === 'completed' ? '✅' :
                                    status.stage === 'failed' ? '❌' : '⚙️'}
                            </Animated.Text>
                            <View style={styles.floatingTextContainer}>
                                <Text style={styles.floatingTitle}>
                                    {status.stage === 'completed' ? 'Completed!' :
                                        status.stage === 'failed' ? 'Failed!' :
                                            status.stage === 'parsing' ? 'Parsing...' : 'Processing...'}
                                </Text>
                                {status.policiesFound !== undefined && (
                                    <Text style={styles.floatingSubtext}>
                                        {status.policiesFound} policies
                                    </Text>
                                )}
                            </View>
                            {isProcessing && <Text style={styles.expandIcon}>⬇</Text>}
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            )}

            {/* Full Modal */}
            <Modal
                visible={visible && !minimized}
                transparent
                animationType="fade"
                onRequestClose={isProcessing ? undefined : onDismiss}
            >
                <View style={styles.overlay}>
                    <LinearGradient
                        colors={['#1e3a8a', '#1e40af', '#3b82f6'] as const}
                        style={styles.modalContent}
                    >
                        {/* Title with Minimize Button */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.title}>
                                {type === 'pdf' ? '📄 Processing PDF' : '📷 Verifying Receipt'}
                            </Text>
                            {isProcessing && (
                                <TouchableOpacity
                                    style={styles.minimizeButton}
                                    onPress={() => onMinimizeChange(true)}
                                >
                                    <Text style={styles.minimizeButtonText}>_</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Animated Icon */}
                        <Animated.View
                            style={[
                                styles.iconContainer,
                                {
                                    transform: [
                                        { scale: isProcessing ? pulseAnim : 1 },
                                        { rotate: isProcessing ? spin : '0deg' }
                                    ]
                                }
                            ]}
                        >
                            <Text style={styles.icon}>
                                {status.stage === 'completed' ? '✅' :
                                    status.stage === 'failed' ? '❌' :
                                        type === 'pdf' ? '📄' : '📷'}
                            </Text>
                        </Animated.View>

                        {/* Stage Pipeline */}
                        <View style={styles.stageContainer}>
                            {STAGES.filter(s => s.key !== 'completed').map((stage, index) => {
                                const currentIndex = getCurrentStageIndex();
                                const isCompleted = index < currentIndex;
                                const isCurrent = index === currentIndex;

                                return (
                                    <View key={stage.key} style={styles.stageWrapper}>
                                        <View style={[
                                            styles.stageIcon,
                                            isCompleted && styles.stageIconCompleted,
                                            isCurrent && styles.stageIconCurrent,
                                        ]}>
                                            <Text style={styles.stageIconText}>
                                                {isCompleted ? '✓' : stage.icon}
                                            </Text>
                                        </View>
                                        <Text style={[
                                            styles.stageLabel,
                                            (isCompleted || isCurrent) && styles.stageLabelActive
                                        ]}>
                                            {stage.label}
                                        </Text>
                                        {index < STAGES.length - 2 && (
                                            <View style={[
                                                styles.stageLine,
                                                isCompleted && styles.stageLineCompleted
                                            ]} />
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Status Message */}
                        <View style={styles.statusContainer}>
                            <Text style={styles.statusMessage}>{status.message}</Text>

                            {status.policiesFound !== undefined && (
                                <Text style={styles.statsText}>
                                    ✨ Found {status.policiesFound} policies
                                </Text>
                            )}

                            {status.error && (
                                <Text style={styles.errorText}>❌ {status.error}</Text>
                            )}
                        </View>

                        {/* Close Button when completed/failed */}
                        {!isProcessing && (
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onDismiss}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        )}
                    </LinearGradient>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // Floating minimized badge
    floatingBadge: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        left: 16,
        zIndex: 1000,
        elevation: 10,
    },
    floatingBadgeInner: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        overflow: 'hidden',
    },
    dismissButton: {
        width: 48,
        height: '100%',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dismissButtonText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
    },
    badgeContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    floatingIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    floatingTextContainer: {
        flex: 1,
    },
    floatingTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    floatingSubtext: {
        color: '#a5f3fc',
        fontSize: 13,
        marginTop: 2,
    },
    expandIcon: {
        color: '#ffffff',
        fontSize: 20,
        marginLeft: 8,
    },

    // Modal header
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 24,
    },
    minimizeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    minimizeButtonText: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: -4,
    },

    // Existing styles
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    icon: {
        fontSize: 60,
    },
    stageContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginBottom: 32,
        paddingHorizontal: 8,
    },
    stageWrapper: {
        flex: 1,
        alignItems: 'center',
        position: 'relative',
    },
    stageIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        marginBottom: 8,
    },
    stageIconCompleted: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    stageIconCurrent: {
        backgroundColor: '#3b82f6',
        borderColor: '#60a5fa',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
    },
    stageIconText: {
        fontSize: 20,
        color: '#ffffff',
    },
    stageLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '600',
        textAlign: 'center',
    },
    stageLabelActive: {
        color: '#ffffff',
    },
    stageLine: {
        position: 'absolute',
        top: 24,
        left: '75%',
        width: '100%',
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    stageLineCompleted: {
        backgroundColor: '#10b981',
    },
    statusContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 24,
    },
    statusMessage: {
        fontSize: 16,
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: '600',
    },
    statsText: {
        fontSize: 14,
        color: '#a5f3fc',
        textAlign: 'center',
        marginTop: 4,
    },
    errorText: {
        fontSize: 14,
        color: '#fecaca',
        textAlign: 'center',
        marginTop: 8,
    },
    closeButton: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#10b981',
        width: '100%',
    },
    closeButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
});
