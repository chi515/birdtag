// src/api/uploadImage.js 

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "../utils/fileToBase64"; 


const performImageUpload = async ({ files }) => {
  if (!files || files.length === 0) {
    throw new Error("No file selected for upload.");
  }
  const file = files[0];

  const userIdFromStorage = sessionStorage.getItem('userId');
  const idToken = sessionStorage.getItem('idToken'); // Or 'accessToken'
  if (!userIdFromStorage) {
    // This case should ideally be prevented by UI checks (e.g., disabling upload button if not authenticated)
    // But it's good to have a safeguard here.
    console.error("Upload cancelled: User ID not found in session storage.");
    throw new Error("User not authenticated or user ID is missing. Please log in again.");
  }
  
  if (!idToken) {
    console.error("Upload cancelled: Authentication token (IdToken/AccessToken) not found in session storage.");
    throw new Error("Authentication token not found. Please log in again.");
  }

  let base64File;
  try {
    base64File = await fileToBase64(file);
  } catch (error) {
    console.error("Error converting file to Base64:", error);
    throw new Error("Failed to process file before upload.");
  }


  const payload = {
    file: base64File,     
    file_name: file.name,
    user_id: userIdFromStorage,
    //user_id: "test123",
  };



  const apiUrl = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/upload"; 

  try {
    console.log(payload)
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
        errorData = { message: response.statusText || "Unknown server error" };
      }
      const error = new Error(
        `API Error ${response.status}: ${errorData.message || response.statusText}`
      );
      error.status = response.status; 
      error.data = errorData;         
      throw error;
    }

    const data = await response.json();
    return data; 
  } catch (error) {
    console.error("Error during image upload:", error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error("An unexpected error occurred during upload.");
    }
  }
};

export const useUploadImage = (userId, successCB, failureCB) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performImageUpload, 
    onSuccess: (data, variables) => { 
      console.log("Upload successful in useMutation:", data);
      if (successCB && typeof successCB === 'function') {
        successCB(data); 
      }
      queryClient.invalidateQueries({
        queryKey: ["user", userId, "images"],
      });
    },
    onError: (error, variables) => { 
      console.error("Upload failed in useMutation:", error);
      if (failureCB && typeof failureCB === 'function') {
        failureCB(error); 
      }
    },
  });
};