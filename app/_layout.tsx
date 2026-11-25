import { AlertProvider } from "@/context/AlertContext";
import { tokenCache } from "@/lib/clerk/tokenCache";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePushNotifications } from "@/hooks/usePushNotifications";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(user?.id);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      // Allow the index page to handle the initial redirect, but protect other routes
      if (segments.length > 0) {
        router.replace("/(auth)/get-started");
      }
    } else if (isSignedIn) {
      // Allow index to handle onboarding checks
    }
  }, [isLoaded, isSignedIn, segments, user]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="hangout/[id]" />
      <Stack.Screen name="see-all/upcoming" />
      <Stack.Screen name="see-all/popular" />
      <Stack.Screen name="see-all/for-you" />
      <Stack.Screen name="saved-hangouts" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="app-info" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <AlertProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <AuthGate />
        </SafeAreaView>
      </AlertProvider>
    </ClerkProvider>
  );
}
