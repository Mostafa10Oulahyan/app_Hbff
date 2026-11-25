import { HangoutBoxProps } from "@/const/types";
import { supabase } from "../supabase";

export interface GetHangoutsParams {
  limit?: number;
  offset?: number;
  userLat?: number | null;
  userLng?: number | null;
  radiusKm?: number;
  userInterests?: string[];
  searchQuery?: string;
  city?: string;
  country?: string;
}

const getHangouts = async (
  params: GetHangoutsParams = {},
): Promise<HangoutBoxProps[]> => {
  const {
    limit = 20,
    offset = 0,
    userLat,
    userLng,
    radiusKm = 30,
    userInterests = [],
    searchQuery,
    city,
    country,
  } = params;

  let query = supabase
    .from("groups")
    .select(
      `
      id, title, image_url, scheduled_at, location_name, location_lat, location_lng,
      current_participants, status, description,
      group_interests(interests(category_name)),
      group_members(profiles:user_id(first_name, photo_url))
    `,
    )
    .eq("status", "active")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

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

  // Text search
  if (searchQuery && searchQuery.trim().length > 0) {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(
      `title.ilike.${term},location_name.ilike.${term},description.ilike.${term}`,
    );
  }

  // Fetch more to allow interest-based reordering
  const fetchLimit = userInterests.length > 0 ? limit * 3 : limit;
  query = query.range(offset, offset + fetchLimit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching hangouts:", error);
    return [];
  }

  let mapped = (data ?? []).map((g: any) => {
    const interests = (g.group_interests ?? [])
      .map((gi: any) => gi.interests?.category_name)
      .filter(Boolean);

    return {
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
      interests,
    };
  });

  // Interest-based priority sorting
  if (userInterests.length > 0) {
    const interestSet = new Set(userInterests.map((i) => i.toLowerCase()));
    mapped.sort((a, b) => {
      const aMatch = a.interests.some((i: string) =>
        interestSet.has(i.toLowerCase()),
      );
      const bMatch = b.interests.some((i: string) =>
        interestSet.has(i.toLowerCase()),
      );
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  // City/Country text filter (client-side on location_name)
  if (city) {
    const cityLower = city.toLowerCase();
    const cityFiltered = mapped.filter((h) =>
      h.location.toLowerCase().includes(cityLower),
    );
    // If city filter gives too few results, keep all location-based results
    if (cityFiltered.length >= Math.min(3, limit)) {
      mapped = cityFiltered;
    }
  }

  return mapped.slice(0, limit);
};

export default getHangouts;
