import { db, auth } from '../firebaseConfig';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export const seedDatabase = async () => {
    try {
        const policies = [
            {
                policyNumber: 'P1001',
                customerName: 'John Doe',
                amount: 5000,
                dueDate: '2025-12-01',
                status: 'pending',
            },
            {
                policyNumber: 'P1002',
                customerName: 'Jane Smith',
                amount: 7500,
                dueDate: '2025-12-05',
                status: 'pending',
            },
            {
                policyNumber: 'P1003',
                customerName: 'Alice Johnson',
                amount: 3200,
                dueDate: '2025-12-10',
                status: 'verified',
                receiptUrl: 'https://via.placeholder.com/150',
                verifiedAt: Date.now(),
            },
        ];

        const policiesRef = collection(db, 'policies');

        for (const policy of policies) {
            await addDoc(policiesRef, {
                ...policy,
                createdAt: Date.now(),
            });
        }

        console.log('Seeding policies complete!');
        alert('Seeding policies complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
        alert('Error seeding database: ' + error);
    }
};

export const createTestUsers = async () => {
    try {
        // Create Admin
        try {
            const adminCred = await createUserWithEmailAndPassword(auth, 'admin@lic.com', 'admin@123');
            await setDoc(doc(db, 'users', adminCred.user.uid), {
                uid: adminCred.user.uid,
                email: 'admin@lic.com',
                role: 'admin',
                name: 'Admin User',
                createdAt: Date.now()
            });
            console.log('Admin created');
        } catch (e: any) {
            console.log('Admin creation skipped (maybe exists):', e.message);
        }

        // Create Staff
        try {
            const staffCred = await createUserWithEmailAndPassword(auth, 'staff@lic.com', 'staff@123');
            await setDoc(doc(db, 'users', staffCred.user.uid), {
                uid: staffCred.user.uid,
                email: 'staff@lic.com',
                role: 'staff',
                name: 'Staff User',
                createdAt: Date.now()
            });
            console.log('Staff created');
        } catch (e: any) {
            console.log('Staff creation skipped (maybe exists):', e.message);
        }

        alert('Test users created! \nAdmin: admin@lic.com / admin@123 \nStaff: staff@lic.com / staff@123');
        await auth.signOut();
    } catch (error) {
        console.error('Error creating users:', error);
        alert('Error creating users: ' + error);
    }
};
