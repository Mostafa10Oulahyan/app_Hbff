import { styles } from "@/const/style";
import { useClerkToken } from "@/hooks/useClerkToken";
import { uploadAvatar } from "@/lib/cloudinary/uploadToCloudinary";
import {
    updateProfileDetails,
    updateProfilePhoto,
    saveUserInterests,
} from "@/lib/supabase/mutations/profile";
import { createClerkSupabaseClient } from "@/lib/supabase/clerkSupabase";
import { useUser } from "@clerk/clerk-expo";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    ArrowLeft,
    Camera,
    Check,
    ChevronDown,
    Heart,
    MapPin,
    Pencil,
    User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const GENDER_OPTIONS = ["Male", "Female", "Other"];

export default function SettingsScreen() {
    const { user } = useUser();
    const userId = user?.id;
    const userFirstName = user?.firstName;
    const userLastName = user?.lastName;
    const getToken = useClerkToken();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [savingInterests, setSavingInterests] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [interestOptions, setInterestOptions] = useState<string[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

    // Clerk fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // Supabase fields
    const [bio, setBio] = useState("");
    const [gender, setGender] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [showGenderPicker, setShowGenderPicker] = useState(false);

    // Avatar preview (local URI while uploading)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;
        let isCurrent = true;

        const loadData = async () => {
            setLoading(true);
            setLoadError(false);
            try {
                const accessToken = await getToken();
                if (!accessToken) {
                    throw new Error("Clerk did not return a session token.");
                }
                const supabase = createClerkSupabaseClient(accessToken);
                const [profileResult, interestsResult, selectedInterestsResult] =
                    await Promise.all([
                        supabase
                            .from("profiles")
                            .select("bio, gender, city, country")
                            .eq("id", userId)
                            .maybeSingle(),
                        supabase
                            .from("interests")
                            .select("category_name")
                            .order("category_name", { ascending: true }),
                        supabase
                            .from("user_interests")
                            .select("interests:interest_id(category_name)")
                            .eq("user_id", userId),
                ]);
                const queryError =
                    profileResult.error ??
                    interestsResult.error ??
                    selectedInterestsResult.error;
                if (queryError) throw queryError;
                if (!isCurrent) return;

                setFirstName(userFirstName || "");
                setLastName(userLastName || "");
                setInterestOptions(
                    interestsResult.data?.map((item) => item.category_name) ?? [],
                );
                setSelectedInterests(
                    (selectedInterestsResult.data ?? [])
                        .flatMap((item) => {
                            const relation: unknown = item.interests;
                            const relatedInterests = Array.isArray(relation)
                                ? relation
                                : [relation];
                            return relatedInterests.flatMap((interest) => {
                                if (
                                    typeof interest !== "object" ||
                                    interest === null ||
                                    !("category_name" in interest)
                                ) {
                                    return [];
                                }
                                return typeof interest.category_name === "string"
                                    ? [interest.category_name]
                                    : [];
                            });
                        }),
                );
                const profile = profileResult.data;
                if (profile) {
                    setBio(profile.bio || "");
                    setGender(profile.gender || "");
                    setCity(profile.city || "");
                    setCountry(profile.country || "");
                }
            } catch (error) {
                console.error("Settings load error:", error);
                if (isCurrent) setLoadError(true);
            } finally {
                if (isCurrent) setLoading(false);
            }
        };

        void loadData();
        return () => {
            isCurrent = false;
        };
    }, [userId, userFirstName, userLastName, getToken, retryCount]);

    const toggleInterest = (interest: string) => {
        if (selectedInterests.includes(interest)) {
            setSelectedInterests(
                selectedInterests.filter((item) => item !== interest),
            );
        } else if (selectedInterests.length >= 5) {
            Alert.alert("Limit reached", "You can choose up to 5 interests.");
        } else {
            setSelectedInterests([...selectedInterests, interest]);
        }
    };

    const handleSaveInterests = async () => {
        if (!user?.id || loadError) return;
        setSavingInterests(true);
        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }
            const saved = await saveUserInterests(
                user.id,
                selectedInterests,
                accessToken,
            );
            if (!saved) {
                throw new Error("Could not save your interests. Please try again.");
            }
            Alert.alert("Success", "Your interests have been updated.");
        } catch (error) {
            console.error("Save interests error:", error);
            Alert.alert(
                "Error",
                error instanceof Error ? error.message : "Could not save interests.",
            );
        } finally {
            setSavingInterests(false);
        }
    };

    const handleChangePhoto = async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission needed",
                "Please grant photo library access to change your photo.",
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled || !result.assets[0]) return;

        const localUri = result.assets[0].uri;
        setAvatarPreview(localUri);
        setUploadingPhoto(true);

        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }

            // 1. Upload to Cloudinary (compressed 400x400)
            const cloudinaryUrl = await uploadAvatar(localUri, accessToken);
            if (!cloudinaryUrl) {
                Alert.alert("Error", "Failed to upload photo. Try again.");
                setAvatarPreview(null);
                return;
            }

            // 2. Update Clerk profile image using base64
            try {
                const file = new File(localUri);
                const base64 = await file.base64();
                const dataUri = `data:image/jpeg;base64,${base64}`;
                await user?.setProfileImage({ file: dataUri });
            } catch (clerkErr) {
                console.error("Clerk setProfileImage error:", clerkErr);
                // Continue to save Cloudinary URL in Supabase even if Clerk fails
            }

            // 3. Update Supabase photo_url with Cloudinary URL
            if (user?.id) {
                const saved = await updateProfilePhoto(user.id, cloudinaryUrl, accessToken);
                if (!saved) {
                    throw new Error("Could not save the profile photo to Supabase.");
                }
            }

            Alert.alert("Done", "Profile photo updated!");
        } catch (err) {
            console.error("Photo update error:", err);
            Alert.alert("Error", "Something went wrong updating your photo.");
            setAvatarPreview(null);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            await user.update({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }
            const saved = await updateProfileDetails({
                userId: user.id,
                bio: bio.trim(),
                gender,
                city: city.trim(),
                country: country.trim(),
            }, accessToken);
            if (!saved) {
                throw new Error("Could not save profile details to Supabase.");
            }

            Alert.alert("Success", "Your profile has been updated.");
        } catch (err) {
            console.error("Save error:", err);
            Alert.alert("Error", "Failed to save changes. Please try again.");
        } finally {
            setSaving(false);
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

    if (loadError) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 24,
                    },
                ]}
            >
                <Text
                    style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 17,
                        color: "#1a1a1a",
                        marginBottom: 8,
                        textAlign: "center",
                    }}
                >
                    Could not load your settings
                </Text>
                <Text
                    style={{
                        color: "#777",
                        fontSize: 14,
                        marginBottom: 20,
                        textAlign: "center",
                    }}
                >
                    Check your connection and try again.
                </Text>
                <TouchableOpacity
                    onPress={() => setRetryCount((count) => count + 1)}
                    style={{
                        backgroundColor: "#007AFF",
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 12,
                    }}
                >
                    <Text
                        style={{
                            color: "#fff",
                            fontFamily: "Inter_600SemiBold",
                        }}
                    >
                        Retry
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    const displayImageUri =
        avatarPreview || user?.imageUrl || null;

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: "#FAFBFD" }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    backgroundColor: "#fff",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f0f0f0",
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: "#F0F7FF",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <ArrowLeft size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <Text
                        style={{
                            fontSize: 22,
                            fontFamily: "Inter_600SemiBold",
                            color: "#007AFF",
                        }}
                    >
                        Settings
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: "#007AFF",
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 13,
                                color: "#fff",
                            }}
                        >
                            Save
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Avatar Section */}
                <TouchableOpacity
                    onPress={handleChangePhoto}
                    disabled={uploadingPhoto}
                    activeOpacity={0.7}
                    style={{ alignItems: "center", marginBottom: 28 }}
                >
                    <View style={{ position: "relative" }}>
                        {displayImageUri ? (
                            <Image
                                source={{ uri: displayImageUri }}
                                style={{
                                    width: 90,
                                    height: 90,
                                    borderRadius: 45,
                                    borderWidth: 3,
                                    borderColor: "#007AFF",
                                    opacity: uploadingPhoto ? 0.5 : 1,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 90,
                                    height: 90,
                                    borderRadius: 45,
                                    backgroundColor: "#E8F2FF",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderWidth: 3,
                                    borderColor: "#007AFF",
                                }}
                            >
                                <User size={40} color="#007AFF" />
                            </View>
                        )}
                        {uploadingPhoto ? (
                            <View
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    justifyContent: "center",
                                    alignItems: "center",
                                }}
                            >
                                <ActivityIndicator
                                    size="small"
                                    color="#007AFF"
                                />
                            </View>
                        ) : (
                            <View
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: -2,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: "#007AFF",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderWidth: 3,
                                    borderColor: "#fff",
                                }}
                            >
                                <Camera size={14} color="#fff" />
                            </View>
                        )}
                    </View>
                    <Text
                        style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: uploadingPhoto ? "#007AFF" : "#999",
                            marginTop: 8,
                        }}
                    >
                        {uploadingPhoto
                            ? "Uploading..."
                            : "Tap to change photo"}
                    </Text>
                </TouchableOpacity>

                {/* Account Section */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        borderWidth: 1,
                        borderColor: "#f0f0f0",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 18,
                        }}
                    >
                        <Pencil size={16} color="#007AFF" />
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 16,
                                color: "#1a1a1a",
                            }}
                        >
                            Account
                        </Text>
                    </View>

                    <FieldLabel label="First Name" />
                    <StyledInput
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First name"
                    />

                    <FieldLabel label="Last Name" />
                    <StyledInput
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last name"
                    />

                    <FieldLabel label="Email" />
                    <View
                        style={{
                            backgroundColor: "#f8f8f8",
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#eee",
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "Inter_400Regular",
                                color: "#aaa",
                                fontSize: 14,
                            }}
                        >
                            {user?.primaryEmailAddress?.emailAddress || "—"}
                        </Text>
                    </View>
                    <Text
                        style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 11,
                            color: "#bbb",
                            marginTop: 4,
                        }}
                    >
                        Managed by Clerk
                    </Text>
                </View>

                {/* Profile Section */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        borderWidth: 1,
                        borderColor: "#f0f0f0",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 18,
                        }}
                    >
                        <User size={16} color="#007AFF" />
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 16,
                                color: "#1a1a1a",
                            }}
                        >
                            Profile
                        </Text>
                    </View>

                    <FieldLabel label="Bio" />
                    <TextInput
                        style={{
                            backgroundColor: "#f8f8f8",
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#eee",
                            fontFamily: "Inter_400Regular",
                            fontSize: 14,
                            height: 100,
                            textAlignVertical: "top",
                            color: "#333",
                        }}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about yourself..."
                        placeholderTextColor="#bbb"
                        multiline
                        numberOfLines={4}
                    />

                    <FieldLabel label="Gender" />
                    <TouchableOpacity
                        style={{
                            backgroundColor: "#f8f8f8",
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#eee",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                        onPress={() => setShowGenderPicker(!showGenderPicker)}
                    >
                        <Text
                            style={{
                                fontFamily: "Inter_400Regular",
                                color: gender ? "#333" : "#bbb",
                                fontSize: 14,
                            }}
                        >
                            {gender || "Select gender"}
                        </Text>
                        <ChevronDown size={18} color="#999" />
                    </TouchableOpacity>
                    {showGenderPicker && (
                        <View
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: 12,
                                marginTop: 6,
                                borderWidth: 1,
                                borderColor: "#eee",
                                overflow: "hidden",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 6,
                                elevation: 3,
                            }}
                        >
                            {GENDER_OPTIONS.map((option, index) => (
                                <TouchableOpacity
                                    key={option}
                                    style={{
                                        padding: 14,
                                        borderBottomWidth:
                                            index < GENDER_OPTIONS.length - 1
                                                ? 1
                                                : 0,
                                        borderBottomColor: "#f5f5f5",
                                        backgroundColor:
                                            gender === option
                                                ? "#F0F7FF"
                                                : "#fff",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                    }}
                                    onPress={() => {
                                        setGender(option);
                                        setShowGenderPicker(false);
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily:
                                                gender === option
                                                    ? "Inter_600SemiBold"
                                                    : "Inter_400Regular",
                                            color:
                                                gender === option
                                                    ? "#007AFF"
                                                    : "#333",
                                            fontSize: 14,
                                        }}
                                    >
                                        {option}
                                    </Text>
                                    {gender === option && (
                                        <Check size={16} color="#007AFF" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Location Section */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        borderWidth: 1,
                        borderColor: "#f0f0f0",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 18,
                        }}
                    >
                        <MapPin size={16} color="#007AFF" />
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 16,
                                color: "#1a1a1a",
                            }}
                        >
                            Location
                        </Text>
                    </View>

                    <FieldLabel label="City" />
                    <StyledInput
                        value={city}
                        onChangeText={setCity}
                        placeholder="Your city"
                    />

                    <FieldLabel label="Country" />
                    <StyledInput
                        value={country}
                        onChangeText={setCountry}
                        placeholder="Your country"
                    />
                </View>

                {/* Interests Section */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        borderWidth: 1,
                        borderColor: "#f0f0f0",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Heart size={16} color="#007AFF" />
                            <Text
                                style={{
                                    fontFamily: "Inter_600SemiBold",
                                    fontSize: 16,
                                    color: "#1a1a1a",
                                }}
                            >
                                Interests
                            </Text>
                        </View>
                        <Text style={{ color: "#777", fontSize: 12 }}>
                            {selectedInterests.length}/5
                        </Text>
                    </View>
                    <Text
                        style={{
                            color: "#777",
                            fontFamily: "Inter_400Regular",
                            fontSize: 13,
                            marginBottom: 14,
                        }}
                    >
                        Choose up to 5 interests to personalize your hangouts.
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 18,
                        }}
                    >
                        {interestOptions.map((interest) => {
                            const selected = selectedInterests.includes(interest);
                            return (
                                <TouchableOpacity
                                    key={interest}
                                    onPress={() => toggleInterest(interest)}
                                    activeOpacity={0.75}
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
                    <TouchableOpacity
                        onPress={handleSaveInterests}
                        disabled={savingInterests || loadError}
                        activeOpacity={0.85}
                        style={{
                            backgroundColor: "#007AFF",
                            paddingVertical: 13,
                            borderRadius: 12,
                            opacity: savingInterests ? 0.6 : 1,
                        }}
                    >
                        {savingInterests ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text
                                style={{
                                    fontFamily: "Inter_600SemiBold",
                                    fontSize: 14,
                                    color: "#fff",
                                    textAlign: "center",
                                }}
                            >
                                Save Interests
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={{
                        backgroundColor: "#007AFF",
                        paddingVertical: 16,
                        borderRadius: 14,
                        marginTop: 12,
                        shadowColor: "#007AFF",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text
                            style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 16,
                                color: "#fff",
                                textAlign: "center",
                            }}
                        >
                            Save Changes
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function FieldLabel({ label }: { label: string }) {
    return (
        <Text
            style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: "#888",
                marginBottom: 6,
                marginTop: 14,
                textTransform: "uppercase",
                letterSpacing: 0.5,
            }}
        >
            {label}
        </Text>
    );
}

function StyledInput({
    value,
    onChangeText,
    placeholder,
}: {
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
}) {
    return (
        <TextInput
            style={{
                backgroundColor: "#f8f8f8",
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#eee",
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: "#333",
            }}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#bbb"
        />
    );
}
