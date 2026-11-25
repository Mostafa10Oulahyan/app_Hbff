import ChatAvatar from "@/components/ChatAvatar";
import { styles } from "@/const/style";
import { Message } from "@/const/types";
import { useClerkToken } from "@/hooks/useClerkToken";
import { markAsRead, sendMessage } from "@/lib/supabase/mutations/message";
import { sendGroupPushNotification } from "@/lib/supabase/mutations/push";
import getMessages from "@/lib/supabase/queries/getMessages";
import { getSenderProfile } from "@/lib/supabase/queries/getSenderProfile";
import {
  removeChannel,
  subscribeToGroupMessages,
} from "@/lib/supabase/realtime";
import { useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Reply, Send, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ConversationScreen() {
  const { id, name, avatarUrl, members } = useLocalSearchParams<{
    id: string;
    name: string;
    avatarUrl: string;
    members: string;
  }>();
  const router = useRouter();
  const { user } = useUser();
  const getToken = useClerkToken();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const messagePositions = useRef<Record<string, number>>({});
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const y = messagePositions.current[messageId];
      if (y !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: y - 20, animated: true });
        setHighlightedId(messageId);
        Animated.sequence([
          Animated.timing(highlightAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.delay(800),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ]).start(() => setHighlightedId(null));
      }
    },
    [highlightAnim],
  );

  const handleLayout = useCallback((msgId: string, e: LayoutChangeEvent) => {
    messagePositions.current[msgId] = e.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const loadMessages = async () => {
      try {
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        const data = await getMessages(id, user.id, accessToken);
        if (active) setMessages(data);
      } catch (error) {
        console.error("Error loading messages:", error);
        if (active) setMessages([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMessages();
    return () => {
      active = false;
    };
  }, [getToken, id, user?.id]);

  // Real-time: subscribe to new messages in this group
  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    let active = true;
    let channel: ReturnType<typeof subscribeToGroupMessages> | undefined;

    const subscribe = async () => {
      try {
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        if (!active) return;

        channel = subscribeToGroupMessages(id, accessToken, async (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id === currentUserId) return;

          const sender = await getSenderProfile(newMsg.sender_id);
          const message: Message = {
            id: newMsg.id,
            conversationId: newMsg.group_id,
            text: newMsg.content,
            sentBy: sender?.first_name ?? "",
            avatarUrl: sender?.photo_url ?? "",
            time: new Date(newMsg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isMe: false,
          };

          setMessages((prev) => [...prev, message]);
          setTimeout(
            () => scrollViewRef.current?.scrollToEnd({ animated: true }),
            100,
          );
          await markAsRead([newMsg.id], currentUserId, accessToken);
        });
      } catch (error) {
        console.error("Error subscribing to conversation:", error);
      }
    };
    void subscribe();
    return () => {
      active = false;
      if (channel) removeChannel(channel);
    };
  }, [getToken, id, user?.id]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(
          () => scrollViewRef.current?.scrollToEnd({ animated: true }),
          150,
        );
      },
    );
    return () => showSub.remove();
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user?.id) return;

    const content = text.trim();
    setText("");
    setReplyingTo(null);

    // Optimistic UI: add message immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: id,
      text: content,
      sentBy: "You",
      avatarUrl: user?.imageUrl ?? "",
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      isMe: true,
      ...(replyingTo && {
        replyTo: {
          id: replyingTo.id,
          sentBy: replyingTo.sentBy,
          text: replyingTo.text,
        },
      }),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      100,
    );

    // Send to Supabase
    try {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }
      const result = await sendMessage(
        {
          groupId: id,
          senderId: user.id,
          content,
        },
        accessToken,
      );
      void sendGroupPushNotification(
        { eventType: "message", groupId: id, messageId: result.id },
        accessToken,
      ).catch((error) => {
        console.warn("Message push notification was not sent:", error);
      });
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id
            ? {
              ...optimisticMsg,
              id: result.id,
              time: new Date(result.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              }),
            }
            : m,
        ),
      );
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMsg.id));
      setText((current) => current || content);
      setReplyingTo((current) => current ?? replyingTo);
      Alert.alert(
        "Message not sent",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.fullWidthContainer,
          styles.bottomBorder,
          { gap: 10, paddingVertical: 12 },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#007AFF" />
        </TouchableOpacity>
        <ChatAvatar uri={avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              color: "#000",
              fontFamily: "Inter_600SemiBold",
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Users size={11} color="#999" />
            <Text
              style={{
                fontSize: 12,
                color: "#999",
                fontFamily: "Inter_400Regular",
              }}
            >
              {members} members
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: 10 }}
          contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messages.map((msg, index) => {
            const showAvatar = !msg.isMe;

            return (
              <Animated.View
                key={msg.id}
                onLayout={(e) => handleLayout(msg.id, e)}
                style={{
                  flexDirection: "row",
                  justifyContent: msg.isMe ? "flex-end" : "flex-start",
                  alignItems: "flex-end",
                  gap: 8,
                  backgroundColor:
                    highlightedId === msg.id
                      ? highlightAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          "rgba(0,122,255,0)",
                          "rgba(0,122,255,0.12)",
                        ],
                      })
                      : "transparent",
                  borderRadius: 12,
                  padding: highlightedId === msg.id ? 4 : 0,
                }}
              >
                {!msg.isMe && (
                  <View style={{ width: 28 }}>
                    {showAvatar && (
                      <ChatAvatar uri={msg.avatarUrl} size={28} />
                    )}
                  </View>
                )}
                <View style={{ maxWidth: "75%" }}>
                  <View
                    style={{
                      backgroundColor: msg.isMe ? "#007AFF" : "#f0f0f0",
                      borderRadius: 16,
                      borderBottomRightRadius: msg.isMe ? 4 : 16,
                      borderBottomLeftRadius: msg.isMe ? 16 : 4,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    {/* Reply preview inside bubble — tap to scroll */}
                    {msg.replyTo && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => scrollToMessage(msg.replyTo!.id)}
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: msg.isMe
                            ? "rgba(255,255,255,0.5)"
                            : "#007AFF",
                          paddingLeft: 8,
                          marginBottom: 6,
                          paddingVertical: 4,
                          backgroundColor: msg.isMe
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(0,122,255,0.08)",
                          borderRadius: 4,
                          paddingRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: msg.isMe
                              ? "rgba(255,255,255,0.85)"
                              : "#007AFF",
                            fontFamily: "Inter_600SemiBold",
                            marginBottom: 1,
                          }}
                        >
                          {msg.replyTo.sentBy}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: msg.isMe ? "rgba(255,255,255,0.7)" : "#666",
                            fontFamily: "Inter_400Regular",
                          }}
                          numberOfLines={2}
                        >
                          {msg.replyTo.text}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!msg.isMe && showAvatar && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#007AFF",
                          fontFamily: "Inter_600SemiBold",
                          marginBottom: 2,
                        }}
                      >
                        {msg.sentBy}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 15,
                        color: msg.isMe ? "#fff" : "#000",
                        fontFamily: "Inter_400Regular",
                        lineHeight: 20,
                      }}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: msg.isMe ? "rgba(255,255,255,0.7)" : "#999",
                        fontFamily: "Inter_400Regular",
                        marginTop: 4,
                        textAlign: msg.isMe ? "right" : "left",
                      }}
                    >
                      {msg.time}
                    </Text>
                  </View>
                  {/* Reply button */}
                  <TouchableOpacity
                    onPress={() => {
                      setReplyingTo(msg);
                      inputRef.current?.focus();
                    }}
                    style={{
                      alignSelf: msg.isMe ? "flex-end" : "flex-start",
                      marginBottom: 2,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                    activeOpacity={0.6}
                  >
                    <Reply size={12} color="#999" />
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#999",
                        fontFamily: "Inter_400Regular",
                      }}
                    >
                      Reply
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {/* Input */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#e0e0e0",
          backgroundColor: "#fff",
        }}
      >
        {/* Reply preview bar */}
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: "#f5f5f5",
              borderBottomWidth: 1,
              borderBottomColor: "#e0e0e0",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 3,
                height: "100%",
                backgroundColor: "#007AFF",
                borderRadius: 2,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: "#007AFF",
                  fontFamily: "Inter_600SemiBold",
                  marginBottom: 1,
                }}
              >
                {replyingTo.sentBy}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#666",
                  fontFamily: "Inter_400Regular",
                }}
                numberOfLines={1}
              >
                {replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              activeOpacity={0.7}
            >
              <X size={18} color="#999" />
            </TouchableOpacity>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { flex: 1, paddingVertical: 10 }]}
            placeholder={
              replyingTo ? "Type your reply..." : "Type a message..."
            }
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: text.trim() ? "#007AFF" : "#e0e0e0",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Send size={18} color={text.trim() ? "#fff" : "#999"} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
