import { Image, View } from "react-native";
import { useState } from "react";
import { Users } from "lucide-react-native";

interface ChatAvatarProps {
  uri?: string | null;
  size: number;
  marginRight?: number;
}

export default function ChatAvatar({
  uri,
  size,
  marginRight = 0,
}: ChatAvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const imageUri = uri?.startsWith("https://") && failedUri !== uri ? uri : null;
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    marginRight,
    backgroundColor: "#e0e0e0",
  };

  if (!imageUri) {
    return (
      <View
        style={[
          style,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Users size={size * 0.45} color="#888" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={style}
      onError={() => setFailedUri(imageUri)}
    />
  );
}
