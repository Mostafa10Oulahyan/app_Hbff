import { createClerkSupabaseClient } from "../clerkSupabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upload a hangout cover image to Supabase Storage and return the public URL.
 * Requires the signed-in user's Clerk token; the storage RLS policy requires
 * the object path to start with the user's Clerk `sub`.
 */
export async function uploadHangoutImage(
  uri: string,
  userId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const authenticatedSupabase = createClerkSupabaseClient(accessToken);
    const fileName = `${userId}/hangout_${Date.now()}.jpg`;

    // Fetch the image as a blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await authenticatedSupabase.storage
      .from("hangout-images")
      .upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("uploadHangoutImage error:", error);
      return null;
    }

    const { data: publicUrlData } = authenticatedSupabase.storage
      .from("hangout-images")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("uploadHangoutImage exception:", err);
    return null;
  }
}

export interface CreateHangoutParams {
  hostId: string;
  title: string;
  description: string;
  activityType: string;
  locationName: string;
  locationLat: number;
  locationLng: number;
  scheduledAt: string; // ISO string
  maxParticipants: number;
  imageUrl?: string;
  interestNames: string[];
}

/**
 * Create a hangout group.
 * DB triggers automatically handle:
 * - Creating host membership (trigger_create_host_membership)
 * - Incrementing current_participants (trigger_update_group_participant_count)
 * - Incrementing groups_created_count on profile (trigger_update_user_group_counts)
 */
