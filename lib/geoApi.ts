export interface GeoCity {
    city: string;
    country: string;
    countryCode: string;
    region: string;
}

/**
 * Search cities using GeoDB Cities free API.
 * Free tier: no API key, 1 req/sec rate limit.
 */
export async function searchCities(query: string): Promise<GeoCity[]> {
    if (!query || query.length < 2) return [];

    try {
        const res = await fetch(
            `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(query)}&limit=8&sort=-population`,
            {
                headers: {
                    "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
                    "X-RapidAPI-Key": "DEMO_KEY", // Free tier demo
                },
            },
        );

        // If RapidAPI fails, fall back to the free endpoint
        if (!res.ok) {
            return searchCitiesFallback(query);
        }

        const json = await res.json();
        return (json.data ?? []).map((c: any) => ({
            city: c.city ?? c.name ?? "",
            country: c.country ?? "",
            countryCode: c.countryCode ?? "",
            region: c.region ?? "",
        }));
    } catch {
        return searchCitiesFallback(query);
    }
}

/**
 * Fallback: use free GeoDB endpoint (no RapidAPI key needed).
 */
async function searchCitiesFallback(query: string): Promise<GeoCity[]> {
    try {
        const res = await fetch(
            `http://geodb-free-service.wirefreethought.com/v1/geo/cities?namePrefix=${encodeURIComponent(query)}&limit=8&sort=-population`,
        );
        if (!res.ok) return [];

        const json = await res.json();
        return (json.data ?? []).map((c: any) => ({
            city: c.city ?? c.name ?? "",
            country: c.country ?? "",
            countryCode: c.countryCode ?? "",
            region: c.region ?? "",
        }));
    } catch {
        return [];
    }
}
