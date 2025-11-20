// src/components/SearchByImages.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Button, Icon, Text, VStack, useToast,
  Spinner, HStack, Image, Heading, IconButton, Flex // Ensure Flex is imported
} from '@chakra-ui/react';
import { LuUpload, LuFile, LuSearch, LuImage, LuVideo, LuMusic } from "react-icons/lu"; 
import { IoIosCloseCircleOutline } from "react-icons/io";
import AlbumDisplay from './AlbumDisplay';
import { useGetTempUploadUrl, uploadFileToS3PresignedUrl, usePollQueryResults } from '../api/queryFileService';
import { isAuthenticated as checkAuthStatusFromService, getCurrentUser as getUserFromService } from './authService';

// Child component for individual file preview
const QueryFilePreview = ({ file }) => {
  const [previewSrc, setPreviewSrc] = useState(null);
  useEffect(() => {
    if (file && file.type && file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewSrc(null);
    }
  }, [file]);

  if (previewSrc) {
    return <Image src={previewSrc} alt={file.name} boxSize="60px" objectFit="contain" borderRadius="md" />;
  } else if (file) {
    let fileIcon = LuFile;
    if (file.type.startsWith('video/')) fileIcon = LuVideo;
    else if (file.type.startsWith('audio/')) fileIcon = LuMusic;
    else if (file.type.startsWith('image/')) fileIcon = LuImage; // Fallback for image if no previewSrc yet
    return <Icon as={fileIcon} boxSize="40px" color="gray.400" />;
  }
  return null;
};


