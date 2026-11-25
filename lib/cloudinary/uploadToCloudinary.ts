import { File, UploadType } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { createClerkSupabaseClient } from "../supabase/clerkSupabase";

interface CloudinarySignature {
    cloudName: string;
    apiKey: string;
    timestamp: string;
    signature: string;
    folder: string;
}

/**
 * Compress and resize an image locally before uploading.
 * - maxWidth / maxHeight: resize to fit within these dimensions
 * - quality: JPEG quality 0–1
 */
async function compressImage(
    uri: string,
    maxWidth: number,
    maxHeight: number,
    quality: number,
): Promise<string> {
    const result = await manipulateAsync(
        uri,
        [{ resize: { width: maxWidth, height: maxHeight } }],
        { compress: quality, format: SaveFormat.JPEG },
    );
    return result.uri;
}

/**
 * Request a server-side signed upload payload from the `cloudinary-sign`
 * Edge Function. The Cloudinary API secret never reaches the client.
 */
async function getUploadSignature(
    folder: string,
    accessToken: string,
): Promise<CloudinarySignature | null> {
    try {
        const supabase = createClerkSupabaseClient(accessToken);
        const { data, error } = await supabase.functions.invoke<CloudinarySignature>(
            "cloudinary-sign",
            { body: { folder } },
        );

        if (error) {
            console.error("Cloudinary signature request failed:", error);
            return null;
        }
        if (
            !data
            || typeof data.cloudName !== "string"
            || typeof data.apiKey !== "string"
            || typeof data.timestamp !== "string"
            || typeof data.signature !== "string"
            || typeof data.folder !== "string"
        ) {
            console.error("Cloudinary signature response was malformed.");
            return null;
        }

        return data;
    } catch (err) {
        console.error("Cloudinary signature request exception:", err);
        return null;
    }
}

export interface CloudinaryUploadOptions {
    /** Local file URI (e.g. from ImagePicker) */
    uri: string;
    /** Clerk session token used to authenticate the signing request */
    accessToken: string;
    /** Cloudinary folder to organize images into */
    folder?: string;
    /** Max width for local resize before upload */
    maxWidth?: number;
    /** Max height for local resize before upload */
    maxHeight?: number;
    /** JPEG compression quality 0–1 (default 0.7) */
    quality?: number;
}

/**
 * Compress locally, then upload to Cloudinary using a server-generated
 * signature. Returns the Cloudinary URL, or null on failure.
 */
export async function uploadToCloudinary(
    options: CloudinaryUploadOptions,
): Promise<string | null> {
    const {
        uri,
        accessToken,
        folder = "general",
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.7,
    } = options;

    try {
        // 1. Compress locally
        const compressedUri = await compressImage(
            uri,
            maxWidth,
            maxHeight,
            quality,
        );

        // 2. Ask the Edge Function to sign the upload (secret stays server-side)
        const signed = await getUploadSignature(folder, accessToken);
        if (!signed) return null;

        const uploadUrl =
            `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`;

        const filename = `img_${Date.now()}.jpg`;
        const parameters = {
            folder: signed.folder,
            timestamp: signed.timestamp,
            api_key: signed.apiKey,
            signature: signed.signature,
        };
        let responseOk: boolean;
        let responseBody: string;

        if (Platform.OS === "web") {
            const fileResponse = await fetch(compressedUri);
            if (!fileResponse.ok) {
                throw new Error(`Could not read compressed image (${fileResponse.status}).`);
            }

            const formData = new FormData();
            formData.append("file", await fileResponse.blob(), filename);
            Object.entries(parameters).forEach(([key, value]) => {
                formData.append(key, value);
            });

            const response = await fetch(uploadUrl, {
                method: "POST",
                body: formData,
            });
            responseOk = response.ok;
            responseBody = await response.text();
        } else {
            const response = await new File(compressedUri).upload(uploadUrl, {
                httpMethod: "POST",
                uploadType: UploadType.MULTIPART,
                fieldName: "file",
                mimeType: "image/jpeg",
                parameters,
            });
            responseOk = response.status >= 200 && response.status < 300;
            responseBody = response.body;
        }

        if (!responseOk) {
            console.error("Cloudinary upload failed:", responseBody);
            return null;
        }

        const responseData: unknown = JSON.parse(responseBody);
        if (
            typeof responseData === "object"
            && responseData !== null
            && "secure_url" in responseData
            && typeof responseData.secure_url === "string"
        ) {
            return responseData.secure_url;
        }

        console.error("Cloudinary upload response did not include a secure URL.");
        return null;
    } catch (err) {
        console.error("Cloudinary upload exception:", err);
        return null;
    }
}

/**
 * Upload a profile avatar — compressed to 400×400, 70% quality.
 */
export async function uploadAvatar(
    uri: string,
    accessToken: string,
): Promise<string | null> {
    return uploadToCloudinary({
        uri,
        accessToken,
        folder: "avatars",
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.7,
    });
}

/**
 * Upload a hangout cover image — compressed to 800px wide, 70% quality.
 */
export async function uploadHangoutCover(
    uri: string,
    accessToken: string,
): Promise<string | null> {
    return uploadToCloudinary({
        uri,
        accessToken,
        folder: "hangouts",
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.7,
    });
}
