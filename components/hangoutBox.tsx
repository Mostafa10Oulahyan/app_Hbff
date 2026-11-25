import { styles } from "@/const/style";
import { HangoutBoxProps } from "@/const/types";
import { useRouter } from "expo-router";
import { Clock, MapPin, Users } from "lucide-react-native";
import { Image, Text, TouchableOpacity, View } from "react-native";

export const HangoutBox: React.FC<HangoutBoxProps> = ({
  id,
  title,
  imageUrl,
  time,
  location,
  members,
  mainMembers,
  interests,
}) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/hangout/${id}`)}
    >
      <Image source={{ uri: imageUrl }} style={styles.coverImage} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}>
          <Clock size={14} color="#666" />
          <Text style={styles.infoText}>{time}</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={14} color="#666" />
          <Text style={styles.infoText}>{location}</Text>
        </View>
        <View style={[styles.infoRow, { flexWrap: "wrap", gap: 8 }]}>
          {interests.map((interest, index) => (
            <Text key={index} style={[styles.infoText, styles.tags]}>
              {interest}
            </Text>
          ))}
        </View>
        <View style={styles.footer}>
          <View style={[styles.avatarsRow, { marginBottom: 4 }]}>
            {mainMembers.map((member, index) => (
              <Image
                key={index}
                source={{ uri: member.avatarUrl }}
                style={[styles.avatar, index > 0 && { marginLeft: -10 }]}
              />
            ))}
          </View>
          <View style={styles.membersRow}>
            <Users size={14} color="#666" />
            <Text style={styles.infoText}>{members} going</Text>
          </View>
        </View>
        {/* Join button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push(`/hangout/${id}`)}
        >
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};
