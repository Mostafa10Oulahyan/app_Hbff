import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
    Bookmark,
    ChevronRight,
    Info,
    LogOut,
    Settings,
    Shield,
    User,
    X,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MENU_WIDTH = SCREEN_WIDTH * 0.78;

interface MenuItem {
    icon: React.ReactNode;
    label: string;
    subtitle?: string;
    onPress: () => void;
    color?: string;
}

interface SideMenuProps {
    visible: boolean;
    onClose: () => void;
}

export function SideMenu({ visible, onClose }: SideMenuProps) {
    const slideAnim = useRef(new Animated.Value(MENU_WIDTH)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const router = useRouter();
    const { signOut } = useAuth();
    const { user } = useUser();

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayAnim, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: MENU_WIDTH,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(overlayAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleNav = (path: string) => {
        onClose();
        setTimeout(() => router.push(path as any), 300);
    };

    const handleSignOut = async () => {
        onClose();
        await signOut();
    };

    const menuItems: MenuItem[] = [
        {
            icon: <Settings size={20} color="#007AFF" />,
            label: "Settings",
            subtitle: "Edit your profile",
            onPress: () => handleNav("/settings"),
        },
        {
            icon: <Bookmark size={20} color="#FF9500" />,
            label: "Saved",
            subtitle: "Your saved hangouts",
            onPress: () => handleNav("/saved-hangouts"),
        },
        {
            icon: <Shield size={20} color="#34C759" />,
            label: "Privacy",
            subtitle: "Manage your data",
            onPress: () => handleNav("/privacy"),
        },
        {
            icon: <Info size={20} color="#8E8E93" />,
            label: "App Info",
            subtitle: "Version & about",
            onPress: () => handleNav("/app-info"),
        },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, flexDirection: "row" }}>
                {/* Overlay */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.5)",
                            opacity: overlayAnim,
                        }}
                    />
                </TouchableWithoutFeedback>

                {/* Menu Panel */}
                <Animated.View
                    style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: MENU_WIDTH,
                        backgroundColor: "#FAFBFD",
                        transform: [{ translateX: slideAnim }],
                        paddingTop: 0,
                        shadowColor: "#000",
                        shadowOffset: { width: -6, height: 0 },
                        shadowOpacity: 0.12,
                        shadowRadius: 16,
                        elevation: 10,
                    }}
                >
                    {/* User header */}
                    <View
                        style={{
                            backgroundColor: "#007AFF",
                            paddingTop: 56,
                            paddingBottom: 24,
                            paddingHorizontal: 24,
                        }}
                    >
                        {/* Close button */}
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                position: "absolute",
                                top: 16,
                                right: 16,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: "rgba(255,255,255,0.2)",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <X size={16} color="#fff" />
                        </TouchableOpacity>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 14,
                            }}
                        >
                            {user?.imageUrl ? (
                                <Image
                                    source={{ uri: user.imageUrl }}
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 26,
                                        borderWidth: 2,
                                        borderColor: "rgba(255,255,255,0.5)",
                                    }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 26,
                                        backgroundColor:
                                            "rgba(255,255,255,0.2)",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <User size={24} color="#fff" />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontFamily: "Inter_600SemiBold",
                                        fontSize: 18,
                                        color: "#fff",
                                    }}
                                    numberOfLines={1}
                                >
                                    {user?.fullName || "User"}
                                </Text>
                                <Text
                                    style={{
                                        fontFamily: "Inter_400Regular",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.7)",
                                        marginTop: 2,
                                    }}
                                    numberOfLines={1}
                                >
                                    {user?.primaryEmailAddress?.emailAddress ||
                                        ""}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Menu items */}
                    <View style={{ paddingTop: 12, paddingHorizontal: 12 }}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={item.onPress}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    paddingHorizontal: 14,
                                    borderRadius: 12,
                                    marginBottom: 2,
                                }}
                                activeOpacity={0.6}
                            >
                                <View
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        backgroundColor: "#fff",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 3,
                                        elevation: 1,
                                        borderWidth: 1,
                                        borderColor: "#f0f0f0",
                                    }}
                                >
                                    {item.icon}
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text
                                        style={{
                                            fontFamily: "Inter_600SemiBold",
                                            fontSize: 15,
                                            color: "#1a1a1a",
                                        }}
                                    >
                                        {item.label}
                                    </Text>
                                    {item.subtitle && (
                                        <Text
                                            style={{
                                                fontFamily: "Inter_400Regular",
                                                fontSize: 12,
                                                color: "#999",
                                                marginTop: 1,
                                            }}
                                        >
                                            {item.subtitle}
                                        </Text>
                                    )}
                                </View>
                                <ChevronRight size={18} color="#ccc" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Sign out */}
                    <View
                        style={{
                            position: "absolute",
                            bottom: 40,
                            left: 12,
                            right: 12,
                        }}
                    >
                        <TouchableOpacity
                            onPress={handleSignOut}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                paddingVertical: 14,
                                borderRadius: 12,
                                backgroundColor: "#FFF5F5",
                                borderWidth: 1,
                                borderColor: "#FFE5E5",
                            }}
                            activeOpacity={0.7}
                        >
                            <LogOut size={18} color="#FF3B30" />
                            <Text
                                style={{
                                    fontFamily: "Inter_600SemiBold",
                                    fontSize: 15,
                                    color: "#FF3B30",
                                }}
                            >
                                Sign Out
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
