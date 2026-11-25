import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

const SAVED_HANGOUTS_KEY = "saved_hangouts";

export type SavedHangout = {
    id: string;
    title: string;
    imageUrl: string;
    date: string; // ISO string
    location: string;
    hostName: string;
    hostAvatarUrl: string;
    participants: number;
    maxParticipants: number;
    activityType?: string;
    interests?: string[];
    members: number; // count
};

export function useSavedHangouts() {
    const [savedHangouts, setSavedHangouts] = useState<SavedHangout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSavedHangouts();
    }, []);

    const loadSavedHangouts = async () => {
        try {
            const jsonValue = await AsyncStorage.getItem(SAVED_HANGOUTS_KEY);
            if (jsonValue != null) {
                setSavedHangouts(JSON.parse(jsonValue));
            }
        } catch (e) {
            console.error("Failed to load saved hangouts", e);
        } finally {
            setLoading(false);
        }
    };

    const isSaved = (id: string) => {
        return savedHangouts.some((hangout) => hangout.id === id);
    };

    const toggleSave = async (hangout: SavedHangout) => {
        try {
            let newSavedHangouts = [...savedHangouts];
            if (isSaved(hangout.id)) {
                newSavedHangouts = newSavedHangouts.filter((h) => h.id !== hangout.id);
            } else {
                newSavedHangouts.push(hangout);
            }
            setSavedHangouts(newSavedHangouts);
            await AsyncStorage.setItem(
                SAVED_HANGOUTS_KEY,
                JSON.stringify(newSavedHangouts),
            );
        } catch (e) {
            console.error("Failed to save hangout", e);
            Alert.alert("Error", "Failed to update saved hangouts");
        }
    };

    return { savedHangouts, loading, isSaved, toggleSave, refresh: loadSavedHangouts };
}
