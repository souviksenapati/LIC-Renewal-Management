import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

interface ReceiptVerificationProgressProps {
    uploadId: string;
    onComplete: (success: boolean, message?: string) => void;
}

type VerificationStage = 'uploading' | 'processing' | 'verifying' | 'completed' | 'failed';

interface VerificationStatus {
    stage: VerificationStage;
    message: string;
    error?: string;
    verificationPassed?: boolean;
}

const STAGES = [
    { key: 'uploading', label: 'Uploading', icon: '📤' },
    { key: 'processing', label: 'Analyzing', icon: '🔍' },
    { key: 'verifying', label: 'Verifying', icon: '✓' },
];

export default function ReceiptVerificationProgress({
    uploadId,
    onComplete
}: ReceiptVerificationProgressProps) {
    const [status, setStatus] = useState<VerificationStatus>({
        stage: 'uploading',
        message: 'Uploading receipt...'
    });

    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Listen to Firestore for real-time updates
    useEffect(() => {
        if (!uploadId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'processing_logs', uploadId),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    setStatus({
                        stage: data.stage || 'processing',
                        message: data.message || 'Processing...',
                        error: data.error,
                        verificationPassed: data.verificationPassed
                    });

                    // Animate progress
                    const stageIndex = STAGES.findIndex(s => s.key === data.stage);
                    const progress = (stageIndex + 1) / STAGES.length;
                    Animated.timing(progressAnim, {
                        toValue: progress,
                        duration: 300,
                        useNativeDriver: false,
                    }).start();

                    // Call onComplete when done
                    if (data.stage === 'completed' || data.stage === 'failed') {
                        const success = data.verificationPassed === true;
                        const message = data.message;
                        setTimeout(() => onComplete(success, message), 1500);
                    }
                }
            },
            (error) => {
                console.error('Error listening to verification status:', error);
                setStatus({
                    stage: 'failed',
                    message: 'Failed to track verification',
                    error: error.message
                });
                onComplete(false, 'Connection error');
            }
        );

        return () => unsubscribe();
    }, [uploadId]);

    const getCurrentStageIndex = () => {
        return STAGES.findIndex(s => s.key === status.stage);
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const isProcessing = status.stage !== 'completed' && status.stage !== 'failed';
    const isSuccess = status.stage === 'completed' && status.verificationPassed;
    const isFailed = status.stage === 'failed' || (status.stage === 'completed' && !status.verificationPassed);

    return (
        <View style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                    <Animated.View
                        style={[
                            styles.progressBarFill,
                            {
                                width: progressWidth,
                                backgroundColor: isFailed ? '#ef4444' : '#3b82f6'
                            }
                        ]}
                    />
                </View>
            </View>

            {/* Stages Indicator */}
            <View style={styles.stagesContainer}>
                {STAGES.map((stage, index) => {
                    const currentIndex = getCurrentStageIndex();
                    const isCompleted = index < currentIndex || (index === currentIndex && !isProcessing);
                    const isCurrent = index === currentIndex && isProcessing;

                    return (
                        <View key={stage.key} style={styles.stageItem}>
                            <Animated.View style={[
                                styles.stageIcon,
                                isCompleted && styles.stageIconCompleted,
                                isCurrent && styles.stageIconCurrent,
                                isFailed && isCompleted && styles.stageIconFailed,
                                isCurrent && { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <Text style={styles.stageIconText}>
                                    {isCompleted && !isFailed ? '✓' : stage.icon}
                                </Text>
                            </Animated.View>
                            <Text style={[
                                styles.stageLabel,
                                (isCompleted || isCurrent) && styles.stageLabelActive
                            ]}>
                                {stage.label}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Status Message */}
            <View style={styles.statusContainer}>
                <Text style={[
                    styles.statusMessage,
                    isSuccess && styles.statusSuccess,
                    isFailed && styles.statusError
                ]}>
                    {isSuccess && '✅ '}
                    {isFailed && '❌ '}
                    {status.message}
                </Text>
                {status.error && (
                    <Text style={styles.errorDetail}>{status.error}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginTop: 16,
    },
    progressBarContainer: {
        marginBottom: 16,
    },
    progressBarBackground: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    stagesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    stageItem: {
        alignItems: 'center',
        flex: 1,
    },
    stageIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    stageIconCompleted: {
        backgroundColor: '#10b981',
    },
    stageIconCurrent: {
        backgroundColor: '#3b82f6',
    },
    stageIconFailed: {
        backgroundColor: '#ef4444',
    },
    stageIconText: {
        fontSize: 16,
    },
    stageLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        textAlign: 'center',
    },
    stageLabelActive: {
        color: '#1e293b',
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: 8,
    },
    statusMessage: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '500',
    },
    statusSuccess: {
        color: '#10b981',
        fontWeight: '600',
    },
    statusError: {
        color: '#ef4444',
        fontWeight: '600',
    },
    errorDetail: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
});
