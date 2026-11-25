import { styles } from "@/const/style";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, MessageCircle, UserRound } from "lucide-react-native";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const privacySections = [
  {
    icon: UserRound,
    title: "Profile and interests",
    body: "Your name, profile photo, bio, location details, and interests help other people discover and recognize you.",
  },
  {
    icon: MapPin,
    title: "Location and hangouts",
    body: "Location permission helps show nearby hangouts. The location and schedule you add to a hangout are shown with that hangout.",
  },
  {
    icon: MessageCircle,
    title: "Group conversations",
    body: "Messages you send are visible to members of that hangout's group chat. Avoid sharing information you do not want the group to see.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error("Could not open device settings:", error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F9FC" }}>
      <View style={[styles.fullWidthContainer, styles.bottomBorder, { gap: 12 }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 22,
            color: "#1A1A1A",
            marginBottom: 8,
          }}
        >
          Your information in HangoutBFF
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
          Here is what the app uses to help you find and organize group
          activities.
        </Text>

        {privacySections.map(({ icon: Icon, title, body }) => (
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

        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
            color: "#222",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          Manage your choices
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            lineHeight: 19,
            color: "#666",
            marginBottom: 14,
          }}
        >
          Edit profile details in Settings. You can also change HangoutBFF&apos;s
          location permission in your device settings.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          style={{
            backgroundColor: "#007AFF",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "#fff",
            }}
          >
            Edit profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void openDeviceSettings()}
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#DDE3EA",
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "#007AFF",
            }}
          >
            Open device settings
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
