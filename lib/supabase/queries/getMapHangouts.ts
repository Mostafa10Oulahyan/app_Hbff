import { supabase } from "../supabase";

export interface MapHangout {
    id: string;
    title: string;
    activityType: string;
    locationName: string;
    lat: number;
    lng: number;
    scheduledAt: string;
    scheduledAtFormatted: string;
    currentParticipants: number;
    maxParticipants: number;
    imageUrl: string;
    hostName: string;
    hostAvatarUrl: string;
}

export interface MapViewport {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

/**
 * Fetch upcoming hangouts inside the visible map bounds.
 */
const getMapHangouts = async (
    viewport: MapViewport,
): Promise<MapHangout[]> => {
    const halfLatSpan = Math.min(Math.abs(viewport.latitudeDelta) / 2, 90);
    const halfLngSpan = Math.min(Math.abs(viewport.longitudeDelta) / 2, 180);
    const south = Math.max(-90, viewport.latitude - halfLatSpan);
    const north = Math.min(90, viewport.latitude + halfLatSpan);

    let query = supabase
        .from("groups")
        .select(
            `
      id, title, activity_type, location_name,
      location_lat, location_lng, scheduled_at,
      current_participants, max_participants, image_url,
      host:host_id(first_name, photo_url)
    `,
        )
        .eq("status", "active")
        .gte("scheduled_at", new Date().toISOString())
        .gte("location_lat", south)
        .lte("location_lat", north)
        .order("scheduled_at", { ascending: true })
        .limit(1000);

    if (halfLngSpan < 180) {
        const west = viewport.longitude - halfLngSpan;
        const east = viewport.longitude + halfLngSpan;

        if (west < -180) {
            query = query.or(
                `location_lng.gte.${west + 360},location_lng.lte.${east}`,
            );
        } else if (east > 180) {
            query = query.or(
                `location_lng.gte.${west},location_lng.lte.${east - 360}`,
            );
        } else {
            query = query.gte("location_lng", west).lte("location_lng", east);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching map hangouts:", error);
        return [];
    }

    return (data ?? []).map((g: any) => ({
        id: g.id,
        title: g.title,
        activityType: g.activity_type,
        locationName: g.location_name,
        lat: Number(g.location_lat),
        lng: Number(g.location_lng),
        scheduledAt: g.scheduled_at,
        scheduledAtFormatted: new Date(g.scheduled_at).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
        }),
        currentParticipants: g.current_participants ?? 0,
        maxParticipants: g.max_participants ?? 10,
        imageUrl: g.image_url ?? "",
        hostName: g.host?.first_name ?? "Unknown",
        hostAvatarUrl: g.host?.photo_url ?? "",
    }));
};

export default getMapHangouts;
