import { createClerkSupabaseClient } from "../clerkSupabase";

export interface NotificationItem {
    id: string;
    type: string;
    title: string;
    body: string | null;
    relatedGroupId: string | null;
    relatedUserId: string | null;
    relatedUserName: string | null;
    relatedUserAvatar: string | null;
    relatedGroupTitle: string | null;
    relatedGroupImage: string | null;
    isRead: boolean;
    sentAt: string;
    timeAgo: string;
}

function getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export async function getNotifications(
    userId: string,
    accessToken: string,
    limit = 30,
): Promise<NotificationItem[]> {
    const supabase = createClerkSupabaseClient(accessToken);
    const { data, error } = await supabase
        .from("notifications")
        .select(
            `
      id, type, title, body, is_read, sent_at,
      related_group_id, related_user_id,
      related_group:related_group_id (id, title, image_url),
      related_user:related_user_id (id, first_name, photo_url)
    `,
        )
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("getNotifications error:", error);
        return [];
    }

    return (data ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        relatedGroupId: n.related_group_id,
        relatedUserId: n.related_user_id,
        relatedUserName: n.related_user?.first_name ?? null,
        relatedUserAvatar: n.related_user?.photo_url ?? null,
        relatedGroupTitle: n.related_group?.title ?? null,
        relatedGroupImage: n.related_group?.image_url ?? null,
        isRead: n.is_read ?? false,
        sentAt: n.sent_at,
        timeAgo: getTimeAgo(n.sent_at),
    }));
}

export async function getUnreadNotificationCount(
    userId: string,
    accessToken: string,
): Promise<number> {
    const supabase = createClerkSupabaseClient(accessToken);
    const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

    if (error) {
        console.error("getUnreadNotificationCount error:", error);
        return 0;
    }

    return count ?? 0;
}

export async function markNotificationRead(
    notificationId: string,
    userId: string,
    accessToken: string,
): Promise<boolean> {
    const supabase = createClerkSupabaseClient(accessToken);
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);

    if (error) {
        console.error("markNotificationRead error:", error);
        return false;
    }
    return true;
}

export async function markAllNotificationsRead(
    userId: string,
    accessToken: string,
): Promise<boolean> {
    const supabase = createClerkSupabaseClient(accessToken);
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

    if (error) {
        console.error("markAllNotificationsRead error:", error);
        return false;
    }
    return true;
}
