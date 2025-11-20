// src/api/mediaActions.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { authenticatedFetch } from '../utils/apiClient'; 

const MANAGE_TAGS_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/manage_tags";
const DELETE_FILES_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/delete";

// --- Manage Tags ---
const performManageTags = async ({ s3Urls, operation, tags, userId }) => {

  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) throw new Error("Auth token not found");


  const payload = {
    url: s3Urls,
    operation: operation,
    tags: tags, 
    user_id: userId, 
  };

  const response = await fetch(MANAGE_TAGS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) { 
    let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText || "API error processing Manage Tags" };
      }
      const error = new Error(
        `API Error ${response.status}: ${errorData.message || response.statusText}`
      );
      error.status = response.status;
      error.data = errorData;
      throw error;
  }
  return response.json();
};

export const useManageTags = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: performManageTags,
    onSuccess: (data, variables) => {
      console.log("Manage tags successful:", data);
      // Invalidate queries for search results or user's media list
      // to reflect tag changes.
      // queryClient.invalidateQueries({ queryKey: ['media', variables.userId] });
      // queryClient.invalidateQueries({ queryKey: ["user", variables.userId, "mediaSearchResults"] });
      // Or more specifically if you have query keys for individual items by ID
      if (variables.fileIds && variables.userId) {
          variables.fileIds.forEach(id => {
              queryClient.invalidateQueries({ queryKey: ['mediaItem', id] }); // Example
          });
          queryClient.invalidateQueries({ queryKey: ["user", variables.userId, "mediaSearchResults"] }); // Refresh search
      }
    },
    onError: (error) => { console.error("Manage tags failed:", error); },
  });
};


// --- Delete Files ---
const performDeleteFiles = async ({ s3Urls, userId }) => {
  // fileIds: array of strings (DynamoDB item 'id's)
  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) throw new Error("Auth token not found");

  // Similar to manage_tags, lambda expects "urls". This needs clarification.
  // Assuming for now `fileIds` are the URLs or can be mapped to URLs lambda expects.
  const payload = {
    //urls: fileIds, 
    urls: s3Urls,
    user_id: userId,
  };

  console.log("performDeleteFiles: Sending payload to Lambda:", JSON.stringify(payload, null, 2));

  const response = await fetch(DELETE_FILES_API_URL, {
    method: "POST", 
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) { 
    let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText || "API error processing file delete" };
      }
      const error = new Error(
        `API Error ${response.status}: ${errorData.message || response.statusText}`
      );
      error.status = response.status;
      error.data = errorData;
      throw error;
  }
  return response.json();
};

export const useDeleteFiles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: performDeleteFiles,
    onSuccess: (data, variables) => {
      console.log("Delete files successful:", data);
      // Invalidate queries to refresh lists
      if (variables.fileIds && variables.userId) {
          variables.fileIds.forEach(id => {
              queryClient.invalidateQueries({ queryKey: ['mediaItem', id] });
          });
          queryClient.invalidateQueries({ queryKey: ["user", variables.userId, "mediaSearchResults"] });
      }
    },
    onError: (error) => { console.error("Delete files failed:", error); },
  });
};