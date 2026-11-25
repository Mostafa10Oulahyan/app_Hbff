import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { supabaseFetch } from "./supabaseFetch";

/**
 * Creates a Supabase client authenticated with the current Clerk session token.
 */
export function createClerkSupabaseClient(token: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        fetch: supabaseFetch,
      },
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
