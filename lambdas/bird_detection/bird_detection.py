#!/usr/bin/env python
# coding: utf-8

# requirements
# !pip install ultralytics supervision

from ultralytics import YOLO
import supervision as sv
import cv2 as cv
import numpy as np
import matplotlib.pyplot as plt
import os
import boto3
import requests
import json

# Model path
MODEL_BUCKET = 'birdtag-cloud170'
MODEL_KEY = 'models/model.pt'
MODEL_PATH = '/tmp/model.pt'
s3_client = boto3.client('s3')

# Cached model
yolo_model = None

def load_model():
    
    global yolo_model
    
    if yolo_model is None:
        if not os.path.exists(MODEL_PATH):
            
            print("Downloading model from S3...")
            s3_client.download_file(MODEL_BUCKET, MODEL_KEY, MODEL_PATH)

        yolo_model = YOLO(MODEL_PATH)

    return yolo_model

## Image Detection
def image_prediction(image_path, confidence=0.3):
    model = load_model()
    class_dict = model.names

    result = model(image_path)[0]
    detections = sv.Detections.from_ultralytics(result)

    species_counts = {}

    if detections.class_id is not None:
        detections = detections[(detections.confidence > confidence)]

        for cls_id in detections.class_id:
            species = class_dict[cls_id].lower()
            species_counts[species] = species_counts.get(species, 0) + 1

    return json.dumps(species_counts)


## Video Detection
def video_prediction(video_path, confidence=0.3):

    try:
        # Load video info and extract width, height, and frames per second (fps)
        video_info = sv.VideoInfo.from_video_path(video_path=video_path)
        w, h, fps = int(video_info.width), int(video_info.height), int(video_info.fps)

        model = load_model()
        tracker = sv.ByteTrack(frame_rate=fps)  # Initialize the tracker with the video's frame rate
        class_dict = model.names  # Get the class labels from the model
        max_species_counts = {}
        
        # Capture the video from the given path
        cap = cv.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Error: couldn't open the video!")

        # Process the video frame by frame
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:  # End of the video
                break

            # Make predictions on the current frame using the YOLO model
            result = model(frame)[0]
            detections = sv.Detections.from_ultralytics(result)  # Convert model output to Detections format
            detections = tracker.update_with_detections(detections=detections)  # Track detected objects

            # Filter detections based on confidence
            if detections.tracker_id is not None:
                detections = detections[(detections.confidence > confidence)]  # Keep detections with confidence greater than a threashold

                frame_species_counts = {}
                for cls_id in detections.class_id:
                    species = class_dict[cls_id].lower()
                    frame_species_counts[species] = frame_species_counts.get(species, 0) + 1

                for species, count in frame_species_counts.items():
                    cur_max = max_species_counts.get(species, 0)
                    if count > cur_max:
                        max_species_counts[species] = count
        
    except Exception as e:
        print(f"An error occurred: {e}")

    finally:
        # Release resources
        cap.release()
        print("Video processing complete, Released resources.")
        return json.dumps(max_species_counts)

