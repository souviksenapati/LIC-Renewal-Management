/**
 * User-friendly error parser
 * Converts technical Firebase/backend errors into short, user-friendly messages
 */

export interface UserError {
    title: string;      // Short title (2-4 words)
    message: string;    // Brief explanation (1 sentence)
    action?: string;    // Optional action text
    icon: '⚠️' | '❌' | '📶' | '🔒' | 'ℹ️';
    severity: 'error' | 'warning' | 'info';
}

/**
 * Parse error and return user-friendly message
 * @param error - The error object from Firebase/network
 * @param context - Context where error occurred (login, upload, etc.)
 */
export const parseError = (error: any, context: string = 'general'): UserError => {
    const code = error?.code || '';
    const message = error?.message || '';

    // Network errors (highest priority - most common)
    if (
        code.includes('network') ||
        code.includes('unavailable') ||
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('connection')
    ) {
        return {
            title: 'No connection',
            message: 'Check internet and try again',
            action: 'Retry',
            icon: '📶',
            severity: 'warning',
        };
    }

    // Auth errors  
    if (code.startsWith('auth/')) {
        // Invalid credentials
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
            return {
                title: 'Login failed',
                message: 'Wrong email or password',
                icon: '❌',
                severity: 'error',
            };
        }

        // User not found
        if (code === 'auth/user-not-found') {
            return {
                title: 'Account not found',
                message: 'No account with this email',
                icon: 'ℹ️',
                severity: 'info',
            };
        }

        // Too many attempts
        if (code === 'auth/too-many-requests') {
            return {
                title: 'Too many attempts',
                message: 'Wait 5 minutes',
                icon: '⚠️',
                severity: 'warning',
            };
        }

        // User disabled
        if (code === 'auth/user-disabled') {
            return {
                title: 'Account disabled',
                message: 'Contact admin',
                icon: '🔒',
                severity: 'error',
            };
        }
    }

    // Storage/Upload errors
    if (code.startsWith('storage/')) {
        // Unauthorized
        if (code === 'storage/unauthorized') {
            return {
                title: 'Upload blocked',
                message: 'Contact admin for access',
                icon: '🔒',
                severity: 'error',
            };
        }

        // File too large
        if (code.includes('size') || message.includes('size') || message.includes('10MB')) {
            return {
                title: 'File too large',
                message: 'Maximum size is 10MB',
                action: 'Choose another',
                icon: '⚠️',
                severity: 'warning',
            };
        }

        // Quota exceeded
        if (code === 'storage/quota-exceeded') {
            return {
                title: 'Storage full',
                message: 'Contact admin',
                icon: '⚠️',
                severity: 'error',
            };
        }
    }

    // Firestore errors
    if (code.includes('permission-denied') || code === 'firestore/permission-denied') {
        return {
            title: 'Access denied',
            message: 'No permission for this action',
            icon: '🔒',
            severity: 'error',
        };
    }

    // Context-specific defaults
    if (context === 'login') {
        return {
            title: 'Login failed',
            message: 'Please try again',
            action: 'Retry',
            icon: '❌',
            severity: 'error',
        };
    }

    if (context === 'upload') {
        return {
            title: 'Upload failed',
            message: 'Check file and try again',
            action: 'Retry',
            icon: '❌',
            severity: 'error',
        };
    }

    if (context === 'delete') {
        return {
            title: 'Delete failed',
            message: 'Please try again',
            action: 'Retry',
            icon: '❌',
            severity: 'error',
        };
    }

    // Generic fallback (should rarely be seen)
    return {
        title: 'Something went wrong',
        message: 'Please try again',
        action: 'Retry',
        icon: '⚠️',
        severity: 'error',
    };
};
