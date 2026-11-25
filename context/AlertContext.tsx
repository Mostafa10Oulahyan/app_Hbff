import CustomAlert, { AlertButton } from "@/components/CustomAlert";
import React, { createContext, useCallback, useContext, useState } from "react";

type AlertContextType = {
    showAlert: (
        title: string,
        message?: string,
        buttons?: AlertButton[],
    ) => void;
    hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState<string | undefined>(undefined);
    const [buttons, setButtons] = useState<AlertButton[]>([]);

    const showAlert = useCallback(
        (title: string, message?: string, buttons: AlertButton[] = []) => {
            setTitle(title);
            setMessage(message);
            setButtons(buttons);
            setVisible(true);
        },
        [],
    );

    const hideAlert = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                visible={visible}
                title={title}
                message={message}
                buttons={buttons}
                onDismiss={hideAlert}
            />
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
}
