import { CityCountryPicker } from "@/components/CityCountryPicker";
import { HangoutBox } from "@/components/hangoutBox";
import { PopularHangoutCard } from "@/components/PopularHangoutCard";
import { UpcomingHangoutCard } from "@/components/UpcomingHangoutCard";
import { styles } from "@/const/style";
import { HangoutBoxProps } from "@/const/types";
import { useClerkToken } from "@/hooks/useClerkToken";
import { getUserLocation, UserLocation } from "@/lib/location";
import getHangouts from "@/lib/supabase/queries/getHangouts";
import getInterests from "@/lib/supabase/queries/getInterests";
import { getUnreadNotificationCount } from "@/lib/supabase/queries/getNotifications";
import getPopularHangouts from "@/lib/supabase/queries/getPopularHangouts";
import { getProfile } from "@/lib/supabase/queries/getProfile";
import getUpcomingHangouts, {
  UpcomingHangout,
} from "@/lib/supabase/queries/getUpcomingHangouts";
import searchHangouts from "@/lib/supabase/queries/searchHangouts";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
  Bell,
  CalendarDays,
  MapPin,
  Search,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Home section limits
const UPCOMING_LIMIT = 3;
const POPULAR_LIMIT = 6;
const FOR_YOU_LIMIT = 5;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const { user } = useUser();
  const userId = user?.id;
  const getToken = useClerkToken();
  const router = useRouter();

  const [hangouts, setHangouts] = useState<HangoutBoxProps[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [popularHangouts, setPopularHangouts] = useState<HangoutBoxProps[]>([]);
  const [upcomingHangouts, setUpcomingHangouts] = useState<UpcomingHangout[]>(
    [],
  );
  const [searchResults, setSearchResults] = useState<HangoutBoxProps[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [locationLoading, setLocationLoading] = useState(true);

  // Location state
  const [location, setLocation] = useState<UserLocation>({
    lat: null,
    lng: null,
    city: null,
    country: null,
    source: "none",
  });

  // City/Country filter
  const [filterCity, setFilterCity] = useState("");
  const [filterCountry, setFilterCountry] = useState("");

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize location on mount
  useEffect(() => {
    const initLocation = async () => {
      setLocationLoading(true);
      const loc = await getUserLocation(userId);
      setLocation(loc);
      setLocationLoading(false);
    };
    initLocation();
  }, [userId]);

  // Fetch user interests
  useEffect(() => {
    const fetchUserInterests = async () => {
      if (!userId) return;
      const profile = await getProfile(userId);
      if (profile?.interests) {
        setUserInterests(profile.interests);
      }
    };
    fetchUserInterests();
  }, [userId]);

  // Fetch unread notification count
  useEffect(() => {
    if (!userId) return;
    void getToken()
      .then((accessToken) => {
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        return getUnreadNotificationCount(userId, accessToken);
      })
      .then(setUnreadNotifCount)
      .catch((error: unknown) => {
        console.error("Failed to fetch unread notification count:", error);
      });
  }, [userId, getToken]);

  const fetchData = useCallback(async () => {
    const effectiveLat = filterCity ? null : location.lat;
    const effectiveLng = filterCity ? null : location.lng;

    const [hangoutsData, interestsData, popularData] = await Promise.all([
      getHangouts({
        limit: FOR_YOU_LIMIT,
        userLat: effectiveLat,
        userLng: effectiveLng,
        userInterests,
        city: filterCity || undefined,
      }),
      getInterests(),
      getPopularHangouts({
        limit: POPULAR_LIMIT,
        userLat: effectiveLat,
        userLng: effectiveLng,
      }),
    ]);

    setHangouts(hangoutsData);
    setInterests(interestsData);
    setPopularHangouts(popularData);

    if (userId) {
      const upcomingData = await getUpcomingHangouts(userId, {
        limit: UPCOMING_LIMIT,
      });
      setUpcomingHangouts(upcomingData);
    }
  }, [userId, location, userInterests, filterCity]);

  useEffect(() => {
    if (!locationLoading) {
      void Promise.resolve()
        .then(fetchData)
        .catch((error) => {
          console.error("Could not load home data:", error);
        });
    }
  }, [fetchData, locationLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const loc = await getUserLocation(userId);
      setLocation(loc);
      await fetchData();
      if (userId) {
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        const count = await getUnreadNotificationCount(userId, accessToken);
        setUnreadNotifCount(count);
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, getToken, userId]);

  // Search handler with debounce
  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

      if (text.trim().length < 2) {
        setIsSearching(false);
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setSearchLoading(true);

      searchDebounceRef.current = setTimeout(async () => {
        const results = await searchHangouts({
          query: text,
          userLat: location.lat,
          userLng: location.lng,
          interest: activeInterest,
        });
        setSearchResults(results);
        setSearchLoading(false);
      }, 500);
    },
    [location, activeInterest],
  );

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleCityFilter = ({ city, country }: { city: string; country: string }) => {
    setFilterCity(city);
    setFilterCountry(country);
  };

  const filteredHangouts = activeInterest
    ? hangouts.filter((h) => h.interests.includes(activeInterest))
    : hangouts;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#007AFF"]}
          tintColor="#007AFF"
        />
      }
    >
      {/* Header */}
      <View style={[styles.fullWidthContainer, styles.bottomBorder]}>
        <Text numberOfLines={1} style={[styles.mainTitle, { flex: 1 }]}>
          {getGreeting()}, {user?.firstName}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/notifications" as any)}
          activeOpacity={0.7}
          style={{ position: "relative" }}
        >
          <Bell size={24} color={styles.mainTitle.color} />
          {unreadNotifCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: -5,
                right: -6,
                backgroundColor: "#FF3B30",
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 4,
                borderWidth: 2,
                borderColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: "#fff",
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View
        style={[
          styles.fullWidthContainer,
          { flexDirection: "column", alignItems: "flex-start" },
        ]}
      >
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        >
          <Search size={16} color="#999" />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
            placeholder="Search hangouts, people, or interests"
            placeholderTextColor={"#999"}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={8}>
              <X size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Location filter chip */}
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CityCountryPicker
            city={filterCity}
            country={filterCountry}
            onSelect={handleCityFilter}
            compact
          />
          {location.source !== "none" && !filterCity && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={12} color="#34C759" />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: "#666",
                }}
              >
                {location.city
                  ? `${location.city}${location.country ? `, ${location.country}` : ""}`
                  : location.source === "gps"
                    ? "GPS active"
                    : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Search Results Mode */}
      {isSearching ? (
        <View
          style={[
            styles.fullWidthContainer,
            { flexDirection: "column", alignItems: "flex-start" },
          ]}
        >
          <Text
            style={[
              styles.heading,
              { fontSize: 16, marginBottom: 8 },
            ]}
          >
            Search Results
          </Text>
          {searchLoading ? (
            <View
              style={{
                width: "100%",
                alignItems: "center",
                paddingVertical: 40,
              }}
            >
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : searchResults.length > 0 ? (
            searchResults.map((hangout) => (
              <HangoutBox
                key={hangout.id}
                id={hangout.id}
                title={hangout.title}
                imageUrl={hangout.imageUrl}
                time={hangout.time}
                location={hangout.location}
                members={hangout.members}
                mainMembers={hangout.mainMembers}
                interests={hangout.interests}
              />
            ))
          ) : (
            <View
              style={{
                width: "100%",
                alignItems: "center",
                paddingVertical: 24,
              }}
            >
              <Text style={[styles.infoText, { fontSize: 14 }]}>
                No hangouts found for "{searchQuery}"
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* Your Upcoming Hangouts */}
          {upcomingHangouts.length > 0 && (
            <View
              style={[
                styles.fullWidthContainer,
                { flexDirection: "column", alignItems: "flex-start" },
              ]}
            >
              <View style={styles.sectionHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CalendarDays size={18} color="#007AFF" />
                  <Text style={styles.heading}>Your Upcoming</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    router.push("/see-all/upcoming" as any)
                  }
                >
                  <Text style={styles.link}>See all</Text>
                </TouchableOpacity>
              </View>
              {upcomingHangouts.map((hangout) => (
                <UpcomingHangoutCard key={hangout.id} {...hangout} />
              ))}
            </View>
          )}

          {/* Popular Near You */}
          <View
            style={[
              styles.fullWidthContainer,
              { flexDirection: "column", alignItems: "flex-start" },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <TrendingUp size={18} color="#007AFF" />
                <Text style={styles.heading}>Popular Near You</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push("/see-all/popular" as any)
                }
              >
                <Text style={styles.link}>See all</Text>
              </TouchableOpacity>
            </View>
            {popularHangouts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {popularHangouts.map((hangout) => (
                  <PopularHangoutCard key={hangout.id} {...hangout} />
                ))}
              </ScrollView>
            ) : (
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  paddingVertical: 20,
                }}
              >
                <Text style={[styles.infoText, { fontSize: 13 }]}>
                  No popular hangouts nearby
                </Text>
              </View>
            )}
          </View>

          {/* Hangouts for You */}
          <View
            style={[
              styles.fullWidthContainer,
              { flexDirection: "column", alignItems: "flex-start" },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={18} color="#007AFF" />
                <Text style={styles.heading}>Hangouts for You</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push("/see-all/for-you" as any)
                }
              >
                <Text style={styles.link}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              <TouchableOpacity onPress={() => setActiveInterest(null)}>
                <Text
                  style={[
                    styles.tags,
                    { marginRight: 8 },
                    activeInterest === null && styles.activeTag,
                  ]}
                >
                  <Text
                    style={
                      activeInterest === null
                        ? styles.activeTagText
                        : undefined
                    }
                  >
                    All
                  </Text>
                </Text>
              </TouchableOpacity>
              {interests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  onPress={() =>
                    setActiveInterest(
                      interest === activeInterest ? null : interest,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.tags,
                      { marginRight: 8 },
                      activeInterest === interest && styles.activeTag,
                    ]}
                  >
                    <Text
                      style={
                        activeInterest === interest
                          ? styles.activeTagText
                          : undefined
                      }
                    >
                      {interest}
                    </Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredHangouts.length > 0 ? (
              filteredHangouts.map((hangout) => (
                <HangoutBox
                  key={hangout.id}
                  id={hangout.id}
                  title={hangout.title}
                  imageUrl={hangout.imageUrl}
                  time={hangout.time}
                  location={hangout.location}
                  members={hangout.members}
                  mainMembers={hangout.mainMembers}
                  interests={hangout.interests}
                />
              ))
            ) : (
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  paddingVertical: 24,
                }}
              >
                <Text style={[styles.infoText, { fontSize: 14 }]}>
                  No hangouts found
                  {activeInterest ? ` for "${activeInterest}"` : ""}
                </Text>
                {activeInterest && (
                  <TouchableOpacity
                    onPress={() => setActiveInterest(null)}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={styles.link}>Clear filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* Location loading indicator */}
      {locationLoading && (
        <View
          style={{
            width: "100%",
            alignItems: "center",
            paddingVertical: 20,
          }}
        >
          <ActivityIndicator size="small" color="#007AFF" />
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: "#666",
              marginTop: 8,
            }}
          >
            Getting your location...
          </Text>
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
