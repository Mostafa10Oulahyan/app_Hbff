import * as Location from "expo-location";
import { supabase } from "./supabase/supabase";

export interface UserLocation {
    lat: number | null;
    lng: number | null;
    city: string | null;
    country: string | null;
    source: "gps" | "profile" | "none";
}

/**
 * Attempt to get the user's location:
 * 1. Request GPS foreground permission → use device coords
 * 2. On denial → fall back to profile city/country from Supabase + geocode via Nominatim
 * 3. If both fail → return source: "none"
 */
export async function getUserLocation(userId?: string): Promise<UserLocation> {
    // 1. Try GPS
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            // Reverse geocode to get city/country
            let city: string | null = null;
            let country: string | null = null;
            try {
                const [geo] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
                if (geo) {
                    city = geo.city ?? geo.subregion ?? null;
                    country = geo.country ?? null;
                }
            } catch {
                // reverse geocode failed, coords are still useful
            }
            return {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                city,
                country,
                source: "gps",
            };
        }
    } catch {
        // Permission request failed
    }

    // 2. Fall back to profile city/country
    if (userId) {
        try {
            const { data } = await supabase
                .from("profiles")
                .select("city, country")
                .eq("id", userId)
                .single();

            if (data?.city || data?.country) {
                // Geocode city name via Nominatim
                const coords = await geocodeCity(data.city, data.country);
                return {
                    lat: coords?.lat ?? null,
                    lng: coords?.lng ?? null,
                    city: data.city ?? null,
                    country: data.country ?? null,
                    source: "profile",
                };
            }
        } catch {
            // Profile fetch failed
        }
    }

    // 3. No location available
    return { lat: null, lng: null, city: null, country: null, source: "none" };
}

/**
 * Geocode a city/country string using OSM Nominatim (free, no key).
 */
async function geocodeCity(
    city?: string | null,
    country?: string | null,
): Promise<{ lat: number; lng: number } | null> {
    if (!city && !country) return null;

    const query = [city, country].filter(Boolean).join(", ");
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
            { headers: { "User-Agent": "HangoutBFF/1.0" } },
        );
        const results = await res.json();
        if (results.length > 0) {
            return {
                lat: parseFloat(results[0].lat),
                lng: parseFloat(results[0].lon),
            };
        }
    } catch {
        // Geocoding failed
    }
    return null;
}
