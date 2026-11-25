import { supabase } from "../supabase";

export interface SuggestedPerson {
  id: string;
  name: string;
  avatarUrl: string;
  mutualFriends: number;
  interests: string[];
  isOnline: boolean;
}

const getSuggestedPeople = async (
  userId: string,
): Promise<SuggestedPerson[]> => {
  // Get current user's interests
  const { data: myInterests } = await supabase
    .from("user_interests")
    .select("interest_id")
    .eq("user_id", userId);

  const myInterestIds = myInterests?.map((i) => i.interest_id) ?? [];

  if (!myInterestIds.length) {
    // If user has no interests, return active profiles instead
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, photo_url, is_active")
      .neq("id", userId)
      .eq("is_blocked", false)
      .eq("is_active", true)
      .limit(20);

    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.first_name ?? "",
      avatarUrl: p.photo_url ?? "",
      mutualFriends: 0,
      interests: [],
      isOnline: p.is_active ?? false,
    }));
  }

  // Get blocked user IDs
  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", userId);

  const blockedIds = new Set(blocked?.map((b) => b.blocked_id) ?? []);

  // Get users sharing the same interests
  const { data: similarUsers } = await supabase
    .from("user_interests")
    .select(
      `
      interest_id,
      interests (category_name),
      profiles:user_id (id, first_name, photo_url, is_active)
    `,
    )
    .in("interest_id", myInterestIds)
    .neq("user_id", userId);

  if (!similarUsers) return [];

  // Group by user and count shared interests
  const userMap = new Map<string, SuggestedPerson>();

  for (const row of similarUsers as any[]) {
    const profile = row.profiles;
    if (!profile || blockedIds.has(profile.id)) continue;

    if (!userMap.has(profile.id)) {
      userMap.set(profile.id, {
        id: profile.id,
        name: profile.first_name ?? "",
        avatarUrl: profile.photo_url ?? "",
        mutualFriends: 0,
        interests: [],
        isOnline: profile.is_active ?? false,
      });
    }

    const user = userMap.get(profile.id)!;
    const interestName = row.interests?.category_name;
    if (interestName && !user.interests.includes(interestName)) {
      user.interests.push(interestName);
    }
    user.mutualFriends = user.interests.length;
  }

  return Array.from(userMap.values())
    .sort((a, b) => b.mutualFriends - a.mutualFriends)
    .slice(0, 20);
};

export default getSuggestedPeople;
