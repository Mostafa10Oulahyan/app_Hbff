import { CityCountryPicker } from "@/components/CityCountryPicker";
import { styles } from "@/const/style";
import { useAlert } from "@/context/AlertContext";
import {
    updateProfileDetails,
    upsertProfile,
} from "@/lib/supabase/mutations/profile";
import { useAuth, useUser } from "@clerk/clerk-expo";
import DateTimePicker, {
    type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import {
    ArrowRight,
    Calendar,
    ChevronDown,
    MapPin,
    Pencil,
    User,
} from "lucide-react-native";
import { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const GENDER_OPTIONS = [
    { label: "Male", icon: "♂" },
    { label: "Female", icon: "♀" },
] as const;

export default function CompleteProfile() {
    const router = useRouter();
    const { user } = useUser();
    const { getToken } = useAuth();
    const { showAlert } = useAlert();

    const [bio, setBio] = useState("");
    const [gender, setGender] = useState<string>("");
    const [birthdate, setBirthdate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [loading, setLoading] = useState(false);

    const getAge = (date: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age;
    };

    const onDateChange = (
        _event: DateTimePickerChangeEvent,
        selectedDate: Date,
    ) => {
        if (selectedDate) {
            setBirthdate(selectedDate);
        }
    };

    const onDateDismiss = () => {
        setShowDatePicker(false);
    };

    const formatDate = (d: Date): string => {
        return d.toLocaleDateString([], {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const handleCitySelect = ({ city: selectedCity, country: selectedCountry }: { city: string; country: string }) => {
        setCity(selectedCity);
        setCountry(selectedCountry);
    };

    const onContinue = async () => {
        if (!user?.id) return;

        if (!gender) {
            showAlert("Missing info", "Please select your gender.");
            return;
        }
        if (!birthdate) {
            showAlert("Missing info", "Please enter your birthdate.");
            return;
        }
        if (getAge(birthdate) < 18) {
            showAlert(
                "Age Requirement",
                "You must be at least 18 years old to use HangoutBFF.",
            );
            return;
        }
        if (!city.trim()) {
            showAlert("Missing info", "Please select your city.");
            return;
        }
        if (!country.trim()) {
            showAlert("Missing info", "Please select your country.");
            return;
        }

        setLoading(true);
        try {
            const accessToken = await getToken();
            if (!accessToken) {
                throw new Error("Clerk did not return a session token.");
            }

            const profileCreated = await upsertProfile({
                id: user.id,
                firstName: user.firstName ?? "User",
                photoUrl: user.imageUrl ?? undefined,
            }, accessToken);
            if (!profileCreated) {
                throw new Error("Could not create your Supabase profile.");
            }

            const success = await updateProfileDetails({
                userId: user.id,
                bio: bio.trim(),
                gender: gender.toLowerCase(),
                city: city.trim(),
                country: country.trim(),
            }, accessToken);

            if (success) {
                await user.update({
                    unsafeMetadata: {
                        ...user.unsafeMetadata,
                        profileCompleted: true,
                    },
                });
                router.replace("/(auth)/select-interests");
            } else {
                showAlert("Error", "Failed to save profile. Please try again.");
            }
        } catch (error) {
            showAlert(
                "Error",
                error instanceof Error ? error.message : "Something went wrong. Please try again.",
            );
        } finally {
            setLoading(false);
        }
    };

    // Calculate progress for the step indicator
    const filledFields = [bio.trim(), gender, birthdate, city && country].filter(Boolean).length;
    const progress = filledFields / 4;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#F8F9FB" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: 24,
                    paddingTop: 60,
                    paddingBottom: 120,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Step indicator */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E0E5EC" }}>
                        <View style={{ width: `${Math.max(progress * 100, 5)}%`, height: 4, borderRadius: 2, backgroundColor: "#007AFF" }} />
                    </View>
                    <Text style={[styles.InterFontSemiBold, { fontSize: 12, color: "#8E8E93" }]}>
                        Step 1/2
                    </Text>
                </View>

                {/* Header */}
                <Text style={[styles.InterFontSemiBold, { fontSize: 30, color: "#1A1A2E", marginBottom: 6, letterSpacing: -0.5 }]}>
                    Complete Your Profile
                </Text>
                <Text
                    style={[
                        styles.InterFontRegular,
                        { fontSize: 15, color: "#8E8E93", marginBottom: 32, lineHeight: 22 },
                    ]}
                >
                    Tell us a bit about yourself so others can find you
                </Text>

                {/* Bio Section */}
                <View style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "#EAEDF2",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center" }}>
                            <Pencil size={16} color="#007AFF" />
                        </View>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 15, color: "#1A1A2E" }]}>
                            Bio
                        </Text>
                        <Text style={[styles.InterFontRegular, { fontSize: 12, color: "#B0B0B8", marginLeft: "auto" }]}>
                            Optional
                        </Text>
                    </View>
                    <TextInput
                        style={[
                            styles.InterFontRegular,
                            {
                                backgroundColor: "#F8F9FB",
                                borderRadius: 12,
                                padding: 14,
                                height: 90,
                                textAlignVertical: "top",
                                fontSize: 14,
                                color: "#1A1A2E",
                                borderWidth: 1,
                                borderColor: "#EAEDF2",
                            },
                        ]}
                        placeholder="Write a short bio about yourself..."
                        placeholderTextColor="#B0B0B8"
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        maxLength={200}
                    />
                    <Text
                        style={[
                            styles.InterFontRegular,
                            {
                                fontSize: 11,
                                color: bio.length > 150 ? "#FF9500" : "#B0B0B8",
                                textAlign: "right",
                                marginTop: 6,
                            },
                        ]}
                    >
                        {bio.length}/200
                    </Text>
                </View>

                {/* Gender Section */}
                <View style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "#EAEDF2",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F0E6FF", alignItems: "center", justifyContent: "center" }}>
                            <User size={16} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 15, color: "#1A1A2E" }]}>
                            Gender
                        </Text>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 11, color: "#FF3B30" }]}>*</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        {GENDER_OPTIONS.map((option) => {
                            const isSelected = gender === option.label;
                            return (
                                <TouchableOpacity
                                    key={option.label}
                                    onPress={() => setGender(option.label)}
                                    activeOpacity={0.7}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingVertical: 16,
                                        borderRadius: 14,
                                        borderWidth: 2,
                                        borderColor: isSelected ? "#007AFF" : "#EAEDF2",
                                        backgroundColor: isSelected ? "#EEF4FF" : "#F8F9FB",
                                    }}
                                >
                                    <Text style={{ fontSize: 20 }}>{option.icon}</Text>
                                    <Text
                                        style={[
                                            styles.InterFontSemiBold,
                                            {
                                                fontSize: 15,
                                                color: isSelected ? "#007AFF" : "#666",
                                            },
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Birthdate Section */}
                <View style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "#EAEDF2",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#FFF3E0", alignItems: "center", justifyContent: "center" }}>
                            <Calendar size={16} color="#FF9500" />
                        </View>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 15, color: "#1A1A2E" }]}>
                            Birthdate
                        </Text>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 11, color: "#FF3B30" }]}>*</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#F8F9FB",
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 16,
                            gap: 10,
                            borderWidth: 1,
                            borderColor: birthdate ? "#007AFF" : "#EAEDF2",
                        }}
                    >
                        <Calendar size={18} color={birthdate ? "#007AFF" : "#B0B0B8"} />
                        <Text
                            style={[
                                birthdate ? styles.InterFontSemiBold : styles.InterFontRegular,
                                {
                                    fontSize: 14,
                                    color: birthdate ? "#1A1A2E" : "#B0B0B8",
                                    flex: 1,
                                },
                            ]}
                        >
                            {birthdate ? formatDate(birthdate) : "Select your birthdate"}
                        </Text>
                        <ChevronDown size={16} color="#B0B0B8" />
                    </TouchableOpacity>
                    {birthdate && (
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 10,
                            paddingHorizontal: 4,
                        }}>
                            <View style={{
                                width: 6, height: 6, borderRadius: 3,
                                backgroundColor: getAge(birthdate) >= 18 ? "#34C759" : "#FF3B30",
                            }} />
                            <Text
                                style={[
                                    styles.InterFontRegular,
                                    {
                                        fontSize: 12,
                                        color: getAge(birthdate) >= 18 ? "#34C759" : "#FF3B30",
                                    },
                                ]}
                            >
                                {getAge(birthdate) >= 18
                                    ? `${getAge(birthdate)} years old`
                                    : `You must be at least 18 years old`}
                            </Text>
                        </View>
                    )}
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={birthdate || new Date(2000, 0, 1)}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        themeVariant={Platform.OS === "ios" ? "light" : undefined}
                        textColor={Platform.OS === "ios" ? "#1A1A2E" : undefined}
                        maximumDate={new Date()}
                        minimumDate={new Date(1920, 0, 1)}
                        onValueChange={onDateChange}
                        onDismiss={onDateDismiss}
                    />
                )}

                {/* Location Section */}
                <View style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "#EAEDF2",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" }}>
                            <MapPin size={16} color="#34C759" />
                        </View>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 15, color: "#1A1A2E" }]}>
                            Location
                        </Text>
                        <Text style={[styles.InterFontSemiBold, { fontSize: 11, color: "#FF3B30" }]}>*</Text>
                    </View>
                    <CityCountryPicker
                        city={city}
                        country={country}
                        onSelect={handleCitySelect}
                        placeholder="Search for your city..."
                    />
                    {city && country && (
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 4,
                            paddingHorizontal: 4,
                        }}>
                            <View style={{
                                width: 6, height: 6, borderRadius: 3,
                                backgroundColor: "#34C759",
                            }} />
                            <Text
                                style={[
                                    styles.InterFontRegular,
                                    {
                                        fontSize: 12,
                                        color: "#34C759",
                                    },
                                ]}
                            >
                                {city}, {country}
                            </Text>
                        </View>
                    )}
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
                        backgroundColor: loading ? "#A0C4FF" : "#007AFF",
                        paddingVertical: 16,
                        borderRadius: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        shadowColor: "#007AFF",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                    onPress={onContinue}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={[styles.InterFontSemiBold, { color: "#fff", fontSize: 16 }]}>Continue</Text>
                            <ArrowRight size={18} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
