import { supabase } from "../supabase";

export interface ProfileData {
  first_name: string;
  photo_url: string | null;
  bio: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  rating_average: number;
  groups_created_count: number;
  groups_joined_count: number;
  interests: string[];
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  try {
    // Fetch profile stats + details
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name, photo_url, bio, gender, city, country, rating_average, groups_created_count, groups_joined_count")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return null;
    }
    if (!profile) return null;

    // Fetch user interests
    const { data: userInterests, error: interestsError } = await supabase
      .from("user_interests")
      .select("interests:interest_id(category_name)")
      .eq("user_id", userId);

    if (interestsError) {
      console.error("Error fetching user interests:", interestsError);
    }

    const interests: string[] = (userInterests || [])
      .map((ui: any) => ui.interests?.category_name)
      .filter(Boolean);

    return {
      first_name: profile.first_name || "",
      photo_url: profile.photo_url || null,
      bio: profile.bio || null,
      gender: profile.gender || null,
      city: profile.city || null,
      country: profile.country || null,
      rating_average: Number(profile.rating_average) || 0,
      groups_created_count: profile.groups_created_count || 0,
      groups_joined_count: profile.groups_joined_count || 0,
      interests,
    };
  } catch (err) {
    console.error("getProfile error:", err);
    return null;
  }
}
