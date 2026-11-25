export function usePushNotifications(userId?: string) {
  void userId;
  return {
    expoPushToken: undefined,
    notification: undefined,
    registrationStatus: "unavailable" as const,
  };
}
