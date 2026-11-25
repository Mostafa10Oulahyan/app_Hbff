import { createClerkSupabaseClient } from "../clerkSupabase";

/** Upsert a profile row for the Clerk user. Call on sign-up & sign-in. */
export async function upsertProfile(params: {
  id: string;
  firstName: string;
  photoUrl?: string;
}, accessToken: string) {
  const supabase = createClerkSupabaseClient(accessToken);
  const { error } = await supabase.from("profiles").upsert(
    {
      id: params.id,
      first_name: params.firstName,
      photo_url: params.photoUrl ?? null,
    },
    { onConflict: "id" },
  );

  if (error) console.error("upsertProfile error:", error);
  return !error;
}

/** Save user interests (delete old + insert new) */
export async function saveUserInterests(
  userId: string,
  interestNames: string[],
  accessToken: string,
) {
  const supabase = createClerkSupabaseClient(accessToken);
  const uniqueNames = [...new Set(interestNames)];
  let interests: { id: string; category_name: string }[] = [];

  if (uniqueNames.length > 0) {
    const { data, error } = await supabase
      .from("interests")
      .select("id, category_name")
      .in("category_name", uniqueNames);

    if (error) {
      console.error("Error looking up interests:", error);
      return false;
    }
    const availableNames = new Set(
      (data ?? []).map((interest) => interest.category_name),
    );
    const missingNames = uniqueNames.filter(
      (name) => !availableNames.has(name),
    );
    if (missingNames.length > 0) {
      console.error(
        "Selected interests are missing from public.interests:",
        missingNames,
      );
      throw new Error(
        `These interests are not configured: ${missingNames.join(", ")}. Run interests_seed.sql in Supabase, then try again.`,
      );
    }
    interests = data ?? [];
  }

  if (interests.length === 0) {
    const { error } = await supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId);
    if (error) console.error("Error deleting existing interests:", error);
    return !error;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("user_interests")
    .select("interest_id")
    .eq("user_id", userId);
  if (existingError) {
    console.error("saveUserInterests lookup error:", existingError);
    return false;
  }

  const existingIds = new Set(
    (existingRows ?? []).map((row) => row.interest_id),
  );
  const rows = interests
    .filter((interest) => !existingIds.has(interest.id))
    .map((interest) => ({
      user_id: userId,
      interest_id: interest.id,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("user_interests")
      .insert(rows);
    if (insertError) {
      console.error("saveUserInterests insert error:", insertError);
      return false;
    }
  }

  const selectedIds = interests.map((interest) => interest.id);
  const { error: deleteError } = await supabase
    .from("user_interests")
    .delete()
    .eq("user_id", userId)
    .not("interest_id", "in", `(${selectedIds.join(",")})`);
  if (deleteError) {
    console.error("saveUserInterests cleanup error:", deleteError);
    return false;
  }
  return true;
}

/** Update profile details (bio, gender, city, country). Called during onboarding. */
export async function updateProfileDetails(params: {
  userId: string;
  bio: string;
  gender: string;
  city: string;
  country: string;
}, accessToken: string) {
  const supabase = createClerkSupabaseClient(accessToken);
  const { error } = await supabase
    .from("profiles")
    .update({
      bio: params.bio,
      gender: params.gender,
      city: params.city,
      country: params.country,
    })
    .eq("id", params.userId);

  if (error) console.error("updateProfileDetails error:", error);
  return !error;
}

/** Update user's push notification token */
export async function updateNotificationToken(
  userId: string,
  notificationToken: string,
  accessToken: string,
) {
  const supabase = createClerkSupabaseClient(accessToken);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId);

  if (profileError) {
    console.error("updateNotificationToken profile check error:", profileError);
    throw new Error(profileError.message);
  }
  const profile = profiles?.[0];
  if (!profile) {
    throw new Error(
      "Your Supabase profile does not exist yet. Complete profile setup, then try notifications again.",
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ notification_token: notificationToken })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateNotificationToken error:", error);
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      "Supabase did not update your profile. Check the Clerk/Supabase integration and profile RLS policy.",
    );
  }
  return true;
}

/** Update user's profile photo URL */
export async function updateProfilePhoto(
  userId: string,
  photoUrl: string,
  accessToken: string,
) {
  const supabase = createClerkSupabaseClient(accessToken);
  const { error } = await supabase
    .from("profiles")
    .update({ photo_url: photoUrl })
    .eq("id", userId);

  if (error) console.error("updateProfilePhoto error:", error);
  return !error;
}
