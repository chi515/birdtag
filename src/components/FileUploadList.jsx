// FileUploadList.jsx
import React, { useState, useEffect } from 'react';
import {
  Text, HStack, Box, Icon, IconButton, Button, Spinner, VStack, Progress, Image
} from "@chakra-ui/react"; // All standard Chakra UI imports
import { IoIosCloudUpload } from "react-icons/io";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";
import { LuX, LuFile } from "react-icons/lu";

import { useUploadImage } from '../api/uploadImage';
import { useUploadVideo } from '../api/uploadVideo';
import { useUploadAudio } from '../api/uploadAudio';

import {
  isAuthenticated as checkAuthStatusFromService,
  getCurrentUser as getUserFromService
} from './authService'; // Assuming path is correct

const getFileType = (fileName) => { /* ... (remains the same) ... */
  const ext = fileName.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','bmp','webp','svg'].includes(ext)) return 'image';
  if (['mp4','mov','avi','wmv','flv','mkv','webm'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','aac','flac'].includes(ext)) return 'audio';
  return 'other';
};

// Child component for individual file preview
const FileItemPreviewComponent = ({ file }) => {
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
    return <Image src={previewSrc} alt={file.name} boxSize="40px" objectFit="cover" borderRadius="sm" />;
  }
  return (
    <Box boxSize="40px" display="flex" alignItems="center" justifyContent="center" bg="gray.100" borderRadius="sm">
      <Icon as={LuFile} boxSize="24px" color="gray.500" />
    </Box>
  );
};


// FileUploadList now receives files and handlers as props
function FileUploadList({ files, onRemoveFile, onClearAllFiles }) {
  const [userId, setUserId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [uploadProgress, setUploadProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [isUploadingAnyFile, setIsUploadingAnyFile] = useState(false);

  useEffect(() => { 
    const authStatus = checkAuthStatusFromService(); setIsAuthenticated(authStatus);
    if (authStatus) { 
      const currentUser = getUserFromService(); 
      if (currentUser && currentUser.id) { 
        setUserId(currentUser.id); 
      } else { 
        console.warn("User ID not found..."); 
        setIsAuthenticated(false); 
      }}
    setAuthLoading(false);
  }, []);

  const imageUploadMutation = useUploadImage(userId);
  const videoUploadMutation = useUploadVideo(userId);
  const audioUploadMutation = useUploadAudio(userId);

  const updateFileProgress = (fileName, status, errorMsg = '') => { /* ... (same) ... */
    setUploadProgress(prev => ({ ...prev, [fileName]: { ...prev[fileName], status, errorMsg }}));
  };

  const handleUploadAllClick = async () => { /* ... (same multi-file upload logic as before) ... */
    if (authLoading || !isAuthenticated || !userId || files.length === 0 || isUploadingAnyFile) return;
    setIsUploadingAnyFile(true); setOverallProgress(0);
    const initialProgressState = files.reduce((acc, file) => { acc[file.name] = { status: 'pending' }; return acc; }, {});
    setUploadProgress(initialProgressState);
    let uploadedCount = 0; 
    let successCount = 0;
    const uploadPromises = files.map(async (file) => {
      updateFileProgress(file.name, 'uploading');
      const fileType = getFileType(file.name);
      const payload = { files: [file], userId: userId };
      try {
        let result;
        if (fileType === 'image') result = await imageUploadMutation.mutateAsync(payload);
        else if (fileType === 'video') result = await videoUploadMutation.mutateAsync(payload);
        else if (fileType === 'audio') result = await audioUploadMutation.mutateAsync(payload);
        else { updateFileProgress(file.name, 'skipped'); return { status: 'skipped', fileName: file.name }; }
        updateFileProgress(file.name, 'success'); successCount++;
        return { status: 'success', fileName: file.name, data: result };
      } catch (error) {
        updateFileProgress(file.name, 'error', error.message || 'Upload failed');
        return { status: 'failed', fileName: file.name, error };
      } finally {
        uploadedCount++;
        setOverallProgress(Math.round((uploadedCount / files.length) * 100));
      }
    });
    const results = await Promise.allSettled(uploadPromises);
    // ... (alert logic based on results) ...
    const attemptedUploads = files.filter(f => getFileType(f.name) !== 'other').length;
    if (attemptedUploads === 0 && files.length > 0) alert("All selected files are of unsupported types.");
    else if (successCount === attemptedUploads) alert("All files uploaded successfully!");
    else if (successCount > 0) alert(`Successfully uploaded ${successCount} of ${attemptedUploads} files.`);
    else if (attemptedUploads > 0) alert("All attempted file uploads failed.");

    setIsUploadingAnyFile(false);
    setTimeout(() => {
        if (onClearAllFiles && typeof onClearAllFiles === 'function') { // Call prop to clear files in parent
            onClearAllFiles();
        }
        setUploadProgress({});
        setOverallProgress(0);
    }, 3000);
  };

  if (!files || files.length === 0) {
    return null; // No files to list, render nothing
  }

  return (
    <VStack spacing={3} mt={4} align="stretch"> {/* Use VStack as the main container for the list */}
      {isUploadingAnyFile && overallProgress < 100 && (
        <Box mb={2}> {/* Reduced margin for progress bar */}
          <Text mb={1} fontSize="xs" fontWeight="medium">Overall Progress:</Text>
          <Progress value={overallProgress} size="xs" colorScheme="green" hasStripe isAnimated />
        </Box>
      )}
      {files.map((file) => {
        const progressInfo = uploadProgress[file.name] || { status: 'pending' };
        const fileStatus = progressInfo.status;

        return (
          // Using Box and HStack for each file item
          <Box
            key={file.name}
            p={3} // Padding for the item
            borderWidth="1px"
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            opacity={fileStatus === 'uploading' ? 0.7 : 1}
            bg={fileStatus === 'success' ? 'green.50' : fileStatus === 'error' ? 'red.50' : 'white'}
          >
            <HStack flex="1" spacing={3} mr={2} alignItems="center">
              <FileItemPreviewComponent file={file} /> {/* Using our preview component */}
              <Box flex="1">
                <Text fontSize="sm" fontWeight="medium" noOfLines={1} title={file.name}>{file.name}</Text>
                <Text fontSize="xs" color="gray.500">{(file.size / 1024).toFixed(1)} KB</Text>
                {fileStatus !== 'pending' && (
                  <HStack mt={1} alignItems="center">
                    {fileStatus === 'uploading' && <Spinner size="xs" speed="0.65s" thickness="2px" color="blue.500" />}
                    {fileStatus === 'success' && <Icon as={IoCheckmarkCircle} color="green.500" />}
                    {fileStatus === 'error' && <Icon as={IoCloseCircle} color="red.500" />}
                    <Text fontSize="xs" ml={1} color={fileStatus === 'error' ? 'red.500' : 'inherit'}>
                      {/* ... (status text logic) ... */}
                      {fileStatus === 'skipped' ? 'Skipped' :
                       fileStatus === 'error' ? `Error` :
                       fileStatus === 'success' ? 'Uploaded' :
                       fileStatus === 'uploading' ? 'Uploading...' :
                       ''}
                    </Text>
                  </HStack>
                )}
              </Box>
            </HStack>
            <IconButton
              icon={<Icon as={LuX} />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemoveFile(file.name)} // Call prop to remove file
              isDisabled={isUploadingAnyFile}
            />
          </Box>
        );
      })}

      <VStack spacing={2} mt={4} w="full">
        <Button
          colorScheme="teal"
          variant="solid"
          onClick={handleUploadAllClick}
          isLoading={isUploadingAnyFile}
          loadingText="Uploading..."
          isDisabled={isUploadingAnyFile || files.length === 0 || authLoading || !isAuthenticated || !userId}
          leftIcon={<Icon as={IoIosCloudUpload} w={5} h={5} />}
          w="full"
        >
          Upload
        </Button>
        {onClearAllFiles && typeof onClearAllFiles === 'function' && (
          <Button
            onClick={() => {
                onClearAllFiles(); // Call prop
                setUploadProgress({});
                setOverallProgress(0);
            }}
            isDisabled={files.length === 0 || isUploadingAnyFile}
            variant="outline"
            w="full"
          >
            Clear List
          </Button>
        )}
      </VStack>
    </VStack>
  );
}

export default FileUploadList;