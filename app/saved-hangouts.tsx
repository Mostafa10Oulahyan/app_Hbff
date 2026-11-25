import { HangoutBox } from "@/components/hangoutBox";
import { styles } from "@/const/style";
import { SavedHangout, useSavedHangouts } from "@/hooks/useSavedHangouts";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SavedHangoutsScreen() {
    const router = useRouter();
    const { savedHangouts, loading } = useSavedHangouts();

    const renderItem = ({ item }: { item: SavedHangout }) => {
        const date = new Date(item.date);
        const timeFormatted = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        return (
            <View style={{ marginBottom: 16 }}>
                <HangoutBox
                    id={item.id}
                    title={item.title}
                    imageUrl={item.imageUrl}
                    time={timeFormatted}
                    location={item.location}
                    members={item.participants}
                    mainMembers={[{ name: item.hostName, avatarUrl: item.hostAvatarUrl }]}
                    interests={item.interests || []}
                />
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { padding: 0}]}>
                {/* Header */}
                <View
                    style={[
                        styles.fullWidthContainer,
                        styles.bottomBorder,
                        { justifyContent: "flex-start", gap: 10, margin: 0 },
                    ]}
                >
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={22} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.mainTitle}>
                        Saved hangouts
                    </Text>
                </View>

                {loading ? (
                    <View
                        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                    >
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                ) : savedHangouts.length === 0 ? (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "center",
                            opacity: 0.6,
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 18,
                                color: "#000",
                                marginBottom: 8,
                            }}
                        >
                            No saved hangouts
                        </Text>
                        <Text
                            style={{
                                fontFamily: "Inter_400Regular",
                                fontSize: 14,
                                color: "#666",
                            }}
                        >
                            Hangouts you save will appear here
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={savedHangouts}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                        style={{ padding: 5}}
                    />
                )}
        </SafeAreaView>
    );
}