function SearchByImages() {
  const [queryFile, setQueryFile] = useState(null);
  const inputRef = useRef(null);
  const toast = useToast();
  const MAX_SIZE_MB = 10; // Max size for the query file

  const [searchResults, setSearchResults] = useState([]);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [jobIdForPolling, setJobIdForPolling] = useState(null); // To store the job ID from step 1

  // Auth state
  const [userId, setUserId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setAuthLoading(true);
    const authStatus = checkAuthStatusFromService();
    setIsAuthenticated(authStatus);
    if (authStatus) {
      const currentUser = getUserFromService();
      if (currentUser && currentUser.id) {
        setUserId(currentUser.id);
      } else {
        console.warn("SearchByImages.jsx: User ID not found in session.");
        setIsAuthenticated(false);
        setUserId(null);
      }
    } else {
      setUserId(null);
    }
    setAuthLoading(false);
  }, []);

  const getTempUploadUrlMutation = useGetTempUploadUrl();
  const pollResultsMutation = usePollQueryResults(); // Hook for polling

  const handleFileSelection = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const file = incomingFiles[0];

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `${file.name} exceeds ${MAX_SIZE_MB}MB.`, status: "error", duration: 5000, isClosable: true });
      setQueryFile(null); return;
    }
    setQueryFile(file);
    setSearchResults([]);
    setCurrentStepMessage('');
    setJobIdForPolling(null); // Reset job ID when new file is selected
  };

  const handleFileChange = (event) => {
    handleFileSelection(Array.from(event.target.files));
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault(); event.stopPropagation();
    handleFileSelection(Array.from(event.dataTransfer.files));
    event.currentTarget.style.borderColor = 'gray.300';
  };
  const handleDragOver = (event) => {
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy'; event.currentTarget.style.borderColor = 'blue.500';
  };
  const handleDragLeave = (event) => { event.currentTarget.style.borderColor = 'gray.300'; };
  const triggerFileInput = () => { if (inputRef.current) inputRef.current.click(); };
  const handleClearQueryFile = () => { setQueryFile(null); setSearchResults([]); setCurrentStepMessage(''); setJobIdForPolling(null); };

  const handleSearchWithFile = async () => {
    if (!queryFile) { alert("Please select a file to search with."); return; }
    if (authLoading) { alert("Authentication loading, please wait."); return; }
    if (!isAuthenticated || !userId) { alert("You must be logged in to perform this search."); return; }
    if (getTempUploadUrlMutation.isPending || pollResultsMutation.isPending || currentStepMessage.includes("Uploading")) {
      alert("A search process is already ongoing."); return;
    }

    setSearchResults([]);
    let currentJobId = null; // To hold the job ID for this attempt

    try {
      // STEP 1: Get presigned URL for temporary upload
      setCurrentStepMessage("Step 1/3: Requesting upload location...");
      const presignData = await getTempUploadUrlMutation.mutateAsync({
        fileName: queryFile.name,
        contentType: queryFile.type,
        userId: userId,
      });
      

      console.log("presignData:", presignData)

      if (!presignData || !presignData.upload_url || !presignData.s3_key || !presignData.file_id) {
        throw new Error("Failed to get all necessary temporary upload details from server.");
      }
      currentJobId = presignData.file_id; // Store the file_id from this response
      setJobIdForPolling(currentJobId); // Also set to state if needed elsewhere, but currentJobId is safer for this flow

      // STEP 2: Upload query file to temp S3
      setCurrentStepMessage(`Step 2/3: Uploading ${queryFile.name} for analysis...`);
      await uploadFileToS3PresignedUrl({
        presignedPutUrl: presignData.upload_url,
        file: queryFile,
      });
      toast({ title: "Query file uploaded", description: "Analysis will start automatically.", status: "info", duration: 2000, isClosable: true });

      // STEP 3: Start polling for results
      setCurrentStepMessage("Step 3/3: Waiting for file analysis and search results...");
      let attempts = 0;
      const maxAttempts = 20;
      const pollInterval = 3000; // 3 seconds

      const poll = async () => {
        if (attempts >= maxAttempts) {
          throw new Error("Timeout: Search results not available after multiple polling attempts.");
        }
        attempts++;
        console.log(`Polling attempt ${attempts} for job ID: ${currentJobId}`);
        setCurrentStepMessage(`Analyzing (attempt ${attempts}/${maxAttempts})... Please wait.`);

        const pollResponse = await pollResultsMutation.mutateAsync({
          file_id: currentJobId, // Use the file_id from Step 1's response
          userId: userId,
        });

        if (pollResponse.status === 'COMPLETED') {
          setCurrentStepMessage('');
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
          return; // Exit polling
        } else if (pollResponse.status === 'FAILED') {
          throw new Error(pollResponse.message || "Backend processing of query file failed.");
        } else if (pollResponse.status === 'PROCESSING') {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          await poll(); // Recursive call for next poll
        } else {
            console.warn("Unknown or unexpected polling status:", pollResponse.status);
            await new Promise(resolve => setTimeout(resolve, pollInterval)); // Continue polling for a bit
            await poll();
        }
      };
      await poll();

    } catch (error) {
      console.error("Full Search by File Content process failed:", error);
      toast({ title: "Search Process Failed", description: error.message, status: "error", duration: 7000, isClosable: true });
      setCurrentStepMessage(`Error: ${error.message || "Process failed"}`);
      setSearchResults([]);
    }
  };

  const isLoadingOverall = getTempUploadUrlMutation.isPending ||
                           pollResultsMutation.isPending ||
                           currentStepMessage.includes("Uploading");

  return (
    <VStack spacing={6} align="stretch" maxW="2xl" mx="auto" py={8}>
      <Heading as="h2" size="lg" textAlign="center">Find Similar by File Content</Heading>
      <input
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileChange}
        ref={inputRef}
        style={{ display: 'none' }}
      />

      {!queryFile ? (
        <Box
          p={10} borderWidth="2px" borderRadius="lg" borderStyle="dashed"
          borderColor="gray.300" textAlign="center" cursor="pointer"
          onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onClick={triggerFileInput}
          _hover={{ borderColor: 'blue.400' }}
        >
          <Icon as={LuUpload} boxSize="50px" color="gray.500" mb={3} />
          <Text fontWeight="medium">Drop a file here, or click to select for analysis</Text>
          <Text fontSize="sm" color="gray.500">
            (Images, Videos, Audio up to {MAX_SIZE_MB}MB each. Max 1 file.)
          </Text>
        </Box>
      ) : (
        <VStack spacing={4} p={4} borderWidth="1px" borderRadius="lg" shadow="md" align="stretch">
          <Text fontWeight="medium" fontSize="lg">File for Analysis:</Text>
          <HStack spacing={4} align="center" p={3} bg="gray.50" borderRadius="md">
            <QueryFilePreview file={queryFile} />
            <VStack align="start" spacing={0} flex="1">
              <Text fontWeight="semibold" noOfLines={1} title={queryFile.name}>{queryFile.name}</Text>
              <Text fontSize="sm" color="gray.600">{(queryFile.size / 1024).toFixed(1)} KB</Text>
            </VStack>
            <IconButton
              aria-label="Clear selected file"
              icon={<Icon as={IoIosCloseCircleOutline} />} 
              variant="ghost"
              colorScheme="red"
              onClick={handleClearQueryFile}
              isDisabled={isLoadingOverall}
            />
          </HStack>
          <Button
            colorScheme="purple"
            leftIcon={<Icon as={LuSearch} />}
            onClick={handleSearchWithFile}
            isLoading={isLoadingOverall}
            loadingText={currentStepMessage || "Processing..."}
            size="lg"
            isDisabled={authLoading || !isAuthenticated || isLoadingOverall}
          >
            Find files
          </Button>
          {isLoadingOverall && currentStepMessage &&
            <HStack justifyContent="center" mt={2}>
                <Spinner size="sm" speed="0.65s" />
                <Text textAlign="center" color="blue.600" fontSize="sm">{currentStepMessage}</Text>
            </HStack>
          }
        </VStack>
      )}

      <AlbumDisplay
        items={searchResults}
        isLoading={pollResultsMutation.isPending && searchResults.length === 0 && !currentStepMessage.startsWith("Error")} 
      />
    </VStack>
  );
}

export default SearchByImages;