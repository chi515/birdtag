// src/api/subscriptionService.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const GET_SUBSCRIPTIONS_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/get-subscriptions"; // Replace with actual URL
const MANAGE_SUBSCRIPTIONS_API_URL = "https://d952qkt2xf.execute-api.ap-southeast-2.amazonaws.com/prod/manage-subscriptions"; // Your existing endpoint

// --- Fetch current subscriptions ---
const fetchUserSubscriptions = async () => {
  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) {
    console.error("fetchUserSubscriptions: No idToken found in sessionStorage.");
    throw new Error("Not authenticated to fetch subscriptions.");
  }

  const response = await fetch(GET_SUBSCRIPTIONS_API_URL, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (!response.ok) { 
    let errorData = { message: `Failed to fetch subscriptions. Status: ${response.status} ${response.statusText}` };
    try {
      const backendError = await response.json();
      if (backendError && backendError.message) {
        errorData.message = backendError.message;
      } else if (backendError && backendError.error) { // Common pattern for error objects
        errorData.message = backendError.error;
      }
    } catch (e) {
      // If response body is not JSON or empty
      console.warn("Could not parse error response from fetchUserSubscriptions as JSON.");
    }
    console.error("fetchUserSubscriptions API error:", errorData.message);
    throw new Error(errorData.message); // Throw an error for React Query to catch
  }
  const data = await response.json(); // Expects { subscribed_tags: ["tag1", "tag2"] }
  console.log("fetchUserSubscriptions - API response data:", data);
  return data;
};

export const useGetUserSubscriptions = (userId) => { // Pass userId to make queryKey user-specific
  return useQuery({
    queryKey: ['userSubscriptions', userId],
    queryFn: fetchUserSubscriptions,
    enabled: !!userId, // Only run query if userId is available
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// --- Update subscriptions ---
const updateUserSubscriptions = async ({ tags, userId }) => { // tags is an array of strings
  const idToken = sessionStorage.getItem('idToken');
  if (!idToken) throw new Error("Not authenticated to update subscriptions.");

  const payload = {
    tags: tags, // Array of tag strings (e.g., ["crow", "pigeon"])
    // Lambda will get user_id and email from authorizer claims
    // but if your lambda also uses user_id from body as fallback:
    // user_id: userId
  };
  console.log("Updating subscriptions with payload:", payload);

  const response = await fetch(MANAGE_SUBSCRIPTIONS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) { 
    let errorData; try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText || "Unknown server error" };}
    const error = new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
    error.status = response.status; error.data = errorData; throw error;
    }
  return response.json(); // Expects { message: "..." }
};

export const useUpdateUserSubscriptions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserSubscriptions,
    onSuccess: (data, variables) => {
      console.log("Subscriptions updated successfully:", data);
      // Invalidate the user's subscriptions query to refetch
      if (variables.userId) { // Assuming userId was passed to mutateAsync in variables
        queryClient.invalidateQueries({ queryKey: ['userSubscriptions', variables.userId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['userSubscriptions'] }); // More general invalidation
      }
      // Show success toast
    },
    onError: (error) => {
      console.error("Failed to update subscriptions:", error);
      // Show error toast
    },
  });
};