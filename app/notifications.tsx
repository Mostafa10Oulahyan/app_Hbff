import { styles } from "@/const/style";
import { useClerkToken } from "@/hooks/useClerkToken";
import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from "@/lib/supabase/queries/getNotifications";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
    AlertCircle,
    ArrowLeft,
    Bell,
    BellOff,
    Calendar,
    CheckCheck,
    MessageSquare,
    Star,
    UserPlus,
    Users,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const NOTIFICATION_ICONS: Record<string, any> = {
    message: { icon: MessageSquare, color: "#007AFF", bg: "#EBF3FF" },
    join: { icon: UserPlus, color: "#34C759", bg: "#E8F8ED" },
    leave: { icon: Users, color: "#FF9500", bg: "#FFF3E0" },
    reminder: { icon: Calendar, color: "#AF52DE", bg: "#F3E8FF" },
    rating: { icon: Star, color: "#FFD60A", bg: "#FFF9E0" },
    report: { icon: AlertCircle, color: "#FF3B30", bg: "#FFF0F0" },
    default: { icon: Bell, color: "#8E8E93", bg: "#F5F5F5" },
};

function getNotifStyle(type: string) {
    return NOTIFICATION_ICONS[type] ?? NOTIFICATION_ICONS.default;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useUser();
    const userId = user?.id;
    const getToken = useClerkToken();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!userId) return;
        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }
            const data = await getNotifications(userId, accessToken);
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, getToken]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    }, [fetchNotifications]);

    const handleNotificationPress = async (notif: NotificationItem) => {
        // Mark as read
        if (!notif.isRead && userId) {
            try {
                const accessToken = await getToken();
                if (!accessToken) {
                    throw new Error("Clerk did not return a session token.");
                }
                const updated = await markNotificationRead(
                    notif.id,
                    userId,
                    accessToken,
                );
                if (updated) {
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
                    );
                }
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
            }
        }

        // Navigate based on type
        if (notif.relatedGroupId) {
            router.push({
                pathname: "/hangout/[id]",
                params: { id: notif.relatedGroupId },
            });
        }
    };

    const handleMarkAllRead = async () => {
        if (!userId) return;
        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }
            const updated = await markAllNotificationsRead(userId, accessToken);
            if (updated) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            }
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* Header */}
            <View
                style={[
                    styles.fullWidthContainer,
                    styles.bottomBorder,
                    {
                        gap: 12,
                        paddingVertical: 14,
                        justifyContent: "space-between",
                    },
                ]}
            >
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                    <ArrowLeft size={24} color="#007AFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.mainTitle}>Notifications</Text>
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity
                        onPress={handleMarkAllRead}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "#EBF3FF",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                        }}
                    >
                        <CheckCheck size={14} color="#007AFF" />
                        <Text
                            style={{
                                fontSize: 12,
                                fontFamily: "Inter_600SemiBold",
                                color: "#007AFF",
                            }}
                        >
                            Read all
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Content */}
            {loading ? (
                <View
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                >
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : notifications.length === 0 ? (
                <View
                    style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 40,
                    }}
                >
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: "#F5F5F5",
                            justifyContent: "center",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <BellOff size={36} color="#C7C7CC" />
                    </View>
                    <Text
                        style={{
                            fontSize: 18,
                            fontFamily: "Inter_600SemiBold",
                            color: "#000",
                            marginBottom: 6,
                        }}
                    >
                        No notifications yet
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            fontFamily: "Inter_400Regular",
                            color: "#666",
                            textAlign: "center",
                            lineHeight: 20,
                        }}
                    >
                        When someone joins your hangout or sends you a message, you'll see
                        it here.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#007AFF"]}
                            tintColor="#007AFF"
                        />
                    }
                >
                    {/* Unread count header */}
                    {unreadCount > 0 && (
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                backgroundColor: "#F0F7FF",
                                borderBottomWidth: 1,
                                borderBottomColor: "#E0E0E0",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontFamily: "Inter_600SemiBold",
                                    color: "#007AFF",
                                }}
                            >
                                {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
                            </Text>
                        </View>
                    )}

                    {notifications.map((notif) => {
                        const notifStyle = getNotifStyle(notif.type);
                        const IconComp = notifStyle.icon;

                        return (
                            <TouchableOpacity
                                key={notif.id}
                                onPress={() => handleNotificationPress(notif)}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    gap: 12,
                                    backgroundColor: notif.isRead ? "#fff" : "#F8FBFF",
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#F0F0F0",
                                }}
                            >
                                {/* Icon or user avatar */}
                                <View style={{ position: "relative" }}>
                                    {notif.relatedUserAvatar ? (
                                        <Image
                                            source={{ uri: notif.relatedUserAvatar }}
                                            style={{
                                                width: 46,
                                                height: 46,
                                                borderRadius: 23,
                                                backgroundColor: "#e0e0e0",
                                            }}
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 46,
                                                height: 46,
                                                borderRadius: 23,
                                                backgroundColor: notifStyle.bg,
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}
                                        >
                                            <IconComp size={22} color={notifStyle.color} />
                                        </View>
                                    )}
                                    {/* Small type icon on avatar */}
                                    {notif.relatedUserAvatar && (
                                        <View
                                            style={{
                                                position: "absolute",
                                                bottom: -2,
                                                right: -2,
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                backgroundColor: notifStyle.bg,
                                                justifyContent: "center",
                                                alignItems: "center",
                                                borderWidth: 2,
                                                borderColor: "#fff",
                                            }}
                                        >
                                            <IconComp size={10} color={notifStyle.color} />
                                        </View>
                                    )}
                                    {/* Unread dot */}
                                    {!notif.isRead && (
                                        <View
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: -2,
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: "#007AFF",
                                                borderWidth: 2,
                                                borderColor: "#fff",
                                            }}
                                        />
                                    )}
                                </View>

                                {/* Content */}
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontFamily: notif.isRead
                                                ? "Inter_400Regular"
                                                : "Inter_600SemiBold",
                                            color: "#000",
                                            marginBottom: 2,
                                            lineHeight: 20,
                                        }}
                                    >
                                        {notif.title}
                                    </Text>
                                    {notif.body && (
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontFamily: "Inter_400Regular",
                                                color: "#666",
                                                lineHeight: 18,
                                                marginBottom: 4,
                                            }}
                                            numberOfLines={2}
                                        >
                                            {notif.body}
                                        </Text>
                                    )}
                                    {/* Related group chip */}
                                    {notif.relatedGroupTitle && (
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 4,
                                                marginTop: 4,
                                            }}
                                        >
                                            {notif.relatedGroupImage && (
                                                <Image
                                                    source={{ uri: notif.relatedGroupImage }}
                                                    style={{
                                                        width: 18,
                                                        height: 18,
                                                        borderRadius: 4,
                                                        backgroundColor: "#e0e0e0",
                                                    }}
                                                />
                                            )}
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontFamily: "Inter_600SemiBold",
                                                    color: "#007AFF",
                                                }}
                                                numberOfLines={1}
                                            >
                                                {notif.relatedGroupTitle}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Time */}
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontFamily: "Inter_400Regular",
                                        color: "#999",
                                        marginTop: 2,
                                    }}
                                >
                                    {notif.timeAgo}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}
