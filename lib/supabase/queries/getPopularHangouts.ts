import { HangoutBoxProps } from "@/const/types";
import { supabase } from "../supabase";

export interface GetPopularParams {
  limit?: number;
  offset?: number;
  userLat?: number | null;
  userLng?: number | null;
  radiusKm?: number;
}

const getPopularHangouts = async (
  params: GetPopularParams = {},
): Promise<HangoutBoxProps[]> => {
  const {
    limit = 10,
    offset = 0,
    userLat,
    userLng,
    radiusKm = 30,
  } = params;

  let query = supabase
    .from("groups")
    .select(
      `
      id, title, image_url, scheduled_at, location_name, current_participants,
      group_interests(interests(category_name)),
      group_members(profiles:user_id(first_name, photo_url))
    `,
    )
    .eq("status", "active")
    .gte("scheduled_at", new Date().toISOString())
    .order("current_participants", { ascending: false });

  // Location bounding box filter
  if (userLat != null && userLng != null) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));
    query = query
      .gte("location_lat", userLat - latDelta)
      .lte("location_lat", userLat + latDelta)
      .gte("location_lng", userLng - lngDelta)
      .lte("location_lng", userLng + lngDelta);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching popular hangouts:", error);
    return [];
  }

  return (data ?? []).map((g: any) => ({
    id: g.id,
    title: g.title,
    imageUrl: g.image_url ?? "",
    time: new Date(g.scheduled_at).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    location: g.location_name,
    members: g.current_participants ?? 0,
    mainMembers: (g.group_members ?? []).slice(0, 3).map((m: any) => ({
      name: m.profiles?.first_name ?? "",
      avatarUrl: m.profiles?.photo_url ?? "",
    })),
    interests: (g.group_interests ?? [])
      .map((gi: any) => gi.interests?.category_name)
      .filter(Boolean),
  }));
};

export default getPopularHangouts;
