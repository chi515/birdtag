// src/api/uploadVideo.js
import { useMutation, useQueryClient } from "@tanstack/react-query";

const performVideoUpload = async ({ files }) => {
  if (!files || files.length === 0) {
    throw new Error("No file selected for upload.");
  }
  const file = files[0];

  const userIdFromStorage = sessionStorage.getItem('userId');
  const idToken = sessionStorage.getItem('idToken'); // Or 'accessToken'

  if (!userIdFromStorage) {
    console.error("Upload cancelled: User ID not found in session storage.");
    throw new Error("User not authenticated or user ID is missing. Please log in again.");
  }
  if (!idToken) {
    console.error("Upload cancelled: Authentication token (IdToken/AccessToken) not found in session storage.");
    throw new Error("Authentication token not found. Please log in again.");
  }

  
  const payload = {
    content_type: file.type, 
    file_name: file.name,
    user_id: userIdFromStorage, // Using hardcoded for now as in the example
    //user_id: "test123", // As per your uploadImage.js
  };

  // Using the same API URL as your uploadImage.js, assuming backend handles different types
  const apiUrl = "https://rzn7r8fnjb.execute-api.ap-southeast-2.amazonaws.com/testing/upload-url";

  try {
    console.log("Uploading video payload:", payload);
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
      try { 
        errorData = await response.json(); 
      } catch (e) { 
        errorData = { 
          message: response.statusText || "Unknown server error" 
        };
      }
      const error = new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
      error.status = response.status; error.data = errorData; throw error;
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




export const useUploadVideo = (userId, successCB, failureCB) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performVideoUpload,
    onSuccess: (data, variables) => {
      console.log("Video upload successful in useMutation:", data);
      if (successCB && typeof successCB === 'function') {
        successCB(data);
      }
      // Invalidate a different query key for videos if needed
      queryClient.invalidateQueries({
        queryKey: ["user", userId, "videos"], // Example for videos
      });
    },
    onError: (error, variables) => {
      console.error("Video upload failed in useMutation:", error);
      if (failureCB && typeof failureCB === 'function') failureCB(error);
    },
  });
};