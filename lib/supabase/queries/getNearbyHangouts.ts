import { supabase } from "../supabase";

export interface NearbyHangout {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  time: string;
  distance: string;
  location: string;
  members: number;
  mainMembers: Array<{ name: string; avatarUrl: string }>;
  lat: number;
  lng: number;
}

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  return mi < 0.1 ? "Nearby" : `${mi.toFixed(1)} mi`;
}

const getNearbyHangouts = async (
  userLat: number,
  userLng: number,
  radiusKm: number = 10,
): Promise<NearbyHangout[]> => {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      id, title, image_url, activity_type, scheduled_at, location_name,
      location_lat, location_lng, current_participants,
      group_members(profiles:user_id(first_name, photo_url))
    `,
    )
    .eq("status", "active")
    .gte("scheduled_at", new Date().toISOString())
    .gte("location_lat", userLat - latDelta)
    .lte("location_lat", userLat + latDelta)
    .gte("location_lng", userLng - lngDelta)
    .lte("location_lng", userLng + lngDelta)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Error fetching nearby hangouts:", error);
    return [];
  }

  return (data ?? [])
    .map((g: any) => {
      const distKm = getDistanceKm(
        userLat,
        userLng,
        Number(g.location_lat),
        Number(g.location_lng),
      );
      return {
        id: g.id,
        title: g.title,
        imageUrl: g.image_url ?? "",
        category: g.activity_type,
        time: new Date(g.scheduled_at).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        distance: formatDistance(distKm),
        location: g.location_name,
        members: g.current_participants ?? 0,
        mainMembers: (g.group_members ?? []).slice(0, 2).map((m: any) => ({
          name: m.profiles?.first_name ?? "",
          avatarUrl: m.profiles?.photo_url ?? "",
        })),
        lat: Number(g.location_lat),
        lng: Number(g.location_lng),
        _distKm: distKm,
      };
    })
    .filter((g: any) => g._distKm <= radiusKm)
    .sort((a: any, b: any) => a._distKm - b._distKm)
    .map(({ _distKm, ...rest }: any) => rest);
};

export default getNearbyHangouts;
