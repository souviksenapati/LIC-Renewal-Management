export type UserRole = 'admin' | 'staff' | 'manager';

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
}

// All Policies Database Types
export type AllPolicyStatus = 'active' | 'lapsed' | 'matured' | 'surrendered';

export type Frequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';

export interface AllPolicy {
    id: string;
    policyNumber: string;
    customerName: string;
    customerNumber: string; // Phone number
    dateOfCreation: string; // DD/MM/YYYY
    frequency: Frequency;
    instalmentAmount: number;
    dateOfBirth: string; // DD/MM/YYYY
    address?: string; // Optional, default: 'N/A'
    nomineeName?: string; // Optional, default: 'N/A'
    nomineeNumber?: string; // Optional, default: 'N/A'
    policyStatus: AllPolicyStatus;
    createdBy: string; // Admin/Manager UID
    createdAt: number;
    updatedAt?: number;
    updatedBy?: string;
}

