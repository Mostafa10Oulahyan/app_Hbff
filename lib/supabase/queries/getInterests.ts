import { supabase } from "../supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const getInterests = async (
  client: SupabaseClient = supabase,
): Promise<string[]> => {
  const { data, error } = await client
    .from("interests")
    .select("category_name")
    .order("category_name", { ascending: true });

  if (error) {
    console.error("Error fetching interests:", error);
    throw new Error(error.message);
  }

  return data?.map((i) => i.category_name) ?? [];
};

export default getInterests;
