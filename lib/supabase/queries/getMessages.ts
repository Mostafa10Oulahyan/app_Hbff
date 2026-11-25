import { Message } from "@/const/types";
import { createClerkSupabaseClient } from "../clerkSupabase";

const getMessages = async (
  groupId: string,
  currentUserId: string,
  accessToken: string,
): Promise<Message[]> => {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  const { data, error } = await authenticatedSupabase
    .from("messages")
    .select(
      `
      id, group_id, content, message_type, created_at,
      sender:sender_id (id, first_name, photo_url)
    `,
    )
    .eq("group_id", groupId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  // Mark messages as read
  const unreadIds = (data ?? [])
    .filter((m: any) => m.sender?.id !== currentUserId)
    .map((m: any) => m.id);

  if (unreadIds.length > 0) {
    const { error: readError } = await authenticatedSupabase
      .from("message_read_status")
      .upsert(
        unreadIds.map((messageId: string) => ({
          message_id: messageId,
          user_id: currentUserId,
        })),
        { onConflict: "message_id,user_id", ignoreDuplicates: true },
      );
    if (readError) console.error("Error marking messages as read:", readError);
  }

  return (data ?? []).map((m: any) => ({
    id: m.id,
    conversationId: m.group_id,
    text: m.content,
    sentBy:
      m.sender?.id === currentUserId ? "You" : (m.sender?.first_name ?? ""),
    avatarUrl: m.sender?.photo_url ?? "",
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isMe: m.sender?.id === currentUserId,
  }));
};

export default getMessages;

/** Mark all unread messages in a group as read for the given user. */
export async function markMessagesAsRead(
  groupId: string,
  userId: string,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  // Get all message IDs from the group that the user hasn't read yet
  const { data: messages, error: messagesError } = await authenticatedSupabase
    .from("messages")
    .select("id, sender_id")
    .eq("group_id", groupId)
    .eq("is_deleted", false)
    .neq("sender_id", userId);

  if (messagesError) {
    console.error("Error fetching unread messages:", messagesError);
    return;
  }
  if (!messages?.length) return;

  const messageIds = messages.map((m) => m.id);

  // Check which ones are already read
  const { data: alreadyRead, error: readStatusError } =
    await authenticatedSupabase
      .from("message_read_status")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", messageIds);

  if (readStatusError) {
    console.error("Error fetching read statuses:", readStatusError);
    return;
  }
  const readSet = new Set(alreadyRead?.map((r) => r.message_id) ?? []);
  const unreadIds = messageIds.filter((id) => !readSet.has(id));

  if (unreadIds.length === 0) return;

  const { error: upsertError } = await authenticatedSupabase
    .from("message_read_status")
    .upsert(
      unreadIds.map((messageId) => ({
        message_id: messageId,
        user_id: userId,
      })),
      { onConflict: "message_id,user_id", ignoreDuplicates: true },
    );
  if (upsertError) console.error("Error marking messages as read:", upsertError);
}
