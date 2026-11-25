import ChatAvatar from "@/components/ChatAvatar";
import { styles } from "@/const/style";
import { Conversation } from "@/const/types";
import { useClerkToken } from "@/hooks/useClerkToken";
import getConversations from "@/lib/supabase/queries/getCoversations";
import { removeChannel, subscribeToAllMessages } from "@/lib/supabase/realtime";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Index() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id;
  const getToken = useClerkToken();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }
      const data = await getConversations(userId, accessToken);
      setConversations(data);
    } catch (error) {
      console.error("Error loading conversations:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load messages. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, userId]);

  useEffect(() => {
    void Promise.resolve().then(fetchConversations);
  }, [fetchConversations]);

  // Real-time: refresh conversation list when new messages arrive
  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    let channel: ReturnType<typeof subscribeToAllMessages> | undefined;

    const subscribe = async () => {
      try {
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        if (active) {
          channel = subscribeToAllMessages(accessToken, () => {
            void fetchConversations();
          });
        }
      } catch (error) {
        console.error("Error subscribing to chat updates:", error);
      }
    };
    void subscribe();
    return () => {
      active = false;
      if (channel) removeChannel(channel);
    };
  }, [getToken, user?.id, fetchConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchConversations();
    } finally {
      setRefreshing(false);
    }
  }, [fetchConversations]);

  const retryConversations = () => {
    setLoading(true);
    void fetchConversations();
  };

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const unreadCount = conversations.filter((c) => !c.isRead).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#007AFF"]} tintColor="#007AFF" />
      }
    >
      <View style={[styles.fullWidthContainer, styles.bottomBorder]}>
        <Text style={[styles.mainTitle, { flex: 1 }]}>Messages</Text>
        {unreadCount > 0 && (
          <View
            style={{
              backgroundColor: "#007AFF",
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 2,
              minWidth: 24,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {unreadCount}
            </Text>
          </View>
        )}
      </View>
      <View
        style={[
          styles.fullWidthContainer,
          { flexDirection: "column", alignItems: "flex-start" },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder="Search for chats"
          placeholderTextColor={"#999"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View
        style={[
          styles.fullWidthContainer,
          { flexDirection: "column", alignItems: "flex-start" },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={{ marginTop: 24, alignSelf: "center" }}
          />
        ) : loadError ? (
          <View style={{ alignItems: "center", marginTop: 24, width: "100%" }}>
            <Text style={[styles.infoText, { textAlign: "center" }]}>
              Could not load your conversations. Check your internet connection
              and try again.
            </Text>
            <TouchableOpacity
              onPress={retryConversations}
              style={{
                marginTop: 12,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: "#007AFF",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <Text
            style={[styles.infoText, { alignSelf: "center", marginTop: 24 }]}
          >
            No conversations found
          </Text>
        ) : (
          filtered.map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              onPress={() =>
                router.push({
                  pathname: "/conversation/[id]",
                  params: {
                    id: conversation.id,
                    name: conversation.name,
                    avatarUrl: conversation.avatarUrl,
                    members: String(conversation.members),
                  },
                })
              }
              style={{
                width: "100%",
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#e0e0e0",
              }}
              activeOpacity={0.7}
            >
              <View style={{ position: "relative" }}>
                <ChatAvatar
                  uri={conversation.avatarUrl}
                  size={52}
                  marginRight={12}
                />
                {!conversation.isRead && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 10,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#007AFF",
                      borderWidth: 2,
                      borderColor: "#fff",
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({
                        pathname: "/hangout/[id]",
                        params: { id: conversation.id },
                      });
                    }}
                    activeOpacity={0.6}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#000",
                        fontFamily: conversation.isRead
                          ? "Inter_400Regular"
                          : "Inter_600SemiBold",
                      }}
                      numberOfLines={1}
                    >
                      {conversation.name}
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={{
                      fontSize: 12,
                      color: conversation.isRead ? "#666" : "#007AFF",
                      fontFamily: conversation.isRead
                        ? "Inter_400Regular"
                        : "Inter_600SemiBold",
                    }}
                  >
                    {conversation.time}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: conversation.isRead ? "#666" : "#000",
                    fontFamily: conversation.isRead
                      ? "Inter_400Regular"
                      : "Inter_600SemiBold",
                    marginBottom: 4,
                  }}
                  numberOfLines={1}
                >
                  {conversation.sentBy === "You"
                    ? "You: "
                    : `${conversation.sentBy}: `}
                  {conversation.lastMessage}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Users size={12} color="#999" />
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#999",
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {conversation.members} members
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
