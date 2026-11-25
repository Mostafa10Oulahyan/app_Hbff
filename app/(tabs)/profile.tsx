import { HangoutBox } from "@/components/hangoutBox";
import { SideMenu } from "@/components/SideMenu";
import { styles } from "@/const/style";
import { useClerkToken } from "@/hooks/useClerkToken";
import { createClerkSupabaseClient } from "@/lib/supabase/clerkSupabase";
import { getProfile, ProfileData } from "@/lib/supabase/queries/getProfile";
import {
    getHostedHangouts,
    getJoinedHangouts,
    UserHangout,
} from "@/lib/supabase/queries/getUserHangouts";
import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import {
    Calendar,
    Heart,
    MapPin,
    Settings,
    Star,
    User,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function Profile() {
    const { user } = useUser();
    const userId = user?.id;
    const getToken = useClerkToken();

    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    // Tabs state
    const [activeTab, setActiveTab] = useState<"joined" | "hosted">("joined");
    const [joinedHangouts, setJoinedHangouts] = useState<UserHangout[]>([]);
    const [hostedHangouts, setHostedHangouts] = useState<UserHangout[]>([]);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!loading) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [loading]);

    useEffect(() => {
        Animated.timing(tabIndicatorAnim, {
            toValue: activeTab === "joined" ? 0 : 1,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [activeTab]);

    const loadData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }
            const authenticatedSupabase =
                createClerkSupabaseClient(accessToken);
            const [profile, joined, hosted] = await Promise.all([
                getProfile(userId),
                getJoinedHangouts(userId, authenticatedSupabase),
                getHostedHangouts(userId, authenticatedSupabase),
            ]);
            setProfileData(profile);
            setJoinedHangouts(joined);
            setHostedHangouts(hosted);
        } catch (error) {
            console.error("Could not load profile hangouts:", error);
            setLoadError(
                error instanceof Error
                    ? error.message
                    : "Could not load your hangouts. Please try again.",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [getToken, userId]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadData();
    }, [loadData]);

    const interests = profileData?.interests || [];
    const score = Math.round(profileData?.rating_average || 0);
    const joinedDate = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        })
        : "";

    const location = [profileData?.city, profileData?.country]
        .filter(Boolean)
        .join(", ");

    const renderHangoutItem = ({ item }: { item: UserHangout }) => {
        const date = new Date(item.scheduled_at);
        const timeFormatted = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        return (
            <View style={{ marginBottom: 16, paddingHorizontal: 16 }}>
                <HangoutBox
                    id={item.id}
                    title={item.title}
                    imageUrl={item.image_url || ""}
                    time={timeFormatted}
                    location={item.location_name}
                    members={item.participants}
                    mainMembers={[
                        {
                            name: item.host.first_name,
                            avatarUrl: item.host.photo_url || "",
                        },
                    ]}
                    interests={item.interests.map((i) => i.category_name)}
                />
            </View>
        );
    };

    const displayHangouts =
        activeTab === "joined" ? joinedHangouts : hostedHangouts;

    const ListHeader = () => (
        <Animated.View
            style={{
                marginBottom: 8,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }}
        >
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#f0f0f0",
                }}
            >
                <Text
                    style={{
                        fontSize: 26,
                        color: "#007AFF",
                        fontFamily: "Inter_600SemiBold",
                    }}
                >
                    Profile
                </Text>
                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#F0F7FF",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                    activeOpacity={0.7}
                >
                    <Settings size={20} color="#007AFF" />
                </TouchableOpacity>
            </View>

            {/* Profile Card */}
            <View
                style={{
                    marginHorizontal: 16,
                    marginTop: 16,
                    borderRadius: 20,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    shadowColor: "#007AFF",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: "#f0f0f0",
                }}
            >
                {/* Gradient header behind avatar */}
                <LinearGradient
                    colors={["#007AFF", "#4DA3FF", "#B8D8FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        height: 100,
                        width: "100%",
                    }}
                />

                {/* Avatar */}
                <View
                    style={{
                        alignItems: "center",
                        marginTop: -52,
                        paddingBottom: 20,
                    }}
                >
                    <View
                        style={{
                            position: "relative",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        {user?.imageUrl ? (
                            <Image
                                source={{ uri: user.imageUrl }}
                                style={{
                                    width: 104,
                                    height: 104,
                                    borderRadius: 52,
                                    borderWidth: 4,
                                    borderColor: "#fff",
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 104,
                                    height: 104,
                                    borderRadius: 52,
                                    backgroundColor: "#E8F2FF",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderWidth: 4,
                                    borderColor: "#fff",
                                }}
                            >
                                <User size={48} color="#007AFF" />
                            </View>
                        )}
                        {/* Rating badge */}
                        <View
                            style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                backgroundColor:
                                    score >= 4 ? "#007AFF" : "#FF9500",
                                borderRadius: 14,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderWidth: 3,
                                borderColor: "#fff",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 3,
                            }}
                        >
                            <Star size={11} color="#fff" fill="#fff" />
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_600SemiBold",
                                    color: "#fff",
                                }}
                            >
                                {score}
                            </Text>
                        </View>
                    </View>

                    {/* Name */}
                    <Text
                        style={{
                            fontSize: 24,
                            fontFamily: "Inter_600SemiBold",
                            color: "#1a1a1a",
                            marginTop: 14,
                        }}
                    >
                        {user?.fullName || "User"}
                    </Text>

                    {/* Email */}
                    <Text
                        style={{
                            fontSize: 14,
                            fontFamily: "Inter_400Regular",
                            color: "#888",
                            marginTop: 2,
                        }}
                    >
                        {user?.primaryEmailAddress?.emailAddress || ""}
                    </Text>

                    {/* Location + Join date row */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 16,
                            marginTop: 10,
                        }}
                    >
                        {location ? (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <MapPin size={13} color="#aaa" />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontFamily: "Inter_400Regular",
                                        color: "#aaa",
                                    }}
                                >
                                    {location}
                                </Text>
                            </View>
                        ) : null}
                        {joinedDate ? (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <Calendar size={13} color="#aaa" />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontFamily: "Inter_400Regular",
                                        color: "#aaa",
                                    }}
                                >
                                    {joinedDate}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* Stats Row */}
                <View
                    style={{
                        flexDirection: "row",
                        borderTopWidth: 1,
                        borderTopColor: "#f5f5f5",
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 18,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 24,
                                fontFamily: "Inter_600SemiBold",
                                color: "#007AFF",
                            }}
                        >
                            {profileData?.groups_joined_count ||
                                joinedHangouts.length}
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                fontFamily: "Inter_400Regular",
                                color: "#999",
                                marginTop: 2,
                            }}
                        >
                            Joined
                        </Text>
                    </View>
                    <View
                        style={{
                            width: 1,
                            backgroundColor: "#f0f0f0",
                            marginVertical: 12,
                        }}
                    />
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 18,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 24,
                                fontFamily: "Inter_600SemiBold",
                                color: "#007AFF",
                            }}
                        >
                            {profileData?.groups_created_count ||
                                hostedHangouts.length}
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                fontFamily: "Inter_400Regular",
                                color: "#999",
                                marginTop: 2,
                            }}
                        >
                            Hosted
                        </Text>
                    </View>
                    <View
                        style={{
                            width: 1,
                            backgroundColor: "#f0f0f0",
                            marginVertical: 12,
                        }}
                    />
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 18,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 24,
                                fontFamily: "Inter_600SemiBold",
                                color: "#007AFF",
                            }}
                        >
                            {score}
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                fontFamily: "Inter_400Regular",
                                color: "#999",
                                marginTop: 2,
                            }}
                        >
                            Rating
                        </Text>
                    </View>
                </View>
            </View>

            {/* Interests Section */}
            {interests.length > 0 && (
                <View
                    style={{
                        paddingHorizontal: 20,
                        marginTop: 24,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        <Heart size={18} color="#007AFF" />
                        <Text
                            style={{
                                fontSize: 17,
                                fontFamily: "Inter_600SemiBold",
                                color: "#1a1a1a",
                            }}
                        >
                            Interests
                        </Text>
                    </View>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                        }}
                    >
                        {interests.map((interest: string) => (
                            <View
                                key={interest}
                                style={{
                                    backgroundColor: "#F0F7FF",
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: "#D6E8FF",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontFamily: "Inter_600SemiBold",
                                        color: "#007AFF",
                                    }}
                                >
                                    {interest}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* My Hangouts Section Title */}
            <Text
                style={{
                    fontSize: 17,
                    fontFamily: "Inter_600SemiBold",
                    color: "#1a1a1a",
                    paddingHorizontal: 20,
                    marginTop: 28,
                    marginBottom: 4,
                }}
            >
                My Hangouts
            </Text>

            {/* Tabs */}
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: "#f5f5f5",
                        borderRadius: 12,
                        padding: 4,
                    }}
                >
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: "center",
                            borderRadius: 10,
                            backgroundColor:
                                activeTab === "joined" ? "#fff" : "transparent",
                            shadowColor:
                                activeTab === "joined" ? "#000" : "transparent",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: activeTab === "joined" ? 0.08 : 0,
                            shadowRadius: 4,
                            elevation: activeTab === "joined" ? 2 : 0,
                        }}
                        onPress={() => setActiveTab("joined")}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 14,
                                color:
                                    activeTab === "joined"
                                        ? "#007AFF"
                                        : "#999",
                            }}
                        >
                            Joined ({joinedHangouts.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: "center",
                            borderRadius: 10,
                            backgroundColor:
                                activeTab === "hosted" ? "#fff" : "transparent",
                            shadowColor:
                                activeTab === "hosted" ? "#000" : "transparent",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: activeTab === "hosted" ? 0.08 : 0,
                            shadowRadius: 4,
                            elevation: activeTab === "hosted" ? 2 : 0,
                        }}
                        onPress={() => setActiveTab("hosted")}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 14,
                                color:
                                    activeTab === "hosted"
                                        ? "#007AFF"
                                        : "#999",
                            }}
                        >
                            Hosted ({hostedHangouts.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            {loading && !refreshing ? (
                <View
                    style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={displayHangouts}
                    renderItem={renderHangoutItem}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={{ paddingBottom: 40, paddingTop: 0 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#007AFF"
                        />
                    }
                    ListEmptyComponent={
                        <View
                            style={{
                                padding: 50,
                                alignItems: "center",
                            }}
                        >
                            <View
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 32,
                                    backgroundColor: "#F0F7FF",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginBottom: 16,
                                }}
                            >
                                <Calendar size={28} color="#007AFF" />
                            </View>
                            <Text
                                style={{
                                    fontFamily: "Inter_600SemiBold",
                                    fontSize: 16,
                                    color: "#666",
                                    marginBottom: 6,
                                }}
                            >
                                {loadError ? "Could not load hangouts" : "No hangouts yet"}
                            </Text>
                            <Text
                                style={{
                                    fontFamily: "Inter_400Regular",
                                    fontSize: 13,
                                    color: "#aaa",
                                    textAlign: "center",
                                }}
                            >
                                {loadError ||
                                    (activeTab === "joined"
                                        ? "Join hangouts to see them here"
                                        : "Create a hangout to get started")}
                            </Text>
                            {loadError ? (
                                <TouchableOpacity
                                    onPress={() => void loadData()}
                                    style={{ marginTop: 16 }}
                                >
                                    <Text style={{ color: "#007AFF" }}>
                                        Try again
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    }
                />
            )}

            {/* Side Menu */}
            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
            />
        </View>
    );
}