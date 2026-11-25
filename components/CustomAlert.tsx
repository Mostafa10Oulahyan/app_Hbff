import React from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

export type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
};

type CustomAlertProps = {
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    onDismiss: () => void;
};

export default function CustomAlert({
    visible,
    title,
    message,
    buttons = [],
    onDismiss,
}: CustomAlertProps) {
    // If no buttons are provided, add a default "OK" button
    const effectiveButtons =
        buttons.length > 0
            ? buttons
            : [{ text: "OK", onPress: onDismiss, style: "default" }];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <TouchableWithoutFeedback onPress={onDismiss}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.alertContainer}>
                            <Text style={styles.title}>{title}</Text>
                            {message ? <Text style={styles.message}>{message}</Text> : null}

                            <View
                                style={[
                                    styles.buttonContainer,
                                    effectiveButtons.length > 2 && styles.buttonContainerVertical,
                                ]}
                            >
                                {effectiveButtons.map((btn, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.button,
                                            effectiveButtons.length <= 2 && {flex: 1},
                                            btn.style === "destructive" && styles.buttonDestructive,
                                            btn.style === "cancel" && styles.buttonCancel,
                                            effectiveButtons.length > 2 && styles.buttonFullWidth,
                                        ]}
                                        onPress={() => {
                                            if (btn.onPress) btn.onPress();
                                            onDismiss();
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                btn.style === "destructive" &&
                                                styles.buttonTextDestructive,
                                                btn.style === "cancel" && styles.buttonTextCancel,
                                            ]}
                                        >
                                            {btn.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    alertContainer: {
        width: "100%",
        maxWidth: 320,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontFamily: "Inter_600SemiBold",
        color: "#000",
        textAlign: "center",
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
        width: "100%",
    },
    buttonContainerVertical: {
        flexDirection: "column",
        gap: 10,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: "#007AFF",
        minWidth: 80,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonFullWidth: {
        width: "100%",
    },
    buttonDestructive: {
        backgroundColor: "#FF3B30",
    },
    buttonCancel: {
        backgroundColor: "#E5E5EA",
    },
    buttonText: {
        color: "#fff",
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
    },
    buttonTextDestructive: {
        color: "#fff",
    },
    buttonTextCancel: {
        color: "#000",
    },
});
