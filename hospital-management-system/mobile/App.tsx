import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { OfflineBanner } from './src/components/common/OfflineBanner';

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

// Wrapper component to initialize push notifications and offline banner
function AppContent() {
  const { error } = usePushNotifications();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (error) {
      console.warn('Push notification error:', error);
    }
  }, [error]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <View style={{ paddingTop: insets.top }}>
        <OfflineBanner />
      </View>
      <RootNavigator />
    </View>
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
