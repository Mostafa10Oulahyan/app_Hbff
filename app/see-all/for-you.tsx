import { HangoutBox } from "@/components/hangoutBox";
import { styles } from "@/const/style";
import { HangoutBoxProps } from "@/const/types";
import { getUserLocation } from "@/lib/location";
import getHangouts from "@/lib/supabase/queries/getHangouts";
import getInterests from "@/lib/supabase/queries/getInterests";
import { getProfile } from "@/lib/supabase/queries/getProfile";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const PAGE_SIZE = 10;

export default function SeeAllForYou() {
    const { user } = useUser();
    const router = useRouter();
    const [hangouts, setHangouts] = useState<HangoutBoxProps[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [userInterests, setUserInterests] = useState<string[]>([]);
    const [activeInterest, setActiveInterest] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);

    useEffect(() => {
        const init = async () => {
            const [loc, interestsData] = await Promise.all([
                getUserLocation(user?.id),
                getInterests(),
            ]);
            setUserLat(loc.lat);
            setUserLng(loc.lng);
            setInterests(interestsData);

            if (user?.id) {
                const profile = await getProfile(user.id);
                if (profile?.interests) setUserInterests(profile.interests);
            }
        };
        void init().catch((error) => {
            console.error("Could not initialize For You:", error);
        });
    }, [user?.id]);

    const fetchPage = useCallback(
        async (pageOffset: number, isInitial = false) => {
            if (isInitial) setLoading(true);
            else setLoadingMore(true);

            const data = await getHangouts({
                limit: PAGE_SIZE,
                offset: pageOffset,
                userLat,
                userLng,
                userInterests,
            });

            if (data.length < PAGE_SIZE) setHasMore(false);

            if (isInitial) {
                setHangouts(data);
            } else {
                setHangouts((prev) => [...prev, ...data]);
            }

            setOffset(pageOffset + data.length);
            setLoading(false);
            setLoadingMore(false);
        },
        [userLat, userLng, userInterests],
    );

    useEffect(() => {
        fetchPage(0, true);
    }, [fetchPage]);

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchPage(offset);
        }
    };

    const filteredHangouts = activeInterest
        ? hangouts.filter((h) => h.interests.includes(activeInterest))
        : hangouts;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View
                style={[
                    styles.fullWidthContainer,
                    styles.bottomBorder,
                    { gap: 12 },
                ]}
            >
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <ArrowLeft size={24} color="#000" />
                </TouchableOpacity>
                <MapPin size={20} color="#007AFF" />
                <Text style={[styles.heading, { flex: 1 }]}>Hangouts for You</Text>
            </View>

            {/* Interest Filters */}
            <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
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
                                    activeInterest === null ? styles.activeTagText : undefined
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
            </View>

            {loading ? (
                <View
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                >
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={filteredHangouts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <HangoutBox
                            id={item.id}
                            title={item.title}
                            imageUrl={item.imageUrl}
                            time={item.time}
                            location={item.location}
                            members={item.members}
                            mainMembers={item.mainMembers}
                            interests={item.interests}
                        />
                    )}
                    contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={{ paddingVertical: 20, alignItems: "center" }}>
                                <ActivityIndicator size="small" color="#007AFF" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View
                            style={{
                                alignItems: "center",
                                paddingVertical: 60,
                            }}
                        >
                            <MapPin size={48} color="#e0e0e0" />
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontFamily: "Inter_600SemiBold",
                                    color: "#666",
                                    marginTop: 16,
                                }}
                            >
                                No hangouts found
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontFamily: "Inter_400Regular",
                                    color: "#999",
                                    marginTop: 4,
                                    textAlign: "center",
                                }}
                            >
                                {activeInterest
                                    ? `No hangouts for "${activeInterest}". Try clearing the filter.`
                                    : "Check back later for new hangouts!"}
                            </Text>
                            {activeInterest && (
                                <TouchableOpacity
                                    onPress={() => setActiveInterest(null)}
                                    style={{ marginTop: 12 }}
                                >
                                    <Text style={styles.link}>Clear filter</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </View>
    );
}
