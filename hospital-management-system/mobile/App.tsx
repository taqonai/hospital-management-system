import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Create a React Query client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Wrapper component to initialize push notifications inside NavigationContainer
function AppContent() {
  const { error } = usePushNotifications();

  useEffect(() => {
    if (error) {
      console.warn('Push notification error:', error);
    }
  }, [error]);

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer
              theme={{
                dark: false,
                colors: {
                  primary: colors.primary[600],
                  background: colors.background,
                  card: colors.white,
                  text: colors.text.primary,
                  border: colors.border,
                  notification: colors.error[500],
                },
                fonts: {
                  regular: {
                    fontFamily: 'System',
                    fontWeight: '400' as const,
                  },
                  medium: {
                    fontFamily: 'System',
                    fontWeight: '500' as const,
                  },
                  bold: {
                    fontFamily: 'System',
                    fontWeight: '700' as const,
                  },
                  heavy: {
                    fontFamily: 'System',
                    fontWeight: '900' as const,
                  },
                },
              }}
            >
              <AppContent />
            </NavigationContainer>
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
