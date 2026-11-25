import { getUserLocation, type UserLocation } from "@/lib/location";
import getMapHangouts, {
  type MapHangout,
  type MapViewport,
} from "@/lib/supabase/queries/getMapHangouts";
import { useUser } from "@clerk/clerk-expo";
import { useImage } from "expo-image";
import { GoogleMaps, type CameraMoveEvent } from "expo-maps";
import { useRouter } from "expo-router";
import {
  Calendar,
  Crosshair,
  MapPin,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const WORLD_ZOOM = 2;
const USER_ZOOM = 13;

// Activity type → emoji mapping for marker titles
const ACTIVITY_EMOJI: Record<string, string> = {
  Sports: "⚽",
  Gaming: "🎮",
  Study: "📚",
  Food: "🍕",
  Music: "🎵",
  Art: "🎨",
  Travel: "✈️",
  Fitness: "💪",
  Movies: "🎬",
  Coffee: "☕",
  Nightlife: "🌙",
  Outdoors: "🏕️",
  Shopping: "🛍️",
  Volunteering: "🤝",
  Tech: "💻",
  Photography: "📷",
  Reading: "📖",
  Cooking: "🍳",
  Dance: "💃",
  Pets: "🐾",
};

export default function Discover() {
  const { user } = useUser();
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const cameraDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRequestIdRef = useRef(0);

  const [location, setLocation] = useState<UserLocation>({
    lat: null,
    lng: null,
    city: null,
    country: null,
    source: "none",
  });
  const [hangouts, setHangouts] = useState<MapHangout[]>([]);
  const [selectedHangout, setSelectedHangout] = useState<MapHangout | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);

  // Initialize location
  useEffect(() => {
    let active = true;
    const init = async () => {
      const loc = await getUserLocation(user?.id);
      if (active) setLocation(loc);
    };
    void init();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleCameraMove = useCallback((event: CameraMoveEvent) => {
    if (cameraDebounceRef.current) clearTimeout(cameraDebounceRef.current);
    const requestId = ++cameraRequestIdRef.current;
    const viewport: MapViewport = {
      latitude: event.coordinates.latitude ?? 0,
      longitude: event.coordinates.longitude ?? 0,
      latitudeDelta: event.latitudeDelta ?? 180,
      longitudeDelta: event.longitudeDelta ?? 360,
    };

    cameraDebounceRef.current = setTimeout(async () => {
      try {
        const visibleHangouts = await getMapHangouts(viewport);
        if (requestId === cameraRequestIdRef.current) {
          setHangouts(visibleHangouts);
        }
      } catch (error) {
        console.error("Error loading hangouts for map viewport:", error);
      }
    }, 350);
  }, []);

  useEffect(
    () => () => {
      if (cameraDebounceRef.current) clearTimeout(cameraDebounceRef.current);
      cameraRequestIdRef.current += 1;
    },
    [],
  );

  const image = useImage(require("../../assets/images/icon.png"));
  // Build markers from hangouts
  const markers = hangouts.map((h) => {
    const emoji = ACTIVITY_EMOJI[h.activityType] ?? "📍";
    return {
      id: h.id,
      coordinates: { latitude: h.lat, longitude: h.lng },
      title: `${emoji} ${h.title}`,
      snippet: `${h.scheduledAtFormatted} · ${h.currentParticipants}/${h.maxParticipants} going`,
      icon: image ?? undefined,
    };
  });

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: any) => {
      const hangout = hangouts.find((h) => h.id === marker.id);
      if (hangout) {
        setSelectedHangout(hangout);
        setModalVisible(true);
      }
    },
    [hangouts],
  );

  // Re-center on user location
  const handleRecenter = useCallback(() => {
    if (location.lat !== null && location.lng !== null && mapRef.current) {
      mapRef.current.setCameraPosition({
        coordinates: { latitude: location.lat, longitude: location.lng },
        zoom: USER_ZOOM,
        duration: 600,
      });
    }
  }, [location]);

  if (Platform.OS === "web") {
    return (
      <View style={s.centered}>
        <Text style={s.emptyTitle}>Maps are only available on mobile</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Full-screen Map */}
      <GoogleMaps.View
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={{
          coordinates: { latitude: 20, longitude: 0 },
          zoom: WORLD_ZOOM,
        }}
        markers={markers}
        onCameraMove={handleCameraMove}
        onMarkerClick={handleMarkerClick}
        onMapClick={() => {
          if (modalVisible) {
            setModalVisible(false);
            setSelectedHangout(null);
          }
        }}
        properties={{
          isMyLocationEnabled: location.source === "gps",
        }}
        uiSettings={{
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          compassEnabled: true,
        }}
      />

      {/* Re-center FAB */}
      {location.lat !== null && location.lng !== null && (
        <TouchableOpacity
          style={s.fab}
          activeOpacity={0.8}
          onPress={handleRecenter}
        >
          <Crosshair size={22} color="#007AFF" />
        </TouchableOpacity>
      )}

      {/* Hangout count badge */}
      <View style={s.countBadge}>
        <MapPin size={14} color="#fff" />
        <Text style={s.countText}>
          {hangouts.length} hangout{hangouts.length !== 1 ? "s" : ""} in view
        </Text>
      </View>

      {/* Bottom Modal for selected hangout */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedHangout(null);
        }}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setModalVisible(false);
            setSelectedHangout(null);
          }}
        >
          <TouchableOpacity
            style={s.modalContent}
            activeOpacity={1}
            onPress={() => { }}
          >
            {selectedHangout && (
              <>
                {/* Close button */}
                <TouchableOpacity
                  style={s.closeButton}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedHangout(null);
                  }}
                  hitSlop={12}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>

                {/* Header with image */}
                <View style={s.modalHeader}>
                  {selectedHangout.imageUrl ? (
                    <Image
                      source={{ uri: selectedHangout.imageUrl }}
                      style={s.modalImage}
                    />
                  ) : (
                    <View style={[s.modalImage, s.modalImagePlaceholder]}>
                      <MapPin size={28} color="#007AFF" />
                    </View>
                  )}
                  <View style={s.modalHeaderText}>
                    <Text style={s.modalTitle} numberOfLines={2}>
                      {selectedHangout.title}
                    </Text>
                    <View style={s.activityBadge}>
                      <Text style={s.activityBadgeText}>
                        {ACTIVITY_EMOJI[selectedHangout.activityType] ?? "📍"}{" "}
                        {selectedHangout.activityType}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Info rows */}
                <View style={s.modalInfoSection}>
                  <View style={s.modalInfoRow}>
                    <Calendar size={16} color="#007AFF" />
                    <Text style={s.modalInfoText}>
                      {selectedHangout.scheduledAtFormatted}
                    </Text>
                  </View>
                  <View style={s.modalInfoRow}>
                    <MapPin size={16} color="#007AFF" />
                    <Text style={s.modalInfoText} numberOfLines={1}>
                      {selectedHangout.locationName}
                    </Text>
                  </View>
                  <View style={s.modalInfoRow}>
                    <Users size={16} color="#007AFF" />
                    <Text style={s.modalInfoText}>
                      {selectedHangout.currentParticipants}/
                      {selectedHangout.maxParticipants} going
                    </Text>
                  </View>
                </View>

                {/* Host */}
                <View style={s.hostRow}>
                  {selectedHangout.hostAvatarUrl ? (
                    <Image
                      source={{ uri: selectedHangout.hostAvatarUrl }}
                      style={s.hostAvatar}
                    />
                  ) : (
                    <View style={[s.hostAvatar, s.hostAvatarPlaceholder]} />
                  )}
                  <Text style={s.hostText}>
                    Hosted by{" "}
                    <Text style={s.hostName}>{selectedHangout.hostName}</Text>
                  </Text>
                </View>

                {/* View Details button */}
                <TouchableOpacity
                  style={s.viewButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedHangout(null);
                    router.push(`/hangout/${selectedHangout.id}` as any);
                  }}
                >
                  <Text style={s.viewButtonText}>View Details</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
    fontFamily: "Inter_400Regular",
  },
  emptyTitle: {
    fontSize: 18,
    color: "#333",
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#888",
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  // Count badge
  countBadge: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 122, 255, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  countText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    minHeight: 280,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },

  // Modal header
  modalHeader: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  modalImage: {
    width: 80,
    height: 80,
    borderRadius: 14,
  },
  modalImagePlaceholder: {
    backgroundColor: "#E8F0FE",
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderText: {
    flex: 1,
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
    marginBottom: 6,
  },
  activityBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityBadgeText: {
    fontSize: 12,
    color: "#007AFF",
    fontFamily: "Inter_600SemiBold",
  },

  // Info rows
  modalInfoSection: {
    gap: 10,
    marginBottom: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Inter_400Regular",
    flex: 1,
  },

  // Host
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  hostAvatarPlaceholder: {
    backgroundColor: "#e0e0e0",
  },
  hostText: {
    fontSize: 13,
    color: "#666",
    fontFamily: "Inter_400Regular",
  },
  hostName: {
    fontFamily: "Inter_600SemiBold",
    color: "#333",
  },

  // View button
  viewButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  viewButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});