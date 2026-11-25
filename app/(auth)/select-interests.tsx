import { styles } from "@/const/style";
import { useAlert } from "@/context/AlertContext";
import { saveUserInterests } from "@/lib/supabase/mutations/profile";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ArrowRight, Check, Sparkles } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const ALL_INTERESTS = [
  { label: "Sports", emoji: "⚽" },
  { label: "Music", emoji: "🎵" },
  { label: "Art", emoji: "🎨" },
  { label: "Technology", emoji: "💻" },
  { label: "Travel", emoji: "✈️" },
  { label: "Food", emoji: "🍴" },
  { label: "Gaming", emoji: "🎮" },
  { label: "Photography", emoji: "📷" },
  { label: "Fitness", emoji: "💪" },
  { label: "Reading", emoji: "📚" },
  { label: "Movies", emoji: "🎬" },
  { label: "Outdoors", emoji: "🌿" },
  { label: "Cooking", emoji: "👨‍🍳" },
  { label: "Dancing", emoji: "💃" },
  { label: "Yoga", emoji: "🧘" },
  { label: "Board Games", emoji: "🎲" },
  { label: "Volunteering", emoji: "🤝" },
  { label: "Coffee", emoji: "☕" },
];

export default function SelectInterests() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { showAlert } = useAlert();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const onContinue = async () => {
    if (selected.length < 3) {
      showAlert(
        "Select Interests",
        "Please select at least 3 interests to continue.",
      );
      return;
    }
    setLoading(true);
    try {
      if (user?.id) {
        const accessToken = await getToken();
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        const saved = await saveUserInterests(user.id, selected, accessToken);
        if (!saved) {
          throw new Error("Could not save your interests to Supabase.");
        }
      }

      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          interests: selected,
          onboarded: true,
        },
      });
      router.replace("/(tabs)");
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "Failed to save interests. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const meetsMinimum = selected.length >= 3;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 120, paddingHorizontal: 24 }}
      >
        {/* Step indicator */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, gap: 8 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "#007AFF" }} />
          <Text style={[styles.InterFontSemiBold, { fontSize: 12, color: "#8E8E93" }]}>
            Step 2/2
          </Text>
        </View>

        {/* Header */}
        <Text style={[styles.InterFontSemiBold, { fontSize: 30, color: "#1A1A2E", marginBottom: 6, letterSpacing: -0.5 }]}>
          Pick Your Interests
        </Text>
        <Text
          style={[
            styles.InterFontRegular,
            { fontSize: 15, color: "#8E8E93", marginBottom: 20, lineHeight: 22 },
          ]}
        >
          Choose at least 3 to personalize your experience
        </Text>

        {/* Counter Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            backgroundColor: "#fff",
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: meetsMinimum ? "#007AFF" : "#EAEDF2",
          }}
        >
          <Sparkles size={16} color={meetsMinimum ? "#007AFF" : "#B0B0B8"} />
          <Text
            style={[
              styles.InterFontSemiBold,
              {
                fontSize: 13,
                color: meetsMinimum ? "#007AFF" : "#8E8E93",
              },
            ]}
          >
            {selected.length} selected
          </Text>
          {meetsMinimum && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#34C759" }} />
          )}
        </View>

        {/* Interests Grid */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {ALL_INTERESTS.map((interest) => {
            const isSelected = selected.includes(interest.label);
            return (
              <TouchableOpacity
                key={interest.label}
                onPress={() => toggleInterest(interest.label)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 50,
                  borderWidth: 2,
                  borderColor: isSelected ? "#007AFF" : "#EAEDF2",
                  backgroundColor: isSelected ? "#EEF4FF" : "#fff",
                  shadowColor: isSelected ? "#007AFF" : "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isSelected ? 0.12 : 0.04,
                  shadowRadius: 4,
                  elevation: isSelected ? 3 : 1,
                }}
              >
                <Text style={{ fontSize: 18 }}>{interest.emoji}</Text>
                <Text
                  style={[
                    styles.InterFontSemiBold,
                    {
                      fontSize: 14,
                      color: isSelected ? "#007AFF" : "#1A1A2E",
                    },
                  ]}
                >
                  {interest.label}
                </Text>
                {isSelected && (
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: "#007AFF",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Continue Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: 28,
          paddingTop: 16,
          backgroundColor: "#F8F9FB",
          borderTopWidth: 1,
          borderTopColor: "#EAEDF2",
        }}
      >
        <TouchableOpacity
          style={{
            width: "100%",
            backgroundColor: !meetsMinimum || loading ? "#A0C4FF" : "#007AFF",
            paddingVertical: 16,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            shadowColor: "#007AFF",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: meetsMinimum ? 0.25 : 0,
            shadowRadius: 8,
            elevation: meetsMinimum ? 6 : 0,
          }}
          onPress={onContinue}
          disabled={!meetsMinimum || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[styles.InterFontSemiBold, { color: "#fff", fontSize: 16 }]}>
                Get Started
              </Text>
              <ArrowRight size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
