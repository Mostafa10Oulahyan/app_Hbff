import { ChevronRight, MapPin, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export interface PlaceResult {
  displayName: string;
  lat: number;
  lng: number;
  type: string;
}

interface LocationSearchProps {
  onSelect: (place: PlaceResult) => void;
  value: string;
  onClear: () => void;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export const LocationSearch: React.FC<LocationSearchProps> = ({
  onSelect,
  value,
  onClear,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);

  const searchPlaces = useCallback(async (text: string) => {
    if (text.trim().length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=10`;

      let response = await fetch(url, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "HangoutBFF/1.0",
        },
        signal: controller.signal,
      });

      // Retry once after a delay on rate limit (429/509)
      if (response.status === 429 || response.status === 509) {
        await new Promise((r) => setTimeout(r, 1500));
        if (controller.signal.aborted) return;
        response = await fetch(url, {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "HangoutBFF/1.0",
          },
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        console.error("Nominatim search failed:", response.status);
        setResults([]);
        return;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        setResults([]);
        return;
      }

      const places: PlaceResult[] = data.map((item: any) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || "place",
      }));

      if (!controller.signal.aborted) {
        setResults(places);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Location search error:", err);
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(text), 1000);
  };

  const handleSelect = (place: PlaceResult) => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setModalVisible(false);
    onSelect(place);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    onClear();
  };

  const openModal = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setModalVisible(false);
  };

  useEffect(() => {
    if (modalVisible) {
      // Auto-focus the search input when modal opens
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [modalVisible]);

  const formatType = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const shortenName = (name: string) => {
    const parts = name.split(", ");
    if (parts.length <= 3) return name;
    return parts.slice(0, 3).join(", ");
  };

  const getSubtitle = (name: string) => {
    const parts = name.split(", ");
    if (parts.length <= 3) return "";
    return parts.slice(3).join(", ");
  };

  const renderResult = ({ item, index }: { item: PlaceResult; index: number }) => (
    <TouchableOpacity
      onPress={() => handleSelect(item)}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#EBF3FF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MapPin size={16} color="#007AFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_600SemiBold",
            color: "#000",
          }}
          numberOfLines={1}
        >
          {shortenName(item.displayName)}
        </Text>
        {getSubtitle(item.displayName) !== "" && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_400Regular",
              color: "#999",
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {getSubtitle(item.displayName)}
          </Text>
        )}
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: "#007AFF",
            marginTop: 2,
          }}
        >
          {formatType(item.type)}
        </Text>
      </View>
      <ChevronRight size={16} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Inter_600SemiBold",
          color: "#000",
        }}
      >
        Location *
      </Text>

      {value ? (
        // Selected place display
        <View
          style={{
            backgroundColor: "#EBF3FF",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: "#007AFF",
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                flex: 1,
                gap: 8,
              }}
            >
              <MapPin size={16} color="#007AFF" style={{ marginTop: 2 }} />
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                  color: "#007AFF",
                  flex: 1,
                }}
              >
                {shortenName(value)}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <X size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Trigger button to open modal
        <TouchableOpacity
          onPress={openModal}
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
          <Search size={16} color="#999" />
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: "#999",
              flex: 1,
            }}
          >
            Search for a place...
          </Text>
        </TouchableOpacity>
      )}

      {/* Full-screen search modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* Modal header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#e0e0e0",
              gap: 12,
              marginTop: 16,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f5f5f5",
                borderRadius: 10,
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <Search size={16} color="#999" />
              <TextInput
                ref={inputRef}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: "Inter_400Regular",
                  color: "#000",
                  paddingVertical: 10,
                }}
                placeholder="Search city, place, address..."
                placeholderTextColor="#999"
                value={query}
                onChangeText={handleChangeText}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery("");
                    setResults([]);
                    setSearched(false);
                    inputRef.current?.focus();
                  }}
                  hitSlop={8}
                >
                  <X size={16} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeModal} hitSlop={8}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_600SemiBold",
                  color: "#007AFF",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading indicator */}
          {loading && (
            <View
              style={{
                paddingVertical: 20,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="small" color="#007AFF" />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: "#999",
                  marginTop: 8,
                }}
              >
                Searching...
              </Text>
            </View>
          )}

          {/* Results list */}
          {!loading && results.length > 0 && (
            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={(item, index) => `${item.lat}-${item.lng}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}

          {/* Empty state: initial prompt */}
          {!loading && !searched && query.length < 3 && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 40,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#EBF3FF",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <MapPin size={28} color="#007AFF" />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                  textAlign: "center",
                }}
              >
                Search for a location
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: "#999",
                  textAlign: "center",
                }}
              >
                Type at least 3 characters to search for cities, places, addresses, and more
              </Text>
            </View>
          )}

          {/* Empty state: no results found */}
          {!loading && searched && results.length === 0 && query.length >= 3 && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 40,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#f5f5f5",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Search size={28} color="#999" />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_600SemiBold",
                  color: "#000",
                  textAlign: "center",
                }}
              >
                No places found
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: "#999",
                  textAlign: "center",
                }}
              >
                Try a different search term or check for typos
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};
