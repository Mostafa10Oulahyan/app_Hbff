import { styles } from "@/const/style";
import { HangoutBoxProps } from "@/const/types";
import { useRouter } from "expo-router";
import { Clock, MapPin, Users } from "lucide-react-native";
import { Image, Text, TouchableOpacity, View } from "react-native";

export const PopularHangoutCard: React.FC<HangoutBoxProps> = ({
  id,
  title,
  imageUrl,
  time,
  location,
  members,
}) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.popularCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/hangout/${id}` as any)}
    >
      <Image source={{ uri: imageUrl }} style={styles.popularCardImage} />
      <View style={styles.popularCardContent}>
        <Text style={styles.popularCardTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.infoRow}>
          <Clock size={12} color="#666" />
          <Text style={[styles.infoText, { fontSize: 11 }]}>{time}</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={12} color="#666" />
          <Text style={[styles.infoText, { fontSize: 11 }]} numberOfLines={1}>
            {location}
          </Text>
        </View>
        <View style={[styles.membersRow, { marginTop: 4 }]}>
          <Users size={12} color="#666" />
          <Text style={[styles.infoText, { fontSize: 11 }]}>
            {members} going
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
