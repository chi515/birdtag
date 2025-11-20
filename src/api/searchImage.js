// src/api/searchImage.js

import { useMutation, useQueryClient } from "@tanstack/react-query";

const performMediaSearch = async ({ tags: tagsObjectFromHome, userId }) => { 
  // tagsObjectFromHome is already in the format like: { "crow": 1, "pigeon": 2 }

  if (!tagsObjectFromHome || Object.keys(tagsObjectFromHome).length === 0) {
    // Or handle as "no tags provided, return all" if backend supports
    throw new Error("No tags provided for search.");
  }
  if (!userId) { // Assuming userId is still needed for some backend logic or context
    throw new Error("User ID is required for search.");
  }

  const apiUrl = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/search";

  console.log("Searching media with payload (from searchImage.js):", tagsObjectFromHome);
  console.log("User ID for search (from searchImage.js):", userId); 

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionStorage.getItem('idToken') || ''}`,
      },
      body: JSON.stringify(tagsObjectFromHome),
    });

    if (!response.ok) {
      let errorData; try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText || "Unknown server error" };}
      const error = new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
      error.status = response.status; error.data = errorData; throw error;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during media search:", error);
    if (error instanceof Error) throw error;
    else throw new Error("An unexpected error occurred during search.");
  }
};

const handleSearchWithFile = async () => {
  if (!queryFile) { alert("Please select a file."); return; }
  if (authLoading) { alert("Authentication loading..."); return; }
  if (!isAuthenticated || !userId) { alert("Please log in."); return; }
  if (isUploadingToTemp || isAnalyzingAndSearching) { alert("A search process is already ongoing."); return; }

  setSearchResults([]); 
  setTempFileIdForQuery(null); 
  setPollingStatusMessage(''); 

  try {
    // === STEP 1: GET PRESIGN URL PUT URL ===
    setIsUploadingToTemp(true); 
    setPollingStatusMessage("Preparing your file for analysis...");
    const presignData = await getTempUploadUrlMutation.mutateAsync({
      fileName: queryFile.name,
      contentType: queryFile.type,
      userId: userId,
    });

    if (!presignData || !presignData.upload_url || !presignData.s3_key || !presignData.file_id) {
      throw new Error("Failed to get all necessary temporary upload details from server.");
    }
    const tempFileId = presignData.file_id; 
    setTempFileIdForQuery(tempFileId);


    // === STEP 2: SEARCH FILE PUT  S3 tmp ===
    setPollingStatusMessage(`Uploading ${queryFile.name} for analysis...`);
    await uploadFileToS3PresignedUrl({ 
      presignedPutUrl: presignData.upload_url,
      file: queryFile,
    });
    setIsUploadingToTemp(false); // tmp upload done
    // S3 trigger analysis_lambda (Rekognition)


    // === STEP 3: START pollResults ===
    setIsAnalyzingAndSearching(true); 
    setPollingStatusMessage("Analyzing file and searching your album... This may take a moment.");

    let attempts = 0;
    const maxAttempts = 20;
    const pollInterval = 3000; 

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for results (attempt ${attempts}/${maxAttempts}) for temp_file_id: ${tempFileId}`);
      try {
        const pollResponse = await pollResultsMutation.mutateAsync({
          temp_file_id: tempFileId,
          userId: userId, 
        });

        if (pollResponse.status === 'COMPLETED') {
          setPollingStatusMessage('Search complete!');
          if (pollResponse.results && Array.isArray(pollResponse.results)) {
            setSearchResults(pollResponse.results);
            if (pollResponse.results.length === 0) {
              toast({ title: "No Similar Media Found", description: "No media in your album matched the tags from the uploaded file.", status: "info", duration: 5000, isClosable: true });
            }
            if (pollResponse.discovered_tags && pollResponse.discovered_tags.length > 0) {
                 toast({ title: "Tags Discovered", description: `Searched based on: ${pollResponse.discovered_tags.join(', ')}`, status: "success", duration: 4000, isClosable: true });
            }
          } else {
            throw new Error("Search complete but results format is invalid.");
          }
          setIsAnalyzingAndSearching(false);
          return;
        } else if (pollResponse.status === 'FAILED') {
          throw new Error(pollResponse.message || "Backend processing of query file failed.");
        } else if (pollResponse.status === 'PENDING') {
          setPollingStatusMessage(`Still analyzing... (Attempt ${attempts}/${maxAttempts})`);
        } else {
          console.warn("Unknown polling status:", pollResponse.status);
          setPollingStatusMessage(`Processing... (Attempt ${attempts}/${maxAttempts})`);
        }
      } catch (pollError) {
        console.error(`Polling attempt ${attempts} failed:`, pollError);
        if (attempts >= maxAttempts) {
            throw new Error(`Polling failed after ${maxAttempts} attempts. ${pollError.message}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    throw new Error("Timeout: Search results not available after multiple polling attempts.");

  } catch (error) {
    console.error("Full Search by File Content process failed:", error);
    toast({ title: "Search Process Failed", description: error.message || "An unknown error occurred.", status: "error", duration: 7000, isClosable: true });
    setPollingStatusMessage(`Error: ${error.message || "Unknown error"}`); // showing error on the UI
    setSearchResults([]);
  } finally {
    setIsUploadingToTemp(false);
    setIsAnalyzingAndSearching(false);
    // pollingStatusMessage keep messages
  }
};

export const useSearchMedia = (userIdForQueryKey, successCB, failureCB) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: performMediaSearch,
    onSuccess: (data, variables) => {
      console.log("Search successful in useMutation:", data);
      if (successCB) successCB(data);
      if (userIdForQueryKey) {
        queryClient.invalidateQueries({ queryKey: ["user", userIdForQueryKey, "mediaSearchResults"] }); // Example query key
      }
    },
    onError: (error, variables) => {
      console.error("Search failed in useMutation:", error);
      if (failureCB) failureCB(error);
    },
  });
};