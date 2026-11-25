import { supabase } from "../supabase";

/** Fetch a minimal sender profile (id, first_name, photo_url) by user ID. */
export async function getSenderProfile(userId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, photo_url")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("getSenderProfile error:", error);
        return null;
    }

    return data;
}
