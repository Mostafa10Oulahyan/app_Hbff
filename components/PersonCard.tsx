import { styles } from "@/const/style";
import { SuggestedPerson } from "@/lib/supabase/queries/getSuggestedPeople";
import { UserPlus } from "lucide-react-native";
import { Image, Text, TouchableOpacity, View } from "react-native";

export const PersonCard: React.FC<SuggestedPerson> = ({
  name,
  avatarUrl,
  mutualFriends,
  isOnline,
}) => {
  return (
    <View style={styles.personCard}>
      <View style={{ position: "relative" }}>
        <Image source={{ uri: avatarUrl }} style={styles.personAvatar} />
        {isOnline && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.personName} numberOfLines={1}>
        {name.split(" ")[0]}
      </Text>
      <Text style={styles.personMeta}>
        {mutualFriends} mutual friend{mutualFriends !== 1 ? "s" : ""}
      </Text>
      <TouchableOpacity style={styles.addFriendButton}>
        <UserPlus size={14} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
};
