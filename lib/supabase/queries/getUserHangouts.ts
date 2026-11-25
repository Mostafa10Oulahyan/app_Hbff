import { supabase } from "../supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserHangout {
    id: string;
    title: string;
    image_url: string | null;
    scheduled_at: string;
    location_name: string;
    participants: number;
    host: {
        first_name: string;
        photo_url: string | null;
    };
    interests: { category_name: string }[];
}

/**
 * Fetch hangouts that the user has joined (excluding ones they host).
 */
export async function getJoinedHangouts(
    userId: string,
    client: SupabaseClient = supabase,
): Promise<UserHangout[]> {
    const { data, error } = await client
        .from("group_members")
        .select(
            `
        group_id,
        groups:group_id (
          id,
          title,
          image_url,
          scheduled_at,
          location_name,
          current_participants,
          host_id,
          host:host_id ( first_name, photo_url ),
          group_interests ( interests:interest_id ( category_name ) )
        )
      `,
        )
        .eq("user_id", userId)
        .eq("status", "joined")
        .eq("role", "member");

    if (error) throw new Error(error.message);

    return (data ?? [])
        .map((row: any) => {
            const g = row.groups;
            if (!g) return null;
            return {
                id: g.id,
                title: g.title,
                image_url: g.image_url,
                scheduled_at: g.scheduled_at,
                location_name: g.location_name,
                participants: g.current_participants ?? 0,
                host: {
                    first_name: g.host?.first_name ?? "Host",
                    photo_url: g.host?.photo_url ?? null,
                },
                interests: (g.group_interests || []).map((gi: any) => ({
                    category_name: gi.interests?.category_name ?? "",
                })),
            } as UserHangout;
        })
        .filter(Boolean) as UserHangout[];
}

/**
 * Fetch hangouts that the user is hosting.
 */
export async function getHostedHangouts(
    userId: string,
    client: SupabaseClient = supabase,
): Promise<UserHangout[]> {
    const { data, error } = await client
        .from("groups")
        .select(
            `
        id,
        title,
        image_url,
        scheduled_at,
        location_name,
        current_participants,
        host_id,
        host:host_id ( first_name, photo_url ),
        group_interests ( interests:interest_id ( category_name ) )
      `,
        )
        .eq("host_id", userId)
        .order("scheduled_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((g: any) => ({
        id: g.id,
        title: g.title,
        image_url: g.image_url,
        scheduled_at: g.scheduled_at,
        location_name: g.location_name,
        participants: g.current_participants ?? 0,
        host: {
            first_name: g.host?.first_name ?? "Host",
            photo_url: g.host?.photo_url ?? null,
        },
        interests: (g.group_interests || []).map((gi: any) => ({
            category_name: gi.interests?.category_name ?? "",
        })),
    }));
}
