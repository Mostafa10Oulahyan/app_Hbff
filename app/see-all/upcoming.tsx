import { UpcomingHangoutCard } from "@/components/UpcomingHangoutCard";
import { styles } from "@/const/style";
import getUpcomingHangouts, {
    UpcomingHangout,
} from "@/lib/supabase/queries/getUpcomingHangouts";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ArrowLeft, CalendarDays } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const PAGE_SIZE = 10;

export default function SeeAllUpcoming() {
    const { user } = useUser();
    const router = useRouter();
    const [hangouts, setHangouts] = useState<UpcomingHangout[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    const fetchPage = useCallback(
        async (pageOffset: number, isInitial = false) => {
            if (!user?.id) return;

            if (isInitial) setLoading(true);
            else setLoadingMore(true);

            const data = await getUpcomingHangouts(user.id, {
                limit: PAGE_SIZE,
                offset: pageOffset,
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
        [user?.id],
    );

    useEffect(() => {
        fetchPage(0, true);
    }, [fetchPage]);

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchPage(offset);
        }
    };

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
                <CalendarDays size={20} color="#007AFF" />
                <Text style={[styles.heading, { flex: 1 }]}>Your Upcoming</Text>
            </View>

            {loading ? (
                <View
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                >
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={hangouts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <UpcomingHangoutCard {...item} />}
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
                            <CalendarDays size={48} color="#e0e0e0" />
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontFamily: "Inter_600SemiBold",
                                    color: "#666",
                                    marginTop: 16,
                                }}
                            >
                                No upcoming hangouts
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontFamily: "Inter_400Regular",
                                    color: "#999",
                                    marginTop: 4,
                                }}
                            >
                                Join some hangouts to see them here!
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
