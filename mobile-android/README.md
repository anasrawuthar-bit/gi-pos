# GI POS Order for Android

This is the Android counter and waiter app for the existing Main PC browser ordering flow. It does not create a SQLite database on the phone and it does not print locally.

## Flow

1. Start **Local POS Server** on the Main PC.
2. Keep the Android phone and Main PC on the same Wi-Fi/LAN.
3. Open this Android project in Android Studio.
4. Build/install the app, then enter the Main PC address displayed by Local POS Server, for example `http://192.168.1.3:8080`.
5. The app checks `/api/health`, saves the address, and opens the existing mobile login page.

The Android app only stores the server address in Android preferences. Orders, users, menu data, bills, and KOT printing stay on the Main PC.

## Build in Android Studio

1. Install Android Studio with Android SDK Platform 35 and its bundled JDK.
2. Choose **Open** and select the `mobile-android` folder.
3. Let Gradle sync, then choose **Build > Build APK(s)**.
4. The debug APK is created under `app/build/outputs/apk/debug/`.

The Main PC URL can change when a router assigns a new DHCP address. Reserve the Main PC's address in the router to keep it stable. The app's **Server** menu lets staff reconnect when the address changes.
