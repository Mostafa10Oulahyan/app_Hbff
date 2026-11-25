import { HangoutDetailData } from "@/const/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export const getHangoutById = async (
  id: string,
  client: SupabaseClient = supabase,
): Promise<HangoutDetailData | undefined> => {
  const { data, error } = await client
    .from("groups")
    .select(
      `
      id, title, description, image_url, scheduled_at,
      location_name, location_address, location_lat, location_lng,
      current_participants, max_participants, activity_type, mood, status,
      host_id,
      host:host_id (id, first_name, photo_url),
      group_interests (interests (category_name)),
      group_members (
        user_id,
        role,
        status,
        profiles:user_id (id, first_name, photo_url)
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching hangout:", error);
    throw new Error(error.message);
  }
  if (!data) {
    return undefined;
  }

  const d = data as any;

  const host = d.host ?? {};
  const members = (d.group_members ?? [])
    .filter((m: any) => m.status === "joined")
    .map((m: any) => ({
      id: m.profiles?.id ?? m.user_id,
      name: m.profiles?.first_name ?? "",
      avatarUrl: m.profiles?.photo_url ?? "",
      role: m.role ?? "member",
      status: m.status ?? "joined",
    }));

  const interests = (d.group_interests ?? [])
    .map((gi: any) => gi.interests?.category_name)
    .filter(Boolean);

  const scheduledDate = new Date(d.scheduled_at);

  return {
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    imageUrl: d.image_url ?? "",
    activityType: d.activity_type ?? "",
    mood: d.mood ?? null,
    locationName: d.location_name,
    locationAddress: d.location_address ?? null,
    locationLat: Number(d.location_lat),
    locationLng: Number(d.location_lng),
    scheduledAt: d.scheduled_at,
    scheduledAtFormatted: scheduledDate.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    maxParticipants: d.max_participants ?? 10,
    currentParticipants: members.length,
    status: d.status ?? "active",
    hostId: d.host_id,
    hostName: host.first_name ?? "",
    hostAvatarUrl: host.photo_url ?? "",
    members,
    interests,
  };
};
