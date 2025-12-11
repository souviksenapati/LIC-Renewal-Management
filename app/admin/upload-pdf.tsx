import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import ProcessingStatusModal from '../../components/ProcessingStatusModal';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { parseError } from '../../utils/errorParser';

const PROCESSING_STATE_KEY = 'pdf_processing_state';

export default function UploadPDF() {
    const [uploading, setUploading] = useState(false);
    const [processingModalVisible, setProcessingModalVisible] = useState(false);
    const [uploadId, setUploadId] = useState('');
    const [minimized, setMinimized] = useState(false);
    const router = useRouter();
    const { isOnline } = useNetworkStatus();

    // Load processing state when screen gains focus
    useFocusEffect(
        useCallback(() => {
            loadProcessingState();
        }, [])
    );

    const loadProcessingState = async () => {
        try {
            const saved = await AsyncStorage.getItem(PROCESSING_STATE_KEY);
            if (saved) {
                const { uploadId: savedId, timestamp, minimized } = JSON.parse(saved);
                // Only restore if less than 10 minutes old
                if (Date.now() - timestamp < 600000) {
                    setUploadId(savedId);
                    setProcessingModalVisible(true);
                    setMinimized(minimized || false); // Restore minimized state
                } else {
                    // Clear old state
                    await AsyncStorage.removeItem(PROCESSING_STATE_KEY);
                }
            }
        } catch (error) {
            console.error('Error loading processing state:', error);
        }
    };

    const saveProcessingState = async (uploadId: string, minimized: boolean = false) => {
        try {
            await AsyncStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify({
                uploadId,
                timestamp: Date.now(),
                minimized
            }));
        } catch (error) {
            console.error('Error saving processing state:', error);
        }
    };

    const clearProcessingState = async () => {
        try {
            await AsyncStorage.removeItem(PROCESSING_STATE_KEY);
            setProcessingModalVisible(false);
            setUploadId('');
        } catch (error) {
            console.error('Error clearing processing state:', error);
        }
    };

    const pickDocument = async () => {
        // Check network before allowing upload
        if (!isOnline) {
            Alert.alert('No connection', 'Connect to upload PDFs');
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                return;
            }

            const file = result.assets[0];
            uploadPDF(file.uri, file.name);

        } catch (err) {
            console.error("Error picking document:", err);
            const userError = parseError(err, 'upload');
            Alert.alert(userError.title, userError.message);
        }
    };

    const uploadPDF = async (uri: string, filename: string) => {
        setUploading(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const timestamp = Date.now();
            const uploadId = `${timestamp}_${filename.replace('.pdf', '')}`;
            const storageRef = ref(storage, `policy-uploads/${uploadId}.pdf`);

            await uploadBytes(storageRef, blob);

            // Show processing modal and save state
            setUploadId(uploadId);
            setProcessingModalVisible(true);
            await saveProcessingState(uploadId);
            setUploading(false);

        } catch (error) {
            console.error("Upload error:", error);
            // User-friendly error message
            const userError = parseError(error, 'upload');
            Alert.alert(userError.title, userError.message);
            setUploading(false);
        }
    };

    const handleDismiss = async () => {
        await clearProcessingState();
    };

    const handleMinimizeChange = async (isMinimized: boolean) => {
        setMinimized(isMinimized);
        // Save minimized state
        if (uploadId) {
            await saveProcessingState(uploadId, isMinimized);
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
                <Text style={styles.headerTitle}>Upload Policy PDF</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.uploadBox}>
                    <Text style={styles.icon}>📄</Text>
                    <Text style={styles.title}>Select PDF File</Text>
                    <Text style={styles.description}>
                        Upload the "Premium Due List" PDF. The system will automatically parse and add policies.
                    </Text>

                    {!processingModalVisible ? (
                        <TouchableOpacity
                            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                            onPress={pickDocument}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.uploadButtonText}>Choose File</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.processingInfo}>
                            <Text style={styles.processingText}>
                                {minimized ? '⬇ Processing minimized below' : '⏳ Processing in progress...'}
                            </Text>
                            <Text style={styles.processingSubtext}>
                                Upload disabled while processing
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Processing Status Modal */}
            <ProcessingStatusModal
                visible={processingModalVisible}
                type="pdf"
                uploadId={uploadId}
                onDismiss={handleDismiss}
                minimized={minimized}
                onMinimizeChange={handleMinimizeChange}
            />
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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    uploadBox: {
        backgroundColor: '#eff6ff',
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#bfdbfe',
    },
    icon: {
        fontSize: 60,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e3a8a',
        marginBottom: 8,
    },
    description: {
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 32,
    },
    uploadButton: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    uploadButtonDisabled: {
        opacity: 0.7,
    },
    uploadButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    processingInfo: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    processingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2563eb',
        marginBottom: 4,
    },
    processingSubtext: {
        fontSize: 13,
        color: '#6b7280',
    },
});
