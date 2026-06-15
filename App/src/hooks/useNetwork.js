import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetwork = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState(null);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      setNetworkType(state.type);
      setIsInternetReachable(state.isInternetReachable !== false);
    });

    // Initial check
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      setNetworkType(state.type);
      setIsInternetReachable(state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    return state.isConnected;
  }, []);

  const waitForConnection = useCallback(async (timeout = 10000) => {
    return new Promise((resolve, reject) => {
      if (isConnected) {
        resolve(true);
        return;
      }

      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Connection timeout'));
      }, timeout);

      const unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }, [isConnected]);

  return {
    isConnected,
    isInternetReachable,
    networkType,
    checkConnection,
    waitForConnection,
  };
};

export default useNetwork;
