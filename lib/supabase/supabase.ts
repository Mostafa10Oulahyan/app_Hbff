
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { supabaseFetch } from './supabaseFetch'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    global: {
      fetch: supabaseFetch,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
        