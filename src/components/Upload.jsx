// Upload.jsx 
import React, { useState, useRef } from 'react';
import { Box, Button, Icon, Text, VStack, useToast } from '@chakra-ui/react';
import { LuUpload } from "react-icons/lu"; // For dropzone icon
import FileUploadList from "./FileUploadList"; 

function Upload() {
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const inputRef = useRef(null); 
  const toast = useToast();
  const MAX_FILES = 1;
  const MAX_SIZE_MB = 10; 

  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    if (newFiles.length === 0) return;

    const validFiles = [];
    const oversizedFiles = [];
    const wrongTypeFiles = []; 

    newFiles.forEach(file => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        oversizedFiles.push(file.name);
        return;
      }
      // const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
      // if (!allowedTypes.includes(file.type)) {
      //   wrongTypeFiles.push(file.name);
      //   return;
      // }
      validFiles.push(file);
    });

    if (oversizedFiles.length > 0) {
      toast({
        title: "File(s) too large",
        description: `${oversizedFiles.join(', ')} exceed the ${MAX_SIZE_MB}MB limit.`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
    // Handle wrongTypeFiles toast similarly if you implement type checking

    setSelectedFiles(prevFiles => {
      const combined = [...prevFiles, ...validFiles];
      return combined.slice(0, MAX_FILES);
    });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileNameToRemove) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file.name !== fileNameToRemove));
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
  };

  const triggerFileInput = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedFiles = Array.from(event.dataTransfer.files);
    // For now, let's simulate by passing to a modified handler:
    processDroppedFiles(droppedFiles);
    // Reset drag state
    event.currentTarget.style.borderColor = 'gray.300';
  };

  const processDroppedFiles = (newFiles) => {
    // Similar logic to handleFileChange's processing part
    if (newFiles.length === 0) return;
    const validFiles = []; /* ... validation logic ... */
    newFiles.forEach(file => { /* ... validation ... */ validFiles.push(file); });
    setSelectedFiles(prevFiles => [...prevFiles, ...validFiles].slice(0, MAX_FILES));
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.style.borderColor = 'blue.500';
  };
  const handleDragLeave = (event) => {
    event.currentTarget.style.borderColor = 'gray.300';
  }


  return (
    <VStack spacing={4} align="stretch" maxW="xl" mx="auto">
      
      <input
        type="file"
        multiple 
        //accept="image/*,video/*,audio/*" 
        accept="image/*,video/*,audio/wav"
        onChange={handleFileChange}
        ref={inputRef}
        style={{ display: 'none' }}
      />

      <Box
        p={10}
        borderWidth="2px"
        borderRadius="lg"
        borderStyle="dashed"
        borderColor="gray.300"
        textAlign="center"
        cursor="pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileInput} 
        _hover={{ borderColor: 'blue.400' }}
      >
        <Icon as={LuUpload} boxSize="50px" color="gray.500" mb={3} />
        <Text fontWeight="medium">Drag and drop files here, or click to select</Text>
        <Text fontSize="sm" color="gray.500">
          Images, Videos, Audio up to {MAX_SIZE_MB}MB each. Max {MAX_FILES} files.
        </Text>
      </Box>

      <FileUploadList
        files={selectedFiles}
        onRemoveFile={handleRemoveFile}
        onClearAllFiles={handleClearAllFiles} 
      />
    </VStack>
  );
}

export default Upload;