import { styles } from "@/const/style";
import { useRouter } from "expo-router";
import { MapPin, Sparkles, Users } from "lucide-react-native";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { ActivityIndicator } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function GetStarted() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        },
      ]}
    >
      {/* Logo / Brand */}
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: "#007AFF",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Users size={40} color="#fff" />
      </View>

      <Text
        style={[
          styles.mainTitle,
          { fontSize: 32, textAlign: "center", marginBottom: 8 },
        ]}
      >
        HangoutBFF
      </Text>
      <Text
        style={[
          styles.InterFontRegular,
          {
            fontSize: 16,
            color: "#666",
            textAlign: "center",
            marginBottom: 48,
            lineHeight: 24,
          },
        ]}
      >
        Find your people. Plan hangouts.{"\n"}Make memories together.
      </Text>

      {/* Feature highlights */}
      <View style={{ width: "100%", marginBottom: 48, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#E8F2FF",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MapPin size={22} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 15, color: "#000" },
              ]}
            >
              Discover Nearby
            </Text>
            <Text
              style={[styles.InterFontRegular, { fontSize: 13, color: "#666" }]}
            >
              Find hangouts and people near you
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#E8F2FF",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Users size={22} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 15, color: "#000" },
              ]}
            >
              Meet Your Crew
            </Text>
            <Text
              style={[styles.InterFontRegular, { fontSize: 13, color: "#666" }]}
            >
              Connect with people who share your interests
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#E8F2FF",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Sparkles size={22} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 15, color: "#000" },
              ]}
            >
              Plan & Enjoy
            </Text>
            <Text
              style={[styles.InterFontRegular, { fontSize: 13, color: "#666" }]}
            >
              Create hangouts and make unforgettable memories
            </Text>
          </View>
        </View>
      </View>

      {/* CTA Buttons */}
      <TouchableOpacity
        style={[styles.button, { width: "100%", marginBottom: 12 }]}
        onPress={() => router.push("/(auth)/sign-up")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          width: "100%",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#007AFF",
        }}
        onPress={() => router.push("/(auth)/sign-in")}
      >
        <Text style={[styles.buttonText, { color: "#007AFF" }]}>
          I already have an account
        </Text>
      </TouchableOpacity>
    </View>
  );
}
