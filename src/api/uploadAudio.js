// src/api/uploadAudio.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
//import { fileToBase64 } from "../utils/fileToBase64"; // Assuming audio is also sent as Base64

const performAudioUpload = async ({ files }) => { // userId will be fetched from sessionStorage
  if (!files || files.length === 0) {
    throw new Error("No audio file selected for upload.");
  }
  const file = files[0];

  const userIdFromStorage = sessionStorage.getItem('userId');
  const idToken = sessionStorage.getItem('idToken');

  if (!userIdFromStorage) {
    console.error("Upload cancelled: User ID not found in session storage for audio.");
    throw new Error("User not authenticated or user ID is missing. Please log in again.");
  }
  if (!idToken) {
    console.error("Upload cancelled: Auth token not found for audio.");
    throw new Error("Authentication token not found. Please log in again.");
  }

  const payload = {
    file_name: file.name,
    user_id: userIdFromStorage, // Or 'sub' if backend expects that
    content_type: file.type,    // Send content type for backend to know
  };

  // Assuming you use the SAME backend endpoint for all uploads
  const apiUrl = "https://rzn7r8fnjb.execute-api.ap-southeast-2.amazonaws.com/testing/upload-url";

  try {
    console.log("Uploading audio with payload:", payload);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); }
      catch (e) { errorData = { message: response.statusText || "Unknown server error during audio upload" }; }
      const error = new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
      error.status = response.status; error.data = errorData;
      throw error;
    }

    //const data = await response.json();
    const { upload_url: s3PresignedUploadUrl, s3_key: s3ObjectKey } = await response.json(); 
    console.log("Received S3 Presigned Upload URL:", s3PresignedUploadUrl);
    console.log("Received S3 Object Key:", s3ObjectKey); 

    console.log(`Attempting to PUT file to S3: ${file.name} of type ${file.type}`); 
  try {
    const s3UploadResponse = await fetch(s3PresignedUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type, 
      },
      body: file,
    });

    console.log("S3 PUT Response Status:", s3UploadResponse.status); 
    console.log("S3 PUT Response OK:", s3UploadResponse.ok); 

    if (!s3UploadResponse.ok) {
      const s3ErrorText = await s3UploadResponse.text();
      console.error("S3 Upload Failed. Status:", s3UploadResponse.status, "Response Text:", s3ErrorText); 
      throw new Error(`S3 upload failed: ${s3UploadResponse.status} ${s3UploadResponse.statusText}. S3 Response: ${s3ErrorText}`);
    }

    console.log("File uploaded successfully to S3 via presigned URL!");

    return {
      message: "File uploaded successfully to S3!",
      s3Key: s3ObjectKey,
      s3Url: s3PresignedUploadUrl.split('?')[0]
    };

  } catch (s3PutError) {
    console.error("Error during PUT to S3:", s3PutError);
    throw s3PutError; 
  }


    //return data;
  } catch (error) {
    console.error("Error during video upload:", error);
    if (error instanceof Error) throw error;
    else throw new Error("An unexpected error occurred during video upload.");
  }

};

export const useUploadAudio = (userIdForQueryKey, successCB, failureCB) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performAudioUpload,
    onSuccess: (data, variables) => {
      console.log("Audio upload successful in useMutation:", data);
      if (successCB && typeof successCB === 'function') {
        successCB(data);
      }
      queryClient.invalidateQueries({
        queryKey: ["user", userIdForQueryKey, "audio"], // Example for audio
      });
    },
    onError: (error, variables) => {
      console.error("Audio upload failed in useMutation:", error);
      if (failureCB && typeof failureCB === 'function') {
        failureCB(error);
      }
    },
  });
};