import { HangoutBoxProps } from "@/const/types";
import { supabase } from "../supabase";

export interface SearchHangoutsParams {
    query: string;
    limit?: number;
    offset?: number;
    userLat?: number | null;
    userLng?: number | null;
    radiusKm?: number;
    interest?: string | null;
}

const searchHangouts = async (
    params: SearchHangoutsParams,
): Promise<HangoutBoxProps[]> => {
    const {
        query,
        limit = 20,
        offset = 0,
        userLat,
        userLng,
        radiusKm = 50,
        interest,
    } = params;

    if (!query || query.trim().length < 2) return [];

    const term = `%${query.trim()}%`;

    let dbQuery = supabase
        .from("groups")
        .select(
            `
      id, title, image_url, scheduled_at, location_name, current_participants,
      description, location_lat, location_lng,
      group_interests(interests(category_name)),
      group_members(profiles:user_id(first_name, photo_url))
    `,
        )
        .eq("status", "active")
        .gte("scheduled_at", new Date().toISOString())
        .or(
            `title.ilike.${term},location_name.ilike.${term},description.ilike.${term}`,
        )
        .order("scheduled_at", { ascending: true });

    // Location bounding box filter
    if (userLat != null && userLng != null) {
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));
        dbQuery = dbQuery
            .gte("location_lat", userLat - latDelta)
            .lte("location_lat", userLat + latDelta)
            .gte("location_lng", userLng - lngDelta)
            .lte("location_lng", userLng + lngDelta);
    }

    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data, error } = await dbQuery;

    if (error) {
        console.error("Error searching hangouts:", error);
        return [];
    }

    let results = (data ?? []).map((g: any) => ({
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

    // Client-side interest filter
    if (interest) {
        const interestLower = interest.toLowerCase();
        const filtered = results.filter((h) =>
            h.interests.some((i: string) => i.toLowerCase() === interestLower),
        );
        if (filtered.length > 0) results = filtered;
    }

    return results;
};

export default searchHangouts;
