import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, useSegments } from 'expo-router';

type UserRole = 'admin' | 'staff' | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    isLoading: boolean;
    signIn: (email: string, pass: string, role: UserRole) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [isLoading, setIsLoading] = useState(true);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch user role from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        setRole(userDoc.data().role as UserRole);
                    } else {
                        console.error('User document not found');
                        setRole(null);
                    }
                } catch (error) {
                    console.error('Error fetching user role:', error);
                    setRole(null);
                }
            } else {
                setRole(null);
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    // Protected Routes Logic
    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'admin' || segments[0] === 'staff';

        if (!user && inAuthGroup) {
            // Redirect to home if not logged in and trying to access protected routes
            router.replace('/');
        }
    }, [user, role, segments, isLoading, router]);

    const signIn = async (email: string, pass: string, expectedRole: UserRole) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // Verify Role
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const actualRole = userDoc.data().role;
                if (actualRole !== expectedRole) {
                    await firebaseSignOut(auth);
                    throw new Error(`Unauthorized. You are not an ${expectedRole}.`);
                }
            } else {
                await firebaseSignOut(auth);
                throw new Error('User record not found.');
            }
        } catch (error: any) {
            throw error;
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        router.replace('/');
    };

    return (
        <AuthContext.Provider value={{ user, role, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
