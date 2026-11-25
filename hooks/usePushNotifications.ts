import { updateNotificationToken } from "@/lib/supabase/mutations/profile";
import { useClerkToken } from "@/hooks/useClerkToken";
import Constants from "expo-constants";
import * as Device from "expo-device";
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  addPushTokenListener,
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type Notification,
} from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

type RegistrationStatus =
  | "idle"
  | "registering"
  | "ready"
  | "permission-denied"
  | "unavailable"
  | "error";

if (Platform.OS !== "web") {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function usePushNotifications(userId?: string) {
  const getToken = useClerkToken();
  const [expoPushToken, setExpoPushToken] = useState<string>();
  const [notification, setNotification] = useState<Notification>();
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>("idle");
  const notificationListener =
    useRef<ReturnType<typeof addNotificationReceivedListener> | null>(null);
  const responseListener =
    useRef<ReturnType<typeof addNotificationResponseReceivedListener> | null>(
      null,
    );

  useEffect(() => {
    if (Platform.OS === "web" || !userId) return;

    let active = true;
    let profileRetryTimer: ReturnType<typeof setTimeout> | undefined;

    const registerAndSaveToken = async (profileAttempt = 0) => {
      if (active) setRegistrationStatus("registering");
      try {
        if (!Device.isDevice) {
          console.warn("Push registration requires a physical device.");
          if (active) setRegistrationStatus("unavailable");
          return;
        }

        if (Platform.OS === "android") {
          await setNotificationChannelAsync("default", {
            name: "default",
            importance: AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }

        let permissions = await getPermissionsAsync();
        if (permissions.status === "undetermined" && permissions.canAskAgain) {
          permissions = await requestPermissionsAsync();
        }
        if (!permissions.granted) {
          console.warn(
            `Push registration skipped because notification permission is ${permissions.status}.`,
          );
          if (active) setRegistrationStatus("permission-denied");
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId) {
          throw new Error("Expo EAS project ID is missing from app configuration.");
        }

        const token = (
          await getExpoPushTokenAsync({ projectId })
        ).data;
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }

        if (!active) return;
        await updateNotificationToken(userId, token, accessToken);
        if (active) {
          setExpoPushToken(token);
          setRegistrationStatus("ready");
          console.info("Expo push token saved to the signed-in profile.");
        }
      } catch (error) {
        const profileNotReady =
          error instanceof Error &&
          error.message.includes("Supabase profile does not exist");
        if (active && profileNotReady && profileAttempt < 5) {
          profileRetryTimer = setTimeout(
            () => void registerAndSaveToken(profileAttempt + 1),
            1000,
          );
          return;
        }
        console.error("Push notification registration failed:", error);
        if (active) setRegistrationStatus("error");
      }
    };

    notificationListener.current = addNotificationReceivedListener((value) => {
      if (active) setNotification(value);
    });
    responseListener.current = addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification opened:", response.notification.request.identifier);
      },
    );
    const pushTokenListener = addPushTokenListener(() => {
      void registerAndSaveToken();
    });

    void registerAndSaveToken();

    return () => {
      active = false;
      if (profileRetryTimer) clearTimeout(profileRetryTimer);
      notificationListener.current?.remove();
      responseListener.current?.remove();
      pushTokenListener.remove();
    };
  }, [getToken, userId]);

  return {
    expoPushToken,
    notification,
    registrationStatus,
  };
}
