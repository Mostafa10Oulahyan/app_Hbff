import { createClerkSupabaseClient } from "./clerkSupabase";
import { supabase } from "./supabase";

/**
 * Subscribe to new messages in a specific group conversation.
 * Returns the channel so the caller can unsubscribe when it leaves the screen.
 */
export function subscribeToGroupMessages(
    groupId: string,
    accessToken: string,
    onNewMessage: (payload: any) => void,
) {
    const authenticatedSupabase = createClerkSupabaseClient(accessToken);
    const channel = authenticatedSupabase
        .channel(`conversation-${groupId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: `group_id=eq.${groupId}`,
            },
            onNewMessage,
        )
        .subscribe();

    return channel;
}

/**
 * Subscribe to all new messages (for the chat list screen).
 * Returns the channel so the caller can unsubscribe when it leaves the screen.
 */
export function subscribeToAllMessages(
    accessToken: string,
    onNewMessage: () => void,
) {
    const authenticatedSupabase = createClerkSupabaseClient(accessToken);
    const channel = authenticatedSupabase
        .channel("chat-list-realtime")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            onNewMessage,
        )
        .subscribe();

    return channel;
}

/**
 * Remove a realtime channel subscription.
 */
export function removeChannel(channel: ReturnType<typeof supabase.channel>) {
    void channel.unsubscribe();
}
