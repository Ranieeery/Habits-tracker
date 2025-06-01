import "./lib/dayjs";

import { StatusBar } from "expo-status-bar";
import {
    useFonts,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { Loading } from "./src/components/Loading";
import { Routes } from "./src/routes";
import * as Notifications from "expo-notifications";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { Button, Alert } from "react-native";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_600SemiBold,
        Inter_500Medium,
        Inter_800ExtraBold,
    });

    async function requestNotificationPermissions() {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            Alert.alert('Erro', 'Permissão de notificação negada!');
            return false;
        }
        
        return true;
    }

    async function scheduleNotfication() {
        const hasPermission = await requestNotificationPermissions();
        
        if (!hasPermission) {
            return;
        }

        const trigger = new Date(Date.now());
        trigger.setSeconds(trigger.getSeconds() + 10);

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Hello!",
                body: "This is a test notification.",
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: trigger,
            },
        });
        
        // Alert.alert('Success', 'Notification scheduled successfully!');
    }

    useEffect(() => {
        NavigationBar.setBackgroundColorAsync("#000000");
        NavigationBar.setButtonStyleAsync("light");
        
        requestNotificationPermissions();
    }, []);

    if (!fontsLoaded) {
        return <Loading />;
    }

    return (
        <>
            <Button
                title="Schedule Notification"
                onPress={scheduleNotfication}
            />
            <Routes />
            <StatusBar
                style="light"
                backgroundColor="transparent"
                translucent
            />
        </>
    );
}
