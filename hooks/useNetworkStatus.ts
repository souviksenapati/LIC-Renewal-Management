import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkStatus {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    type: string | null;
}

/**
 * Network status hook - detects online/offline state
 * Updates automatically when network changes
 */
export const useNetworkStatus = () => {
    const [network, setNetwork] = useState<NetworkStatus>({
        isOnline: true,
        isInternetReachable: null,
        type: null,
    });

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setNetwork({
                isOnline: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
            });
        });

        // Check initial state
        NetInfo.fetch().then(state => {
            setNetwork({
                isOnline: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
            });
        });

        return () => unsubscribe();
    }, []);

    return network;
};
