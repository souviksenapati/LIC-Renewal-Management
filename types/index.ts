export type UserRole = 'admin' | 'staff';

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
    name: string;
    createdAt: number;
}

export type PolicyStatus = 'pending' | 'verified';

export interface Policy {
    id: string;
    policyNumber: string;
    customerName: string;
    amount: number;
    commission?: number; // Estimated Commission from PDF (hidden from staff, visible to admin)
    dueDate: string; // DD/MM/YYYY format
    dateOfCommencement?: string; // Policy start date DD/MM/YYYY (from D.o.C column)
    fup?: string; // First Unpaid Premium date
    mod?: string; // Mode (Qly, Hly, Yly, etc.)
    status: PolicyStatus;
    receiptUrl?: string;
    uploadedBy?: string; // Staff UID
    uploadedAt?: number;
    verifiedAt?: number;
}
