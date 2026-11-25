import { styles } from "@/const/style";
import { useAlert } from "@/context/AlertContext";
import { useGoogleOAuth, useWarmUpBrowser } from "@/lib/clerk/oauth";
import { upsertProfile } from "@/lib/supabase/mutations/profile";
import { useAuth, useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function SignUp() {
  useWarmUpBrowser();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken } = useAuth();
  const { onGooglePress } = useGoogleOAuth();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const [firstName, ...lastParts] = fullName.trim().split(" ");
      const lastName = lastParts.join(" ") || "";

      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      showAlert("Error", err.errors?.[0]?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const completeSignUp = async (
    sessionId: string | null | undefined,
    userId: string | null | undefined,
  ) => {
    if (sessionId && setActive) {
      await setActive({ session: sessionId });
    }

    if (userId) {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error("Clerk did not return a session token.");
      }

      const saved = await upsertProfile({
        id: userId,
        firstName: fullName.trim().split(" ")[0] || "User",
      }, accessToken);
      if (!saved) {
        throw new Error("Could not save your profile to Supabase.");
      }
    }

    router.replace("/(auth)/complete-profile");
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      if (signUp.status === "complete") {
        await completeSignUp(signUp.createdSessionId, signUp.createdUserId);
        return;
      }

      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await completeSignUp(
          result.createdSessionId,
          result.createdUserId ?? signUp.createdUserId,
        );
      } else {
        const missing = result.missingFields?.join(", ");
        showAlert(
          "Error",
          missing
            ? `Verification incomplete. Missing: ${missing}`
            : "Verification incomplete. Please try signing in.",
        );
      }
    } catch (err: any) {
      const codeErr = err.errors?.[0]?.code;
      if (
        codeErr === "verification_already_verified" &&
        signUp.status === "complete"
      ) {
        await completeSignUp(signUp.createdSessionId, signUp.createdUserId);
        return;
      }
      showAlert("Error", err.errors?.[0]?.message || err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <View
        style={[
          styles.container,
          {
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          },
        ]}
      >
        {/* Back */}
        <TouchableOpacity
          style={{ position: "absolute", top: 16, left: 16 }}
          onPress={() => setPendingVerification(false)}
        >
          <ArrowLeft size={24} color="#007AFF" />
        </TouchableOpacity>

        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "#E8F2FF",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Mail size={30} color="#007AFF" />
        </View>

        <Text
          style={[
            styles.mainTitle,
            { fontSize: 24, textAlign: "center", marginBottom: 8 },
          ]}
        >
          Verify Your Email
        </Text>
        <Text
          style={[
            styles.InterFontRegular,
            {
              fontSize: 14,
              color: "#666",
              textAlign: "center",
              marginBottom: 32,
            },
          ]}
        >
          We sent a verification code to{"\n"}
          <Text style={styles.InterFontSemiBold}>{email}</Text>
        </Text>

        <View style={{ width: "100%", marginBottom: 24 }}>
          <TextInput
            style={[
              styles.input,
              {
                textAlign: "center",
                fontSize: 24,
                letterSpacing: 8,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
            placeholder="000000"
            placeholderTextColor={"#999"}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { width: "100%", opacity: loading ? 0.7 : 1 }]}
          onPress={onVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 16 }}
          onPress={async () => {
            if (!isLoaded) return;
            try {
              if (signUp.status === "complete") {
                await completeSignUp(
                  signUp.createdSessionId,
                  signUp.createdUserId,
                );
                return;
              }
              await signUp.prepareEmailAddressVerification({
                strategy: "email_code",
              });
              showAlert("Code Resent", "Check your email for a new code.");
            } catch (err: any) {
              showAlert(
                "Error",
                err.errors?.[0]?.message || "Could not resend verification code.",
              );
            }
          }}
        >
          <Text style={styles.link}>Resend code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 40,
          backgroundColor: "#fff",
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity
          style={{ position: "absolute", top: 16, left: 24 }}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#007AFF" />
        </TouchableOpacity>

        <Text style={[styles.mainTitle, { fontSize: 28, marginBottom: 4 }]}>
          Create Account
        </Text>
        <Text
          style={[
            styles.InterFontRegular,
            { fontSize: 15, color: "#666", marginBottom: 32 },
          ]}
        >
          Join the community and find your crew
        </Text>

        {/* Full Name */}
        <Text
          style={[
            styles.InterFontSemiBold,
            { fontSize: 14, color: "#333", marginBottom: 6 },
          ]}
        >
          Full Name
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            paddingHorizontal: 12,
            marginBottom: 16,
          }}
        >
          <User size={18} color="#999" />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
            placeholder="Enter your full name"
            placeholderTextColor={"#999"}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        </View>

        {/* Email */}
        <Text
          style={[
            styles.InterFontSemiBold,
            { fontSize: 14, color: "#333", marginBottom: 6 },
          ]}
        >
          Email
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            paddingHorizontal: 12,
            marginBottom: 16,
          }}
        >
          <Mail size={18} color="#999" />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
            placeholder="Enter your email"
            placeholderTextColor={"#999"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Password */}
        <Text
          style={[
            styles.InterFontSemiBold,
            { fontSize: 14, color: "#333", marginBottom: 6 },
          ]}
        >
          Password
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            paddingHorizontal: 12,
            marginBottom: 24,
          }}
        >
          <Lock size={18} color="#999" />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
            placeholder="Create a password"
            placeholderTextColor={"#999"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <EyeOff size={18} color="#999" />
            ) : (
              <Eye size={18} color="#999" />
            )}
          </TouchableOpacity>
        </View>

        {/* Clerk Smart CAPTCHA container (Web only) */}
        {Platform.OS === "web" && <div id="clerk-captcha" />}

        {/* Sign Up Button */}
        <TouchableOpacity
          style={[styles.button, { width: "100%", opacity: loading ? 0.7 : 1 }]}
          onPress={onSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 24,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
          <Text
            style={[
              styles.InterFontRegular,
              { marginHorizontal: 12, color: "#999", fontSize: 13 },
            ]}
          >
            or continue with
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
        </View>

        {/* Google OAuth */}
        <TouchableOpacity
          style={{
            width: "100%",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#e0e0e0",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
          onPress={onGooglePress}
        >
          <Text style={{ fontSize: 18 }}>G</Text>
          <Text
            style={[styles.InterFontSemiBold, { fontSize: 14, color: "#333" }]}
          >
            Sign up with Google
          </Text>
        </TouchableOpacity>

        {/* Sign In Link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          <Text
            style={[styles.InterFontRegular, { fontSize: 14, color: "#666" }]}
          >
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
