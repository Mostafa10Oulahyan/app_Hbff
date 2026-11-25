import { styles } from "@/const/style";
import { UpcomingHangout } from "@/lib/supabase/queries/getUpcomingHangouts";
import { useRouter } from "expo-router";
import { Clock, MapPin, Users } from "lucide-react-native";
import { Image, Text, TouchableOpacity, View } from "react-native";

export const UpcomingHangoutCard: React.FC<UpcomingHangout> = ({
  id,
  title,
  imageUrl,
  time,
  location,
  members,
  daysUntil,
}) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.upcomingCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/hangout/${id}` as any)}
    >
      <Image source={{ uri: imageUrl }} style={styles.upcomingCardImage} />
      <View style={styles.upcomingCardContent}>
        <Text style={styles.upcomingCardTitle}>{title}</Text>
        <View style={styles.infoRow}>
          <Clock size={12} color="#666" />
          <Text style={[styles.infoText, { fontSize: 12 }]}>{time}</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={12} color="#666" />
          <Text style={[styles.infoText, { fontSize: 12 }]}>{location}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}
        >
          <View style={styles.membersRow}>
            <Users size={12} color="#666" />
            <Text style={[styles.infoText, { fontSize: 11 }]}>
              {members} going
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {daysUntil === 0
                ? "Today"
                : daysUntil === 1
                  ? "Tomorrow"
                  : `In ${daysUntil} days`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
