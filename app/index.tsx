import LoadingScreen from "@/components/LoadingScreen";
import { useClerkToken } from "@/hooks/useClerkToken";
import { upsertProfile } from "@/lib/supabase/mutations/profile";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
    Inter_400Regular,
    Inter_600SemiBold,
    useFonts,
} from "@expo-google-fonts/inter";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function Index() {
    const { isLoaded, isSignedIn } = useAuth();
    const getToken = useClerkToken();
    const { user } = useUser();
    const userId = user?.id;
    const firstName = user?.firstName;
    const imageUrl = user?.imageUrl;
    const profileCompleted = user?.unsafeMetadata?.profileCompleted === true;
    const isOnboarded = user?.unsafeMetadata?.onboarded === true;
    const router = useRouter();

    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_600SemiBold,
    });

    useEffect(() => {
        if (!isLoaded || !fontsLoaded) return;

        if (isSignedIn && userId) {
            let isActive = true;
            const syncProfileAndRoute = async () => {
                try {
                    const accessToken = await getToken();
                    if (!accessToken) {
                        throw new Error("Clerk did not return a session token.");
                    }
                    const saved = await upsertProfile({
                        id: userId,
                        firstName: firstName ?? "User",
                        photoUrl: imageUrl ?? undefined,
                    }, accessToken);
                    if (!saved) {
                        throw new Error("Could not sync the Clerk profile to Supabase.");
                    }
                } catch (error) {
                    console.error("Profile sync failed:", error);
                }

                if (!isActive) return;

                if (isOnboarded) {
                    router.replace("/(tabs)");
                } else if (profileCompleted) {
                    router.replace("/(auth)/select-interests");
                } else {
                    router.replace("/(auth)/complete-profile");
                }
            };

            void syncProfileAndRoute();
            return () => {
                isActive = false;
            };
        } else if (!isSignedIn) {
            router.replace("/(auth)/get-started");
        }
    }, [
        isLoaded,
        isSignedIn,
        fontsLoaded,
        userId,
        firstName,
        imageUrl,
        profileCompleted,
        isOnboarded,
        router,
        getToken,
    ]);

    return <LoadingScreen />;
}
