import { Conversation } from "@/const/types";
import { createClerkSupabaseClient } from "../clerkSupabase";

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

const getConversations = async (
  userId: string,
  accessToken: string,
): Promise<Conversation[]> => {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  // Get groups the user is a member of
  const { data: memberships, error: memErr } = await authenticatedSupabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "joined");

  if (memErr) {
    console.error("Error fetching memberships:", memErr);
    throw new Error(memErr.message);
  }
  if (!memberships?.length) {
    return [];
  }

  const groupIds = memberships.map((m) => m.group_id);

  // Get groups with their last message
  const { data: groups, error: groupErr } = await authenticatedSupabase
    .from("groups")
    .select(
      `
      id, title, image_url, current_participants,
      messages (
        id, content, created_at, sender_id,
        sender:sender_id (id, first_name)
      )
    `,
    )
    .in("id", groupIds)
    .order("created_at", {
      referencedTable: "messages",
      ascending: false,
    })
    .limit(1, { referencedTable: "messages" });

  if (groupErr) {
    console.error("Error fetching conversations:", groupErr);
    throw new Error(groupErr.message);
  }
  if (!groups) {
    return [];
  }

  // Batch check read status for all last messages
  const lastMessageIds = groups
    .map((g: any) => g.messages?.[0]?.id)
    .filter(Boolean);

  let readStatuses: { message_id: string }[] | null = [];
  if (lastMessageIds.length > 0) {
    const { data, error: readStatusError } = await authenticatedSupabase
      .from("message_read_status")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", lastMessageIds);

    if (readStatusError) {
      console.error("Error fetching conversation read statuses:", readStatusError);
    } else {
      readStatuses = data;
    }
  }

  const readSet = new Set(readStatuses?.map((r) => r.message_id) ?? []);

  return groups
    .map((g: any) => {
      const lastMsg = g.messages?.[0];
      const isMine = lastMsg?.sender_id === userId;

      return {
        id: g.id,
        name: g.title,
        lastMessage: lastMsg?.content ?? "",
        sentBy: lastMsg
          ? isMine
            ? "You"
            : (lastMsg.sender?.first_name ?? "")
          : "",
        time: lastMsg ? formatTime(lastMsg.created_at) : "",
        avatarUrl: g.image_url ?? "",
        members: g.current_participants ?? 0,
        isRead: !lastMsg || isMine || readSet.has(lastMsg.id),
      };
    })
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return 0;
    });
};

export default getConversations;
