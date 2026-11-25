import { styles } from "@/const/style";
import { useAlert } from "@/context/AlertContext";
import { useGoogleOAuth, useWarmUpBrowser } from "@/lib/clerk/oauth";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
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

export default function SignIn() {
  useWarmUpBrowser();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { onGooglePress } = useGoogleOAuth();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"sign-in" | "email" | "code">(
    "sign-in",
  );
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        showAlert("Error", "Sign in incomplete. Please try again.");
      }
    } catch (err: any) {
      showAlert("Error", err.errors?.[0]?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const onSendResetCode = async () => {
    if (!isLoaded) return;
    if (!email.trim()) {
      showAlert("Email required", "Enter your email address to receive a code.");
      return;
    }

    setLoading(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });
      setRecoveryStep("code");
      showAlert("Check your email", "We sent you a password reset code.");
    } catch (err: any) {
      showAlert(
        "Could not send code",
        err.errors?.[0]?.longMessage ||
          err.errors?.[0]?.message ||
          "Please check your email address and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!isLoaded) return;
    if (!resetCode.trim()) {
      showAlert("Code required", "Enter the verification code from your email.");
      return;
    }
    if (!newPassword) {
      showAlert("Password required", "Enter a new password.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert("Passwords do not match", "Enter the same password in both fields.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode.trim(),
        password: newPassword,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else if (result.status === "needs_second_factor") {
        setRecoveryStep("sign-in");
        showAlert(
          "Password reset",
          "Your password was reset. Sign in with your new password and complete the additional verification step.",
        );
      } else {
        showAlert(
          "Password reset incomplete",
          "The code was accepted, but sign-in could not be completed. Try signing in with your new password.",
        );
      }
    } catch (err: any) {
      showAlert(
        "Could not reset password",
        err.errors?.[0]?.longMessage ||
          err.errors?.[0]?.message ||
          "Check the code and password, then try again.",
      );
    } finally {
      setLoading(false);
    }
  };

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
          {recoveryStep === "sign-in" ? "Welcome Back" : "Forgot Password?"}
        </Text>
        <Text
          style={[
            styles.InterFontRegular,
            { fontSize: 15, color: "#666", marginBottom: 32 },
          ]}
        >
          {recoveryStep === "sign-in"
            ? "Sign in to continue your hangout journey"
            : recoveryStep === "email"
              ? "We’ll send a one-time code to your email"
              : "Enter the email code and choose a new password"}
        </Text>

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
            editable={recoveryStep !== "code"}
          />
        </View>

        {/* Password */}
        {recoveryStep === "sign-in" && (
          <>
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
                marginBottom: 8,
              }}
            >
              <Lock size={18} color="#999" />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={"#999"}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={18} color="#999" />
                ) : (
                  <Eye size={18} color="#999" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setRecoveryStep("email")}
              style={{ alignSelf: "flex-end", marginBottom: 22 }}
            >
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          </>
        )}

        {recoveryStep === "email" && (
          <Text
            style={[
              styles.InterFontRegular,
              { fontSize: 13, color: "#666", marginBottom: 20 },
            ]}
          >
            We’ll email a one-time code to verify your account before you reset
            your password.
          </Text>
        )}

        {recoveryStep === "code" && (
          <>
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 14, color: "#333", marginBottom: 6 },
              ]}
            >
              Email verification code
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: "center",
                  fontSize: 22,
                  letterSpacing: 8,
                  marginBottom: 16,
                },
              ]}
              placeholder="000000"
              placeholderTextColor="#999"
              value={resetCode}
              onChangeText={setResetCode}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
            />
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 14, color: "#333", marginBottom: 6 },
              ]}
            >
              New password
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              placeholder="Enter a new password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text
              style={[
                styles.InterFontSemiBold,
                { fontSize: 14, color: "#333", marginBottom: 6 },
              ]}
            >
              Confirm new password
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder="Enter the new password again"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={onSendResetCode}
              disabled={loading}
              style={{ alignSelf: "flex-end", marginBottom: 20 }}
            >
              <Text style={styles.link}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Clerk Smart CAPTCHA container (Web only) */}
        {Platform.OS === "web" && <div id="clerk-captcha" />}

        {/* Sign In Button */}
        <TouchableOpacity
          style={[styles.button, { width: "100%", opacity: loading ? 0.7 : 1 }]}
          onPress={
            recoveryStep === "sign-in"
              ? onSignIn
              : recoveryStep === "email"
                ? onSendResetCode
                : onResetPassword
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {recoveryStep === "sign-in"
                ? "Sign In"
                : recoveryStep === "email"
                  ? "Send verification code"
                  : "Verify code and reset password"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        {recoveryStep === "sign-in" && (
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
        )}

        {/* Google OAuth */}
        {recoveryStep === "sign-in" && (
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
              Sign in with Google
            </Text>
          </TouchableOpacity>
        )}

        {/* Sign Up Link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          {recoveryStep === "sign-in" ? (
            <>
              <Text
                style={[styles.InterFontRegular, { fontSize: 14, color: "#666" }]}
              >
                Don&apos;t have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/sign-up")}>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setRecoveryStep("sign-in");
                setResetCode("");
                setNewPassword("");
                setConfirmNewPassword("");
              }}
            >
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
