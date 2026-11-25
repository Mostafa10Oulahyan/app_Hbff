import React from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LoadingScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Image
                    source={require("@/assets/images/icon.png")}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
    },
    logo: {
        width: 120,
        height: 120,
    },
    spinner: {
        marginTop: 20,
    },
});

export default LoadingScreen;