export async function createHangout(
  params: CreateHangoutParams,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);

  // 1. Insert group (triggers handle host membership + counts)
  const { data: group, error: groupErr } = await authenticatedSupabase
    .from("groups")
    .insert({
      host_id: params.hostId,
      title: params.title,
      description: params.description,
      activity_type: params.activityType,
      location_name: params.locationName,
      location_lat: params.locationLat,
      location_lng: params.locationLng,
      scheduled_at: params.scheduledAt,
      max_participants: params.maxParticipants,
      current_participants: 0,
      image_url: params.imageUrl ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (groupErr || !group) {
    console.error("createHangout error:", groupErr);
    return null;
  }

  // 2. Link interests
  if (params.interestNames.length > 0) {
    const { data: interests } = await authenticatedSupabase
      .from("interests")
      .select("id")
      .in("category_name", params.interestNames);

    if (interests?.length) {
      await authenticatedSupabase.from("group_interests").insert(
        interests.map((i) => ({
          group_id: group.id,
          interest_id: i.id,
        })),
      );
    }
  }

  return group.id as string;
}

/**
 * Join an existing hangout group.
 * DB triggers automatically handle:
 * - Incrementing current_participants (trigger_update_group_participant_count)
 * - Setting group status to 'full' when at capacity
 * - Incrementing groups_joined_count on profile (trigger_update_user_group_counts)
 */
export async function joinHangout(
  groupId: string,
  userId: string,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);

  // Check if already a member
  const { data: existing, error: existingError } = await authenticatedSupabase
    .from("group_members")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("joinHangout membership check error:", existingError);
    return { success: false, error: existingError.message };
  }

  if (existing && existing.status === "joined") {
    return { success: true, alreadyJoined: true };
  }

  // Check capacity
  const { data: group, error: groupError } = await authenticatedSupabase
    .from("groups")
    .select("current_participants, max_participants")
    .eq("id", groupId)
    .single();

  if (groupError) {
    console.error("joinHangout group check error:", groupError);
    return { success: false, error: groupError.message };
  }
  if (!group) return { success: false, error: "Group not found" };
  if (group.current_participants >= group.max_participants) {
    return { success: false, error: "Group is full" };
  }

  if (existing) {
    // Re-join (previously left)
    const { error } = await authenticatedSupabase
      .from("group_members")
      .update({
        status: "joined",
        left_at: null,
        joined_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("joinHangout rejoin error:", error);
      return { success: false, error: error.message };
    }
  } else {
    // New member
    const { error } = await authenticatedSupabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
        role: "member",
        status: "joined",
      });
    if (error) {
      console.error("joinHangout insert error:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true, alreadyJoined: false };
}

/**
 * Leave a hangout group.
 * DB triggers automatically handle:
 * - Decrementing current_participants (trigger_update_group_participant_count)
 * - Setting group status back to 'active' if was 'full'
 * - Decrementing groups_joined_count on profile (trigger_update_user_group_counts)
 */
export async function leaveHangout(
  groupId: string,
  userId: string,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  const { error } = await authenticatedSupabase
    .from("group_members")
    .update({ status: "left", left_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    console.error("leaveHangout error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/** Check if a user has joined a group */
export async function checkMembership(
  groupId: string,
  userId: string,
  authenticatedSupabase: SupabaseClient,
) {
  const { data, error } = await authenticatedSupabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "joined")
    .maybeSingle();

  if (error) {
    console.error("checkMembership error:", error);
    throw new Error(error.message);
  }

  return !!data;
}

/** Delete a hangout (host only). Cascades handled by DB. */
export async function deleteHangout(
  groupId: string,
  hostId: string,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);

  // Verify the caller is the host
  const { data: group } = await authenticatedSupabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  if (!group || group.host_id !== hostId) {
    return { success: false, error: "Only the host can delete this hangout" };
  }

  // Delete related data first (order matters for FK constraints)
  const { data: messages } = await authenticatedSupabase
    .from("messages")
    .select("id")
    .eq("group_id", groupId);
  const messageIds = (messages ?? []).map((message) => message.id);

  if (messageIds.length > 0) {
    await authenticatedSupabase
      .from("message_read_status")
      .delete()
      .in("message_id", messageIds);
  }
  await authenticatedSupabase.from("messages").delete().eq("group_id", groupId);
  await authenticatedSupabase.from("group_interests").delete().eq("group_id", groupId);
  await authenticatedSupabase.from("group_members").delete().eq("group_id", groupId);
  await authenticatedSupabase.from("group_ratings").delete().eq("group_id", groupId);
  await authenticatedSupabase.from("notifications").delete().eq("related_group_id", groupId);
  await authenticatedSupabase.from("reports").delete().eq("reported_group_id", groupId);

  const { error } = await authenticatedSupabase.from("groups").delete().eq("id", groupId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Remove a member from a hangout (host only). */
export async function removeMember(
  groupId: string,
  targetUserId: string,
  hostId: string,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);

  // Verify the caller is the host
  const { data: group } = await authenticatedSupabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .single();

  if (!group || group.host_id !== hostId) {
    return { success: false, error: "Only the host can remove members" };
  }

  if (targetUserId === hostId) {
    return { success: false, error: "Cannot remove yourself as host" };
  }

  const { error } = await authenticatedSupabase
    .from("group_members")
    .update({ status: "removed", left_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface UpdateHangoutParams {
  title?: string;
  description?: string;
  scheduledAt?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  maxParticipants?: number;
  imageUrl?: string | null;
  activityType?: string;
  interestNames?: string[];
}

/** Update a hangout's details (host only). */
export async function updateHangout(
  groupId: string,
  hostId: string,
  updates: UpdateHangoutParams,
  accessToken: string,
) {
  const authenticatedSupabase = createClerkSupabaseClient(accessToken);
  const { data: group, error: groupError } = await authenticatedSupabase
    .from("groups")
    .select("host_id, current_participants")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) return { success: false, error: groupError.message };
  if (!group || group.host_id !== hostId) {
    return { success: false, error: "Only the host can edit this hangout" };
  }
  if (
    updates.maxParticipants !== undefined
    && updates.maxParticipants < group.current_participants
  ) {
    return {
      success: false,
      error: `Maximum participants cannot be below the ${group.current_participants} people already joined.`,
    };
  }

  let interestRows: { id: string }[] | undefined;
  if (updates.interestNames !== undefined && updates.interestNames.length > 0) {
    const { data, error } = await authenticatedSupabase
      .from("interests")
      .select("id")
      .in("category_name", updates.interestNames);
    if (error) return { success: false, error: error.message };
    if (!data || data.length !== new Set(updates.interestNames).size) {
      return {
        success: false,
        error: "One or more selected interests are unavailable.",
      };
    }
    interestRows = data;
  }

  const updatePayload: {
    title?: string;
    description?: string;
    scheduled_at?: string;
    location_name?: string;
    location_lat?: number;
    location_lng?: number;
    max_participants?: number;
    image_url?: string | null;
    activity_type?: string;
  } = {};
  if (updates.title !== undefined) updatePayload.title = updates.title;
  if (updates.description !== undefined) {
    updatePayload.description = updates.description;
  }
  if (updates.scheduledAt !== undefined) {
    updatePayload.scheduled_at = updates.scheduledAt;
  }
  if (updates.locationName !== undefined) {
    updatePayload.location_name = updates.locationName;
  }
  if (updates.locationLat !== undefined) {
    updatePayload.location_lat = updates.locationLat;
  }
  if (updates.locationLng !== undefined) {
    updatePayload.location_lng = updates.locationLng;
  }
  if (updates.maxParticipants !== undefined) {
    updatePayload.max_participants = updates.maxParticipants;
  }
  if (updates.imageUrl !== undefined) updatePayload.image_url = updates.imageUrl;
  if (updates.activityType !== undefined) updatePayload.activity_type = updates.activityType;

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await authenticatedSupabase
      .from("groups")
      .update(updatePayload)
      .eq("id", groupId);

    if (error) return { success: false, error: error.message };
  }

  if (updates.interestNames !== undefined) {
    const { error: deleteError } = await authenticatedSupabase
      .from("group_interests")
      .delete()
      .eq("group_id", groupId);
    if (deleteError) return { success: false, error: deleteError.message };

    if (interestRows?.length) {
      const { error: insertError } = await authenticatedSupabase
        .from("group_interests")
        .insert(
          interestRows.map((interest) => ({
            group_id: groupId,
            interest_id: interest.id,
          })),
        );
      if (insertError) return { success: false, error: insertError.message };
    }
  }

  return { success: true };
}
