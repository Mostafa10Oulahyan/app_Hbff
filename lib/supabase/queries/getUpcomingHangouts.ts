import { supabase } from "../supabase";

export interface UpcomingHangout {
  id: string;
  title: string;
  imageUrl: string;
  time: string;
  location: string;
  members: number;
  daysUntil: number;
}

export interface GetUpcomingParams {
  limit?: number;
  offset?: number;
}

const getUpcomingHangouts = async (
  userId: string,
  params: GetUpcomingParams = {},
): Promise<UpcomingHangout[]> => {
  const { limit = 10, offset = 0 } = params;

  // Get groups the user has joined
  const { data: memberships, error: memErr } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "joined");

  if (memErr || !memberships?.length) {
    if (memErr) console.error("Error fetching memberships:", memErr);
    return [];
  }

  const groupIds = memberships.map((m) => m.group_id);

  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, title, image_url, scheduled_at, location_name, current_participants",
    )
    .in("id", groupIds)
    .eq("status", "active")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching upcoming hangouts:", error);
    return [];
  }

  const now = new Date();
  return (data ?? []).map((g) => {
    const scheduledDate = new Date(g.scheduled_at);
    const daysUntil = Math.ceil(
      (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      id: g.id,
      title: g.title,
      imageUrl: g.image_url ?? "",
      time: scheduledDate.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      location: g.location_name,
      members: g.current_participants ?? 0,
      daysUntil,
    };
  });
};

export default getUpcomingHangouts;
