// src/api/queryFileService.js
import { useMutation } from '@tanstack/react-query';

const GET_TEMP_UPLOAD_URL_API = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/find-by-file-content"; 

const POLL_QUERY_RESULTS_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/get-query-by-file-results"; 


/**
 * Step 1: Get a presigned URL to upload the query file to a temporary S3 location.
 */
const fetchTempUploadUrl = async ({ fileName, contentType, userId }) => {
  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) {
    console.error("fetchTempUploadUrl: No idToken found.");
    throw new Error("Authentication token not found. Please log in.");
  }

  // if (contentType == 'image/jpeg'){
  //     contentType = 'image/jpg'
  // }

  const payload = {
    file_name: fileName,
    content_type: contentType,
    user_id: userId,
  };

  console.log("Requesting temp S3 upload URL with payload:", payload);
  const response = await fetch(GET_TEMP_UPLOAD_URL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData = { message: `Failed to get temp upload URL. Status: ${response.status}` };
    try { errorData = await response.json(); } catch (e) { }
    console.error("fetchTempUploadUrl API Error:", errorData);
    throw new Error(errorData.message || `API Error ${response.status}`);
  }
  const data = await response.json();
  // Lambda `presign_url_to_tmp` should return { upload_url, s3_key, file_id (or file_id) }
  if (!data.upload_url || !data.s3_key || !data.file_id) {
    console.error("Invalid response from temp upload URL API:", data);
    throw new Error("Invalid response: 'upload_url', 's3_key', or 'file_id' missing.");
  }
  console.log("fetchTempUploadUrl success data:", data);
  return data;
};

export const useGetTempUploadUrl = () => {
  return useMutation({ mutationFn: fetchTempUploadUrl });
};


/**
 * Step 2: Upload the actual file to the S3 presigned URL (helper function).
 */
export const uploadFileToS3PresignedUrl = async ({ presignedPutUrl, file }) => {
  if (!presignedPutUrl || !file) {
    throw new Error("Missing presignedPutUrl or file for S3 upload.");
  }
  console.log(`Uploading file '${file.name}' to S3 temporary location. Content-Type: ${file.type}`);
  const s3UploadResponse = await fetch(presignedPutUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type }, 
    body: file,
  });

  if (!s3UploadResponse.ok) {
    const s3ErrorText = await s3UploadResponse.text().catch(() => "S3 returned non-XML error or empty body");
    console.error("S3 Temp Upload Failed. Status:", s3UploadResponse.status, "Response Text:", s3ErrorText);
    throw new Error(`S3 temporary upload failed: ${s3UploadResponse.status} ${s3UploadResponse.statusText}. S3 Response: ${s3ErrorText}`);
  }
  console.log("Query file successfully uploaded to S3 temporary location.");
  return { success: true };
};


/**
 * Step 3: Poll/Fetch the final search results using the file_id.
 */
const pollForQueryResults = async ({ file_id, userId }) => {
  if (!file_id) throw new Error("'file_id' is required for polling results.");

  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) throw new Error("Auth token not found for polling results.");
  console.log("file_id:",file_id)
  console.log("userId:",userId)
  const payload = {
    job_id: file_id,
    user_id: userId, 
  };

  console.log("Polling for final search results with payload:", payload);
  const response = await fetch(POLL_QUERY_RESULTS_API_URL, { 
    method: "POST", 
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData = { message: `Polling for results failed. Status: ${response.status}` };
    try { errorData = await response.json(); } catch (e) { }
    console.error("pollForQueryResults API Error:", errorData);
    throw new Error(errorData.message || `Polling API Error ${response.status}`);
  }
  const data = await response.json();
  if (!data || !data.status) {
    console.error("Invalid response format from polling API:", data);
    throw new Error("Invalid response format from polling API.");
  }
  console.log("pollForQueryResults API success data:", data);
  return data;
};

export const usePollQueryResults = () => { 
  return useMutation({ mutationFn: pollForQueryResults });
};