import { createClerkSupabaseClient } from "../clerkSupabase";

/** Send a message to a group chat using the sender's Clerk session. */
export async function sendMessage(
  params: {
    groupId: string;
    senderId: string;
    content: string;
    messageType?: string;
  },
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  const { data, error } = await authenticatedSupabase
    .from("messages")
    .insert({
      group_id: params.groupId,
      sender_id: params.senderId,
      content: params.content,
      message_type: params.messageType ?? "text",
    })
    .select(
      `
      id, group_id, content, message_type, created_at,
      sender:sender_id (id, first_name, photo_url)
    `,
    )
    .single();

  if (error) {
    console.error("sendMessage error:", error);
    throw new Error(error.message);
  }

  if (!data) throw new Error("Supabase did not return the sent message.");
  return data;
}

/** Mark messages as read for a given user. */
export async function markAsRead(
  messageIds: string[],
  userId: string,
  accessToken: string,
) {
  if (messageIds.length === 0) return;
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);

  const rows = messageIds.map((messageId) => ({
    message_id: messageId,
    user_id: userId,
  }));

  const { error } = await authenticatedSupabase
    .from("message_read_status")
    .upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });

  if (error) {
    console.error("markAsRead error:", error);
  }
}
