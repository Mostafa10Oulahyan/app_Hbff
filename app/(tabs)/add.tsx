import { LocationSearch, PlaceResult } from "@/components/LocationSearch";
import { styles } from "@/const/style";
import { useAlert } from "@/context/AlertContext";
import { uploadHangoutCover } from "@/lib/cloudinary/uploadToCloudinary";
import { createHangout } from "@/lib/supabase/mutations/hangout";
import getInterests from "@/lib/supabase/queries/getInterests";
import { useAuth, useUser } from "@clerk/clerk-expo";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Calendar,
  Camera,
  Clock,
  MapPin,
  Users,
  X
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function Add() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxMembers, setMaxMembers] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getInterests()
      .then(setInterests)
      .catch((error) => {
        console.error("Could not load hangout interest options:", error);
      });
  }, []);

  const handlePlaceSelect = (place: PlaceResult) => {
    setLocation(place.displayName);
    setCoords({ lat: place.lat, lng: place.lng });
  };

  const handlePlaceClear = () => {
    setLocation("");
    setCoords(null);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 5
          ? [...prev, interest]
          : prev,
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert(
        "Permission needed",
        "Please grant camera roll permissions to upload a cover photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert(
        "Permission needed",
        "Please grant camera permissions to take a photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleImagePick = () => {
    showAlert("Add Cover Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onDateChange = (
    _event: DateTimePickerChangeEvent,
    selectedDate: Date,
  ) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (
    _event: DateTimePickerChangeEvent,
    selectedTime: Date,
  ) => {
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  const onDateDismiss = () => setShowDatePicker(false);
  const onTimeDismiss = () => setShowTimePicker(false);

  const formatDate = (d: Date): string => {
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (t: Date): string => {
    return t.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreate = async () => {
    if (!user?.id) {
      showAlert("Error", "You must be signed in to create a hangout.");
      return;
    }
    if (!title.trim()) {
      showAlert("Missing info", "Please add a title for your hangout.");
      return;
    }
    if (!location.trim() || !coords) {
      showAlert("Missing info", "Please add a location.");
      return;
    }
    if (!date || !time) {
      showAlert("Missing info", "Please set a date and time.");
      return;
    }

    setCreating(true);
    try {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }

      // Combine date and time into a single Date object
      const scheduledDate = new Date(date);
      scheduledDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
      const scheduledAt = scheduledDate.toISOString();

      // Upload image if selected
      let imageUrl: string | undefined;
      if (imageUri) {
        const uploadedUrl = await uploadHangoutCover(imageUri, accessToken);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const groupId = await createHangout({
        hostId: user.id,
        title: title.trim(),
        description: description.trim(),
        activityType: selectedInterests[0] ?? "General",
        locationName: location,
        locationLat: coords.lat,
        locationLng: coords.lng,
        scheduledAt,
        maxParticipants: maxMembers ? parseInt(maxMembers, 10) : 100,
        interestNames: selectedInterests,
        imageUrl,
      }, accessToken);

      if (groupId) {
        showAlert(
          "Hangout Created!",
          `"${title}" has been created successfully.`,
          [
            {
              text: "View Hangout",
              onPress: () => router.push(`/hangout/${groupId}`),
            },
            { text: "OK" },
          ],
        );
        // Reset form
        setTitle("");
        setLocation("");
        setCoords(null);
        setDate(null);
        setTime(null);
        setMaxMembers("");
        setDescription("");
        setSelectedInterests([]);
        setImageUri(null);
      } else {
        showAlert("Error", "Failed to create hangout. Please try again.");
      }
    } catch (err) {
      console.error("Create hangout error:", err);
      showAlert("Error", "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={[styles.fullWidthContainer, styles.bottomBorder]}>
          <Text style={[styles.mainTitle, { flex: 1 }]}>Create Hangout</Text>
        </View>

        <View style={{ padding: 16, gap: 20 }}>
          {/* Cover Image Picker */}
          <TouchableOpacity
            onPress={handleImagePick}
            activeOpacity={0.7}
            style={{
              width: "100%",
              height: 160,
              borderRadius: 14,
              backgroundColor: imageUri ? "transparent" : "#f5f5f5",
              borderWidth: imageUri ? 0 : 1,
              borderColor: "#e0e0e0",
              borderStyle: "dashed",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              overflow: "hidden",
            }}
          >
            {imageUri ? (
              <View style={{ width: "100%", height: "100%", position: "relative" }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: "100%", borderRadius: 14 }}
                  resizeMode="cover"
                />
                {/* Remove button */}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setImageUri(null);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 14,
                    width: 28,
                    height: 28,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
                {/* Change label */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    paddingVertical: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_600SemiBold",
                      color: "#fff",
                    }}
                  >
                    Tap to change photo
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Camera size={32} color="#999" />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_600SemiBold",
                    color: "#666",
                  }}
                >
                  Add Cover Photo
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: "#999",
                  }}
                >
                  Tap to upload or take a photo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_600SemiBold",
                color: "#000",
              }}
            >
              Title *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Beach Volleyball, Coffee Chat..."
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_600SemiBold",
                color: "#000",
              }}
            >
              Description
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  height: 100,
                  textAlignVertical: "top",
                  paddingTop: 12,
                },
              ]}
              placeholder="Tell people what this hangout is about..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Location */}
          <LocationSearch
            value={location}
            onSelect={handlePlaceSelect}
            onClear={handlePlaceClear}
          />
          {coords && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f5f5f5",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                gap: 6,
                marginTop: -12,
              }}
            >
              <MapPin size={12} color="#999" />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: "#999",
                }}
              >
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            </View>
          )}

          {/* Date & Time row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                }}
              >
                Date *
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  gap: 8,
                }}
              >
                <Calendar size={16} color={date ? "#007AFF" : "#999"} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: date ? "Inter_600SemiBold" : "Inter_400Regular",
                    color: date ? "#000" : "#999",
                    flex: 1,
                  }}
                >
                  {date ? formatDate(date) : "Pick a date"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                }}
              >
                Time *
              </Text>
              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  gap: 8,
                }}
              >
                <Clock size={16} color={time ? "#007AFF" : "#999"} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: time ? "Inter_600SemiBold" : "Inter_400Regular",
                    color: time ? "#000" : "#999",
                    flex: 1,
                  }}
                >
                  {time ? formatTime(time) : "Pick a time"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date/Time Pickers (rendered conditionally) */}
          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant={Platform.OS === "ios" ? "light" : undefined}
              textColor={Platform.OS === "ios" ? "#1A1A2E" : undefined}
              minimumDate={new Date()}
              onValueChange={onDateChange}
              onDismiss={onDateDismiss}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={time || new Date()}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant={Platform.OS === "ios" ? "light" : undefined}
              textColor={Platform.OS === "ios" ? "#1A1A2E" : undefined}
              onValueChange={onTimeChange}
              onDismiss={onTimeDismiss}
            />
          )}

          {/* Max Members */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_600SemiBold",
                color: "#000",
              }}
            >
              Max Members
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f5f5f5",
                borderRadius: 8,
                paddingHorizontal: 12,
              }}
            >
              <Users size={16} color="#999" />
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, backgroundColor: "transparent" },
                ]}
                placeholder="No limit"
                placeholderTextColor="#999"
                value={maxMembers}
                onChangeText={setMaxMembers}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Interests */}
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                }}
              >
                Interests
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: "#666",
                }}
              >
                {selectedInterests.length}/5 selected
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {interests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tags, isSelected && styles.activeTag]}>
                      <Text
                        style={isSelected ? styles.activeTagText : undefined}
                      >
                        {interest}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedInterests.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                {selectedInterests.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#EBF3FF",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Inter_600SemiBold",
                        color: "#007AFF",
                      }}
                    >
                      {interest}
                    </Text>
                    <X size={12} color="#007AFF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Preview summary */}
          {title.trim() !== "" && (
            <View
              style={{
                backgroundColor: "#f5f5f5",
                borderRadius: 14,
                padding: 16,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#666",
                  marginBottom: 4,
                }}
              >
                Preview
              </Text>
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: "100%",
                    height: 120,
                    borderRadius: 10,
                    marginBottom: 4,
                  }}
                  resizeMode="cover"
                />
              )}
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                }}
              >
                {title}
              </Text>
              {location.trim() !== "" && (
                <View style={{ gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MapPin size={14} color="#666" />
                    <Text style={styles.infoText} numberOfLines={1}>
                      {location.split(", ").slice(0, 2).join(", ")}
                    </Text>
                  </View>
                  {coords && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        color: "#999",
                        marginLeft: 20,
                      }}
                    >
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </Text>
                  )}
                </View>
              )}
              {(date || time) && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Calendar size={14} color="#666" />
                  <Text style={styles.infoText}>
                    {[
                      date ? formatDate(date) : "",
                      time ? formatTime(time) : "",
                    ]
                      .filter(Boolean)
                      .join(" at ")}
                  </Text>
                </View>
              )}
              {maxMembers.trim() !== "" && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Users size={14} color="#666" />
                  <Text style={styles.infoText}>Max {maxMembers} members</Text>
                </View>
              )}
              {selectedInterests.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {selectedInterests.map((interest) => (
                    <Text key={interest} style={[styles.infoText, styles.tags]}>
                      {interest}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.button,
              (!title.trim() || creating) && { opacity: 0.5 },
            ]}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Hangout</Text>
            )}
          </TouchableOpacity>

          {/* Bottom spacer */}
          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
