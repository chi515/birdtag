// authService.js

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";
import config from "../config.json";

export const cognitoClient = new CognitoIdentityProviderClient({
  region: config.region,
});

// Helper function to decode JWT (very basic, consider a library for production)
const decodeJWT = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to decode JWT", e);
    return null;
  }
};

export const signIn = async (username, password) => {
  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };
  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);
    const { AuthenticationResult } = response;
    if (AuthenticationResult && AuthenticationResult.AccessToken && AuthenticationResult.IdToken) {
      sessionStorage.setItem("accessToken", AuthenticationResult.AccessToken);
      sessionStorage.setItem("idToken", AuthenticationResult.IdToken);
      if (AuthenticationResult.RefreshToken) {
        sessionStorage.setItem("refreshToken", AuthenticationResult.RefreshToken);
      }

      // Decode IdToken to get user info (like sub for userId and expiry)
      const decodedIdToken = decodeJWT(AuthenticationResult.IdToken);
      if (decodedIdToken && decodedIdToken.exp) {
        sessionStorage.setItem("tokenExpiry", decodedIdToken.exp * 1000); // Store expiry in ms
      }
      if (decodedIdToken && decodedIdToken.sub) {
        sessionStorage.setItem("userId", decodedIdToken.sub); // Store user ID (sub)
        console.log("sub::")
        console.log(decodedIdToken.sub)
      }
      if (decodedIdToken && decodedIdToken.email) {
        sessionStorage.setItem("userEmail", decodedIdToken.email); // Store email
      }
      // You might want to store other claims from IdToken if needed

      return AuthenticationResult;
    } else {
      throw new Error("Sign in failed: AuthenticationResult or Tokens not found in response.");
    }
  } catch (error) {
    console.error("Error signing in: ", error);
    // Clean up any partially set tokens on failure
    signOutLocally(); // Call a local sign out to clear storage
    throw error;
  }
};

// Renamed signOut to signOutLocally to avoid conflict if we add a Cognito global sign out later
const signOutLocally = () => {
  sessionStorage.removeItem('idToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('tokenExpiry');
  sessionStorage.removeItem('userId');
  sessionStorage.removeItem('userEmail');
  console.log("User signed out (tokens and user info cleared locally)");
};

export const signUp = async (email, password, firstName, lastName ) => {
  // ... (signUp logic remains the same)
  const params = {
    ClientId: config.clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName },
    ],
  };
  try {
    const command = new SignUpCommand(params);
    const response = await cognitoClient.send(command);
    console.log("Sign up success: ", response);
    return response;
  } catch (error) {
    console.error("Error signing up: ", error);
    throw error;
  }
};


export const confirmSignUp = async (username, code) => {
  // ... (confirmSignUp logic remains the same)
  const params = {
    ClientId: config.clientId,
    Username: username,
    ConfirmationCode: code,
  };
  try {
    const command = new ConfirmSignUpCommand(params);
    await cognitoClient.send(command);
    console.log("User confirmed successfully");
    return true;
  } catch (error) {
    console.error("Error confirming sign up: ", error);
    throw error;
  }
};

export const signOut = async () => { // Keep this as the main signOut function
  try {
    // If you need to call a Cognito global sign out or revoke token, do it here.
    // For now, just clearing local storage.
    signOutLocally();
  } catch (error) {
    console.error("Error signing out: ", error);
    // Even if server-side signout fails, clear local storage
    signOutLocally();
    // Optionally re-throw or handle differently
  }
};

export const isAuthenticated = () => {
  const accessToken = sessionStorage.getItem('accessToken');
  const tokenExpiry = sessionStorage.getItem('tokenExpiry');

  if (!accessToken || !tokenExpiry) {
    return false;
  }

  if (Date.now() > parseInt(tokenExpiry, 10)) {
    console.log("Token has expired based on stored expiry time.");
    signOutLocally(); // Clear expired tokens
    return false;
  }

  return true;
};

export const getCurrentUser = () => {
  if (!isAuthenticated()) { // Use our isAuthenticated to check validity
    return null;
  }
  // Retrieve info stored during signIn
  const id = sessionStorage.getItem('userId');
  const email = sessionStorage.getItem('userEmail');

  if (id && email) {
    return { id, email /*, any other info you stored */ };
  }
  // If essential info is missing even if token seems valid, treat as not fully logged in
  // This case might indicate an issue with how data was stored during signIn
  console.warn("User data (id/email) missing from sessionStorage despite valid token.");
  return null;
};

export const fetchCognitoUserAttributes = async () => {
  const accessToken = sessionStorage.getItem('accessToken');
  if (!accessToken) {
    // console.log("No access token found to fetch user attributes.");
    return null;
  }

  // Optional: Add a client-side expiry check here too before making the API call
  const tokenExpiry = sessionStorage.getItem('tokenExpiry');
  if (tokenExpiry && Date.now() > parseInt(tokenExpiry, 10)) {
      console.log("Access token expired (client-side check), not fetching attributes.");
      signOutLocally();
      return null;
  }

  const params = {
    AccessToken: accessToken,
  };
  try {
    const command = new GetUserCommand(params);
    const response = await cognitoClient.send(command);
    // response.UserAttributes will be an array like:
    // [{ Name: "sub", Value: "uuid" }, { Name: "email", Value: "user@example.com" }, ...]
    const attributes = {};
    if (response.UserAttributes) {
      response.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
      // Ensure 'id' (sub) and 'email' are present for consistency with getCurrentUser
      if (attributes.sub) attributes.id = attributes.sub;
      return attributes;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user attributes from Cognito: ", error);
    // If GetUser fails (e.g., token revoked, expired server-side), sign out
    if (error.name === 'NotAuthorizedException' || error.name === 'ResourceNotFoundException' || error.name === 'InvalidParameterException') {
        signOutLocally();
    }
    return null;
  }
};

export const refreshSession = async () => {
  const refreshToken = sessionStorage.getItem('refreshToken');
  if (!refreshToken) {
    console.log("No refresh token available.");
    return false;
  }

  const params = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);
    const { AuthenticationResult } = response;

    if (AuthenticationResult && AuthenticationResult.AccessToken && AuthenticationResult.IdToken) {
      console.log("Session refreshed successfully.");
      sessionStorage.setItem("accessToken", AuthenticationResult.AccessToken);
      sessionStorage.setItem("idToken", AuthenticationResult.IdToken);
      // Cognito might or might not return a new RefreshToken. If it does, update it.
      if (AuthenticationResult.RefreshToken) {
        sessionStorage.setItem("refreshToken", AuthenticationResult.RefreshToken);
      }

      const decodedIdToken = decodeJWT(AuthenticationResult.IdToken);
      if (decodedIdToken && decodedIdToken.exp) {
        sessionStorage.setItem("tokenExpiry", decodedIdToken.exp * 1000);
      }
      // userId and userEmail should remain the same, but you could re-verify from new IdToken
      if (decodedIdToken && decodedIdToken.sub && !sessionStorage.getItem('userId')) {
        sessionStorage.setItem("userId", decodedIdToken.sub);
      }
      if (decodedIdToken && decodedIdToken.email && !sessionStorage.getItem('userEmail')) {
        sessionStorage.setItem("userEmail", decodedIdToken.email);
      }
      return true;
    } else {
      console.log("Failed to refresh session: No new tokens received.");
      signOutLocally(); // If refresh fails definitively, sign out
      return false;
    }
  } catch (error) {
    console.error("Error refreshing session: ", error);
    signOutLocally(); // Sign out on refresh error
    return false;
  }
};