import { LocationSearch, PlaceResult } from "@/components/LocationSearch";
import { styles } from "@/const/style";
import { HangoutDetailData } from "@/const/types";
import { useAlert } from "@/context/AlertContext";
import { useClerkToken } from "@/hooks/useClerkToken";
import { useSavedHangouts } from "@/hooks/useSavedHangouts";
import { uploadHangoutCover } from "@/lib/cloudinary/uploadToCloudinary";
import { createClerkSupabaseClient } from "@/lib/supabase/clerkSupabase";
import { sendGroupPushNotification } from "@/lib/supabase/mutations/push";
import {
  checkMembership,
  deleteHangout,
  joinHangout,
  leaveHangout,
  removeMember,
  updateHangout,
} from "@/lib/supabase/mutations/hangout";
import getInterests from "@/lib/supabase/queries/getInterests";
import { getHangoutById } from "@/lib/supabase/queries/getHangoutById";
import { useUser } from "@clerk/clerk-expo";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Crown,
  Edit3,
  Heart,
  MapPin,
  MessageSquare,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const REQUEST_TIMEOUT_MS = 20_000;

function withRequestTimeout<T>(request: Promise<T>, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${operation} timed out. Check your connection and try again.`)),
      REQUEST_TIMEOUT_MS,
    );
  });

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

const editFieldLabel = {
  fontSize: 13,
  fontFamily: "Inter_600SemiBold",
  color: "#666",
  marginBottom: 6,
} as const;
const editSecondaryButton = {
  flexDirection: "row",
  alignItems: "center",
  gap: 7,
  borderWidth: 1,
  borderColor: "#E5E5EA",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
} as const;
const editSecondaryButtonText = {
  color: "#007AFF",
  fontFamily: "Inter_600SemiBold",
  fontSize: 13,
} as const;
const editPickerButton = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  borderWidth: 1,
  borderColor: "#E5E5EA",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
} as const;
const editPickerButtonText = {
  color: "#222",
  fontFamily: "Inter_500Medium",
  fontSize: 13,
  flexShrink: 1,
} as const;

export default function HangoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const getToken = useClerkToken();
  const { showAlert } = useAlert();
  const [hangout, setHangout] = useState<HangoutDetailData | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { isSaved, toggleSave } = useSavedHangouts();
  const saved = hangout ? isSaved(hangout.id) : false;
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editTime, setEditTime] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editMaxParticipants, setEditMaxParticipants] = useState("");
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editImageChanged, setEditImageChanged] = useState(false);

  const isHost = hangout?.hostId === user?.id;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const accessToken = await withRequestTimeout(
          getToken(),
          "Getting your Clerk session",
        );
        if (!accessToken) {
          throw new Error("Clerk did not return a session token.");
        }
        const authenticatedSupabase = createClerkSupabaseClient(accessToken);
        const [data, interests] = await Promise.all([
          withRequestTimeout(
            getHangoutById(id, authenticatedSupabase),
            "Fetching hangout details",
          ),
          withRequestTimeout(
            getInterests(authenticatedSupabase),
            "Fetching interest options",
          ),
        ]);
        const isMember =
          data && user?.id
            ? await withRequestTimeout(
                checkMembership(id, user.id, authenticatedSupabase),
                "Checking group membership",
              )
            : false;
        if (!active) return;

        setHangout(data);
        setInterestOptions(interests);
        setJoined(isMember);
      } catch (error) {
        console.error("Error loading hangout details:", error);
        if (active) {
          const message =
            error instanceof Error ? error.message : "Could not load hangout.";
          setLoadError(message);
          showAlert("Error", message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [getToken, id, retryCount, showAlert, user?.id]);

  const handleJoinLeave = async () => {
    if (!user?.id || !hangout) return;
    setActionLoading(true);
    try {
      const accessToken = await withRequestTimeout(
        getToken(),
        "Getting your session",
      );
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }

      if (joined) {
        const result = await withRequestTimeout(
          leaveHangout(id, user.id, accessToken),
          "Leaving hangout",
        );
        if (result.success) {
          setJoined(false);
          setHangout({
            ...hangout,
            currentParticipants: Math.max(0, hangout.currentParticipants - 1),
          });
        } else {
          showAlert("Error", result.error ?? "Could not leave hangout");
        }
      } else {
        const result = await withRequestTimeout(
          joinHangout(id, user.id, accessToken),
          "Joining hangout",
        );
        if (result.success) {
          setJoined(true);
          if (!result.alreadyJoined) {
            setHangout({
              ...hangout,
              currentParticipants: hangout.currentParticipants + 1,
            });
            if (hangout.hostId !== user.id) {
              void sendGroupPushNotification(
                { eventType: "join", groupId: id },
                accessToken,
              ).catch((error) => {
                console.warn("Join push notification was not sent:", error);
              });
            }
          }
        } else {
          showAlert("Error", result.error ?? "Could not join hangout");
        }
      }
    } catch (err) {
      showAlert(
        "Error",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteHangout = () => {
    showAlert(
      "Delete Hangout",
      "Are you sure you want to delete this hangout? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            setActionLoading(true);
            const accessToken = await getToken();
            if (!accessToken) {
              showAlert("Error", "Clerk did not return a session token.");
              setActionLoading(false);
              return;
            }
            const result = await deleteHangout(id, user.id, accessToken);
            if (result.success) {
              router.back();
            } else {
              showAlert("Error", result.error ?? "Could not delete hangout");
            }
            setActionLoading(false);
          },
        },
      ],
    );
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    showAlert(
      "Remove Member",
      `Remove ${memberName} from this hangout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!user?.id || !hangout) return;
            const accessToken = await getToken();
            if (!accessToken) {
              showAlert("Error", "Clerk did not return a session token.");
              return;
            }
            const result = await removeMember(id, memberId, user.id, accessToken);
            if (result.success) {
              setHangout({
                ...hangout,
                members: hangout.members.filter((m) => m.id !== memberId),
                currentParticipants: Math.max(
                  0,
                  hangout.currentParticipants - 1,
                ),
              });
            } else {
              showAlert(
                "Error",
                result.error ?? "Could not remove member",
              );
            }
          },
        },
      ],
    );
  };

  const handleEditHangout = () => {
    if (!hangout) return;
    setEditTitle(hangout.title);
    setEditDescription(hangout.description ?? "");
    setEditLocation(hangout.locationName);
    setEditCoords({ lat: hangout.locationLat, lng: hangout.locationLng });
    const scheduled = new Date(hangout.scheduledAt);
    setEditDate(scheduled);
    setEditTime(scheduled);
    setEditMaxParticipants(String(hangout.maxParticipants));
    setEditInterests(hangout.interests);
    setEditImageUri(hangout.imageUrl || null);
    setEditImageChanged(false);
    setEditModalVisible(true);
  };

  const handleEditLocationSelect = (place: PlaceResult) => {
    setEditLocation(place.displayName);
    setEditCoords({ lat: place.lat, lng: place.lng });
  };

  const toggleEditInterest = (interest: string) => {
    if (editInterests.includes(interest)) {
      setEditInterests(editInterests.filter((item) => item !== interest));
    } else if (editInterests.length >= 5) {
      showAlert("Limit reached", "You can choose up to 5 interests.");
    } else {
      setEditInterests([...editInterests, interest]);
    }
  };

  const handlePickEditImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Permission needed",
          "Please allow photo library access to change the cover image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;

      setEditImageUri(result.assets[0].uri);
      setEditImageChanged(true);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "Could not select an image.",
      );
    }
  };

  const handleEditDateChange = (
    _event: DateTimePickerChangeEvent,
    selectedDate: Date,
  ) => {
    setEditDate(selectedDate);
  };

  const handleEditTimeChange = (
    _event: DateTimePickerChangeEvent,
    selectedTime: Date,
  ) => {
    setEditTime(selectedTime);
  };

  const handleSaveEdit = async () => {
    if (!user?.id || !hangout) return;
    const maxParticipants = Number.parseInt(editMaxParticipants, 10);
    if (!editTitle.trim()) {
      showAlert("Missing title", "Please enter a title for this hangout.");
      return;
    }
    if (!editLocation.trim() || !editCoords) {
      showAlert("Missing location", "Please select a location.");
      return;
    }
    if (!editDate || !editTime) {
      showAlert("Missing date or time", "Please choose a date and time.");
      return;
    }
    if (
      !Number.isInteger(maxParticipants)
      || maxParticipants < Math.max(1, hangout.currentParticipants)
    ) {
      showAlert(
        "Invalid capacity",
        `Capacity must be at least ${Math.max(1, hangout.currentParticipants)}.`,
      );
      return;
    }

    const scheduled = new Date(editDate);
    scheduled.setHours(editTime.getHours(), editTime.getMinutes(), 0, 0);
    setActionLoading(true);
    try {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }

      let imageUrl: string | null | undefined;
      if (editImageChanged) {
        imageUrl = editImageUri
          ? await uploadHangoutCover(editImageUri, accessToken)
          : null;
        if (editImageUri && !imageUrl) {
          throw new Error("Could not upload the cover image. Please try again.");
        }
      }

      const result = await updateHangout(
        id,
        user.id,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          scheduledAt: scheduled.toISOString(),
          locationName: editLocation.trim(),
          locationLat: editCoords.lat,
          locationLng: editCoords.lng,
          maxParticipants,
          activityType: editInterests[0] ?? "General",
          interestNames: editInterests,
          imageUrl,
        },
        accessToken,
      );
      if (!result.success) {
        throw new Error(result.error ?? "Could not update hangout.");
      }

      setHangout({
        ...hangout,
        title: editTitle.trim(),
        description: editDescription.trim(),
        scheduledAt: scheduled.toISOString(),
        scheduledAtFormatted: scheduled.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        locationName: editLocation.trim(),
        locationLat: editCoords.lat,
        locationLng: editCoords.lng,
        maxParticipants,
        activityType: editInterests[0] ?? "General",
        interests: editInterests,
        imageUrl: imageUrl === undefined ? hangout.imageUrl : imageUrl ?? "",
      });
      setEditModalVisible(false);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "Could not update hangout.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!hangout) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={styles.heading}>
          {loadError ? "Could not load hangout" : "Hangout not found"}
        </Text>
        {loadError && (
          <>
            <Text style={{ marginTop: 8, textAlign: "center", color: "#666" }}>
              {loadError}
            </Text>
            <TouchableOpacity
              onPress={() => setRetryCount((count) => count + 1)}
              style={{ marginTop: 16 }}
            >
              <Text style={styles.link}>Try again</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        >
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spotsLeft = hangout.maxParticipants - hangout.currentParticipants;
  const progressPercent =
    (hangout.currentParticipants / hangout.maxParticipants) * 100;

  const scheduledDate = new Date(hangout.scheduledAt);
  const dateFormatted = scheduledDate.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatted = scheduledDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView style={styles.container}>
        {/* Hero Image */}
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: hangout.imageUrl }}
            style={{ width: "100%", height: 300 }}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 140,
            }}
          />
          {/* Back button overlay */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
            }}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          {/* Like button overlay */}
          <View
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              flexDirection: "row",
              gap: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (hangout) {
                  toggleSave({
                    id: hangout.id,
                    title: hangout.title,
                    imageUrl: hangout.imageUrl,
                    date: hangout.scheduledAt,
                    location: hangout.locationName,
                    hostName: hangout.hostName,
                    hostAvatarUrl: hangout.hostAvatarUrl,
                    participants: hangout.currentParticipants,
                    maxParticipants: hangout.maxParticipants,
                    activityType: hangout.activityType || undefined,
                    interests: hangout.interests,
                    members: hangout.currentParticipants,
                  });
                }
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.2)",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <Heart
                size={18}
                color={saved ? "#FF3B30" : "#fff"}
                fill={saved ? "#FF3B30" : "none"}
              />
            </TouchableOpacity>
          </View>
          {/* Status badge on image */}
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 64,
              flexDirection: "row",
              gap: 6,
            }}
          >
            <View
              style={{
                backgroundColor:
                  hangout.status === "active"
                    ? "rgba(52,199,89,0.9)"
                    : hangout.status === "full"
                      ? "rgba(255,149,0,0.9)"
                      : "rgba(142,142,147,0.9)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                  textTransform: "capitalize",
                }}
              >
                {hangout.status}
              </Text>
            </View>
          </View>
          {/* Title on image */}
          <View
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
            }}
          >
            <Text
              style={{
                fontSize: 26,
                fontFamily: "Inter_600SemiBold",
                color: "#fff",
                marginBottom: 4,
              }}
            >
              {hangout.title}
            </Text>
            {hangout.activityType && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.25)",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_600SemiBold",
                      color: "#fff",
                    }}
                  >
                    {hangout.activityType}
                  </Text>
                </View>
                {hangout.mood && (
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.25)",
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Inter_600SemiBold",
                        color: "#fff",
                      }}
                    >
                      {hangout.mood}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={{ padding: 16 }}>
          {/* Host card */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#F0F7FF",
              padding: 14,
              borderRadius: 16,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#D6E8FF",
            }}
          >
            <Image
              source={{ uri: hangout.hostAvatarUrl }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#e0e0e0",
                borderWidth: 2,
                borderColor: "#007AFF",
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                }}
              >
                {hangout.hostName}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Crown size={12} color="#FF9500" />
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                    color: "#FF9500",
                  }}
                >
                  Host
                </Text>
              </View>
            </View>
            {isHost && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={handleEditHangout}
                  activeOpacity={0.7}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: "#007AFF",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Edit3 size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteHangout}
                  activeOpacity={0.7}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: "#FF3B30",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Info rows */}
          <View style={{ gap: 14, marginBottom: 20 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: "#EBF3FF",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Calendar size={20} color="#007AFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                    color: "#000",
                  }}
                >
                  {dateFormatted}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: "#666",
                  }}
                >
                  Add to calendar
                </Text>
              </View>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: "#EBF3FF",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Clock size={20} color="#007AFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                    color: "#000",
                  }}
                >
                  {timeFormatted}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: "#666",
                  }}
                >
                  Start time
                </Text>
              </View>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: "#EBF3FF",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <MapPin size={20} color="#007AFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                    color: "#000",
                  }}
                >
                  {hangout.locationName}
                </Text>
                {hangout.locationAddress && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: "#666",
                    }}
                  >
                    {hangout.locationAddress}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "#F0F0F0",
              marginVertical: 4,
            }}
          />

          {/* About */}
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter_600SemiBold",
              color: "#000",
              marginBottom: 10,
              marginTop: 12,
            }}
          >
            About
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: "#444",
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {hangout.description
              ? hangout.description
              : `Join us for an amazing ${hangout.title.toLowerCase()} session!`}
          </Text>

          {/* Interests */}
          {hangout.interests.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                  marginBottom: 10,
                }}
              >
                Interests
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {hangout.interests.map((interest, index) => (
                  <Text key={index} style={[styles.infoText, styles.tags]}>
                    {interest}
                  </Text>
                ))}
              </View>
            </>
          )}

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "#F0F0F0",
              marginVertical: 4,
            }}
          />

          {/* Members going */}
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter_600SemiBold",
              color: "#000",
              marginBottom: 14,
              marginTop: 12,
            }}
          >
            Who's Going
          </Text>

          {/* Capacity progress bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Users size={16} color="#007AFF" />
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#007AFF",
                }}
              >
                {hangout.currentParticipants} / {hangout.maxParticipants}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                color: spotsLeft > 0 ? "#34C759" : "#FF9500",
              }}
            >
              {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
            </Text>
          </View>

          {/* Progress bar */}
          <View
            style={{
              height: 6,
              backgroundColor: "#F0F0F0",
              borderRadius: 3,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor:
                  progressPercent >= 100 ? "#FF9500" : "#007AFF",
                borderRadius: 3,
              }}
            />
          </View>

          {/* Member list */}
          {hangout.members.map((member) => (
            <View
              key={member.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                paddingVertical: 6,
                paddingHorizontal: 10,
                backgroundColor:
                  member.role === "host" ? "#F0F7FF" : "transparent",
                borderRadius: 12,
              }}
            >
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: member.avatarUrl }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#e0e0e0",
                    borderWidth: member.role === "host" ? 2 : 0,
                    borderColor:
                      member.role === "host" ? "#007AFF" : "transparent",
                  }}
                />
                {member.role === "host" && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "#FF9500",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 2,
                      borderColor: "#fff",
                    }}
                  >
                    <Crown size={9} color="#fff" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_600SemiBold",
                    color: "#000",
                  }}
                >
                  {member.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: member.role === "host" ? "#FF9500" : "#666",
                  }}
                >
                  {member.role === "host" ? "Host" : "Member"}
                </Text>
              </View>
              {/* Host can remove non-host members */}
              {isHost && member.role !== "host" && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(member.id, member.name)}
                  activeOpacity={0.7}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "#FFF0F0",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <UserMinus size={15} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Bottom spacer for button */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Fixed bottom bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_400Regular",
              color: "#666",
            }}
          >
            {joined ? "You're going!" : "Free to join"}
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Inter_600SemiBold",
              color: "#000",
            }}
          >
            {hangout.scheduledAtFormatted}
          </Text>
        </View>

        {/* See Chat button — only if joined */}
        {joined && (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#F0F7FF",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#D6E8FF",
            }}
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: {
                  id: hangout.id,
                  name: hangout.title,
                  avatarUrl: hangout.imageUrl,
                  members: String(hangout.currentParticipants),
                },
              })
            }
            activeOpacity={0.7}
          >
            <MessageSquare size={16} color="#007AFF" />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_600SemiBold",
                color: "#007AFF",
              }}
            >
              Chat
            </Text>
          </TouchableOpacity>
        )}

        {/* Join / Leave button */}
        <TouchableOpacity
          style={[
            styles.button,
            {
              flex: 1,
              backgroundColor: joined ? "#F0F0F0" : "#007AFF",
              opacity: actionLoading ? 0.6 : 1,
              borderRadius: 10,
            },
          ]}
          onPress={handleJoinLeave}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          {actionLoading ? (
            <ActivityIndicator color={joined ? "#666" : "#fff"} />
          ) : (
            <Text
              style={[styles.buttonText, { color: joined ? "#666" : "#fff" }]}
            >
              {joined ? "Leave" : "Join Hangout"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 32,
              maxHeight: "92%",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Inter_600SemiBold",
                    color: "#000",
                  }}
                >
                  Edit Hangout
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Inter_600SemiBold",
                      color: "#FF3B30",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={editFieldLabel}>Cover image</Text>
              {editImageUri ? (
                <Image
                  source={{ uri: editImageUri }}
                  style={{
                    width: "100%",
                    height: 160,
                    borderRadius: 12,
                    marginBottom: 10,
                    backgroundColor: "#F2F2F7",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    height: 120,
                    borderRadius: 12,
                    marginBottom: 10,
                    backgroundColor: "#F2F2F7",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#777", fontFamily: "Inter_400Regular" }}>
                    No cover image
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
                <TouchableOpacity
                  onPress={handlePickEditImage}
                  style={editSecondaryButton}
                >
                  <Camera size={16} color="#007AFF" />
                  <Text style={editSecondaryButtonText}>
                    {editImageUri ? "Change cover" : "Add cover"}
                  </Text>
                </TouchableOpacity>
                {editImageUri && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditImageUri(null);
                      setEditImageChanged(true);
                    }}
                    style={editSecondaryButton}
                  >
                    <Text style={[editSecondaryButtonText, { color: "#FF3B30" }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={editFieldLabel}>Title</Text>
              <TextInput
                style={[styles.input, { marginBottom: 16 }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Hangout title"
                maxLength={100}
              />

              <Text style={editFieldLabel}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    marginBottom: 18,
                    minHeight: 100,
                    textAlignVertical: "top",
                  },
                ]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Tell people about this hangout..."
                multiline
              />

              <Text style={editFieldLabel}>Location</Text>
              <LocationSearch
                value={editLocation}
                onSelect={handleEditLocationSelect}
                onClear={() => {
                  setEditLocation("");
                  setEditCoords(null);
                }}
              />

              <Text style={[editFieldLabel, { marginTop: 16 }]}>Date and time</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowEditDatePicker(true)}
                  style={editPickerButton}
                >
                  <Calendar size={17} color="#007AFF" />
                  <Text style={editPickerButtonText}>
                    {editDate
                      ? editDate.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Choose date"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowEditTimePicker(true)}
                  style={editPickerButton}
                >
                  <Clock size={17} color="#007AFF" />
                  <Text style={editPickerButtonText}>
                    {editTime
                      ? editTime.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Choose time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {showEditDatePicker && (
                <DateTimePicker
                  value={editDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="light"
                  textColor="#000"
                  onValueChange={handleEditDateChange}
                  onDismiss={() => setShowEditDatePicker(false)}
                />
              )}
              {showEditTimePicker && (
                <DateTimePicker
                  value={editTime ?? new Date()}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="light"
                  textColor="#000"
                  onValueChange={handleEditTimeChange}
                  onDismiss={() => setShowEditTimePicker(false)}
                />
              )}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 18,
                  marginBottom: 8,
                }}
              >
                <Text style={[editFieldLabel, { marginBottom: 0 }]}>Interests</Text>
                <Text style={{ color: "#777", fontSize: 12 }}>
                  {editInterests.length}/5
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                {interestOptions.map((interest) => {
                  const selected = editInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      onPress={() => toggleEditInterest(interest)}
                      style={{
                        borderRadius: 20,
                        paddingHorizontal: 13,
                        paddingVertical: 8,
                        backgroundColor: selected ? "#007AFF" : "#F2F2F7",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : "#444",
                          fontFamily: "Inter_500Medium",
                          fontSize: 13,
                        }}
                      >
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={editFieldLabel}>Maximum participants</Text>
              <TextInput
                style={[styles.input, { marginBottom: 22 }]}
                value={editMaxParticipants}
                onChangeText={setEditMaxParticipants}
                placeholder="e.g. 10"
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    opacity: actionLoading ? 0.6 : 1,
                    borderRadius: 12,
                  },
                ]}
                onPress={handleSaveEdit}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
