import { GeoCity, searchCities } from "@/lib/geoApi";
import { MapPin, Search, X } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface CityCountryPickerProps {
    city: string;
    country: string;
    onSelect: (data: { city: string; country: string }) => void;
    placeholder?: string;
    /** If true, render as a compact chip instead of full input */
    compact?: boolean;
}

export const CityCountryPicker: React.FC<CityCountryPickerProps> = ({
    city,
    country,
    onSelect,
    placeholder = "Search for a city...",
    compact = false,
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GeoCity[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((text: string) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (text.length < 2) {
            setResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const cities = await searchCities(text);
                setResults(cities);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 500);
    }, []);

    const handleSelect = (item: GeoCity) => {
        onSelect({ city: item.city, country: item.country });
        setModalVisible(false);
        setQuery("");
        setResults([]);
    };

    const displayText =
        city && country ? `${city}, ${country}` : city || country || "";

    if (compact) {
        return (
            <>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: displayText ? "#E8F2FF" : "#f5f5f5",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        gap: 6,
                        borderWidth: 1,
                        borderColor: displayText ? "#007AFF" : "#e0e0e0",
                    }}
                >
                    <MapPin size={14} color={displayText ? "#007AFF" : "#999"} />
                    <Text
                        style={{
                            fontSize: 13,
                            fontFamily: "Inter_600SemiBold",
                            color: displayText ? "#007AFF" : "#999",
                        }}
                        numberOfLines={1}
                    >
                        {displayText || "All locations"}
                    </Text>
                    {displayText ? (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onSelect({ city: "", country: "" });
                            }}
                            hitSlop={8}
                        >
                            <X size={14} color="#007AFF" />
                        </TouchableOpacity>
                    ) : null}
                </TouchableOpacity>
                {renderModal()}
            </>
        );
    }

    return (
        <>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#f5f5f5",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                    gap: 8,
                    marginBottom: 16,
                }}
            >
                <MapPin size={18} color={displayText ? "#007AFF" : "#999"} />
                <Text
                    style={{
                        fontSize: 14,
                        fontFamily: displayText ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: displayText ? "#000" : "#999",
                        flex: 1,
                    }}
                    numberOfLines={1}
                >
                    {displayText || placeholder}
                </Text>
            </TouchableOpacity>
            {renderModal()}
        </>
    );

    function renderModal() {
        return (
            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: "#fff" }}>
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: "#e0e0e0",
                            gap: 12,
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#f5f5f5",
                                borderRadius: 8,
                                paddingHorizontal: 12,
                            }}
                        >
                            <Search size={16} color="#999" />
                            <TextInput
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    fontFamily: "Inter_400Regular",
                                    fontSize: 14,
                                }}
                                placeholder="Search for a city..."
                                placeholderTextColor="#999"
                                value={query}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                            {loading && <ActivityIndicator size="small" color="#007AFF" />}
                        </View>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Text
                                style={{
                                    color: "#007AFF",
                                    fontFamily: "Inter_600SemiBold",
                                    fontSize: 14,
                                }}
                            >
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Results */}
                    <FlatList
                        data={results}
                        keyExtractor={(item, index) =>
                            `${item.city}-${item.country}-${index}`
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleSelect(item)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    padding: 16,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#f0f0f0",
                                    gap: 12,
                                }}
                            >
                                <MapPin size={18} color="#007AFF" />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontFamily: "Inter_600SemiBold",
                                            color: "#000",
                                        }}
                                    >
                                        {item.city}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontFamily: "Inter_400Regular",
                                            color: "#666",
                                            marginTop: 2,
                                        }}
                                    >
                                        {[item.region, item.country].filter(Boolean).join(", ")}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            query.length >= 2 && !loading ? (
                                <View
                                    style={{
                                        padding: 40,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontFamily: "Inter_400Regular",
                                            color: "#999",
                                        }}
                                    >
                                        {query.length >= 2
                                            ? "No cities found"
                                            : "Start typing to search"}
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            </Modal>
        );
    }
};
