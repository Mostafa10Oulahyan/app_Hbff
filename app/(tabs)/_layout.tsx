import { Tabs } from 'expo-router';
import { CircleUserRound, Compass, House, MessageCircle, Plus } from "lucide-react-native";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: '#8E8E93',
                tabBarHideOnKeyboard: true,
                tabBarStyle: {
                    borderTopWidth: 1,
                    elevation: 0,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                    marginBottom: 2,
                    width: '100%',
                    textAlign: 'center',
                }
            }}>
            <Tabs.Screen name="index" options={{
                title: 'Home',
                tabBarIcon: ({ color, size }) => <House color={color} size={size} />
            }} />
            <Tabs.Screen name="discover" options={{
                title: 'Discover',
                tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />
            }} />
            <Tabs.Screen name="add" options={{
                title: 'Add',
                tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />
            }} />
            <Tabs.Screen name="chat" options={{
                title: 'Chat',
                tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />
            }} />
            <Tabs.Screen name="profile" options={{
                title: 'Profile',
                tabBarIcon: ({ color, size }) => <CircleUserRound color={color} size={size} />
            }} />

        </Tabs>
    );
}