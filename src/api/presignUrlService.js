// src/api/presignUrlService.js
import { useMutation } from '@tanstack/react-query'; 

const PRESIGN_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/presign";

/**
 * Fetches a presigned URL for a given S3 key.
 * @param {object} params
 * @param {string} params.s3_key - The S3 object key.
 * @returns {Promise<string>} The presigned URL.
 */
const fetchPresignedS3Url = async ({ s3_key }) => {
  if (!s3_key) {
    throw new Error("S3 key is required to fetch a presigned URL.");
  }

  const idToken = sessionStorage.getItem('idToken'); // Or accessToken
  if (!idToken) {
    // This should ideally be caught by UI/route guards before this point
    throw new Error("Authentication token not found. Cannot fetch presigned URL.");
  }

  console.log(`Requesting presigned URL for S3 key: ${s3_key}`);
  const response = await fetch(PRESIGN_API_URL, {
    method: "POST", // Or GET, depending on your API-Presign design
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ s3_key: s3_key }), // Send the S3 key
  });

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); }
    catch (e) { errorData = { message: response.statusText || "Failed to fetch presigned URL" }; }
    const error = new Error(`API Error ${response.status} (presigned URL): ${errorData.message || response.statusText}`);
    error.status = response.status; error.data = errorData;
    throw error;
  }

  const data = await response.json();
  if (!data.presigned_url) {
    throw new Error("Presigned URL not found in the API response.");
  }
  return data.presigned_url;
};


export const useGetPresignedUrl = () => {
  return useMutation({
    mutationFn: fetchPresignedS3Url,
    // onSuccess, onError can be handled where mutateAsync is called
  });
};