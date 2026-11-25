import { styles } from "@/const/style";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ArrowLeft, CalendarDays, MapPin, MessageCircle } from "lucide-react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const features = [
  {
    icon: MapPin,
    title: "Discover activities",
    body: "Explore hangouts on the map and find activities that interest you.",
  },
  {
    icon: CalendarDays,
    title: "Create or join a group",
    body: "Plan an activity with a time and place, or join a hangout hosted by someone else.",
  },
  {
    icon: MessageCircle,
    title: "Coordinate together",
    body: "Use the group conversation to share details with hangout members.",
  },
];

export default function AppInfoScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "Unavailable";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F9FC" }}>
      <View style={[styles.fullWidthContainer, styles.bottomBorder, { gap: 12 }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>App Info</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#007AFF",
            borderRadius: 18,
            padding: 24,
            marginBottom: 22,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 25,
              color: "#fff",
            }}
          >
            HangoutBFF
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "rgba(255,255,255,0.82)",
              marginTop: 6,
            }}
          >
            Version {version}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 21,
            color: "#1A1A1A",
            marginBottom: 8,
          }}
        >
          Meet up, out in the world
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            lineHeight: 21,
            color: "#666",
            marginBottom: 18,
          }}
        >
          HangoutBFF helps people find and plan shared activities, from a
          casual coffee to a group outing.
        </Text>

        {features.map(({ icon: Icon, title, body }) => (
          <View
            key={title}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 14,
              backgroundColor: "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E8ECF2",
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Icon size={20} color="#007AFF" />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: "#222",
                  marginBottom: 5,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  lineHeight: 19,
                  color: "#666",
                }}
              >
                {body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
