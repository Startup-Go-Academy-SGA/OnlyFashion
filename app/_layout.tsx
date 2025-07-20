import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { CartProvider } from '@/contexts/CartContext';
import { TabProvider } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { useEffect } from 'react';


const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function InitialLayout() {
 const { isLoaded, isSignedIn } = useAuth();
 const segments = useSegments();
 const router = useRouter();

 useEffect(() => {
  if (!isLoaded) return;

  const inAuthGroup = segments[0] === '(auth)';

  if (isSignedIn && inAuthGroup) {
   // Redirect away from the auth group
   router.replace('/(tabs)');
  } else if (!isSignedIn && !inAuthGroup) {
   // Redirect to the auth group
   router.replace('/(auth)/sign-in');
  }
 }, [isSignedIn, segments, isLoaded, router]);

 return (
  <Stack>
   <Stack.Screen name="(auth)" options={{ headerShown: false }} />
   <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
   <Stack.Screen name="+not-found" />
  </Stack>
 );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
  <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
    <CartProvider>
      <TabProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <InitialLayout />
          <StatusBar style="auto" />
        </ThemeProvider>
      </TabProvider>
    </CartProvider>
  </ClerkProvider>
  );
}
