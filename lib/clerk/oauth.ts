import { upsertProfile } from "@/lib/supabase/mutations/profile";
import { useAuth, useOAuth } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

export const useGoogleOAuth = () => {
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { getToken } = useAuth();
  const router = useRouter();

  const onGooglePress = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        path: "/(auth)/sign-in",
      });

      const { createdSessionId, setActive, signUp } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });

        // Check if this is a new user (just signed up via OAuth)
        const isNewUser =
          signUp?.createdUserId != null && !signUp?.unsafeMetadata?.onboarded;

        if (isNewUser && signUp?.createdUserId) {
          const accessToken = await getToken();
          if (!accessToken) {
            throw new Error("Clerk did not return a session token.");
          }

          // Save profile to Supabase
          const saved = await upsertProfile({
            id: signUp.createdUserId,
            firstName: signUp.firstName ?? "User",
            photoUrl: signUp.imageUrl ?? undefined,
          }, accessToken);
          if (!saved) {
            throw new Error("Could not save your profile to Supabase.");
          }
          router.replace("/(auth)/select-interests");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      console.error("OAuth error:", err);
    }
  }, [startOAuthFlow, router, getToken]);

  return { onGooglePress };
};
