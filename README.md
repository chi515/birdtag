# Python Scripts and Corresponding Lambda Functions

* lambda/bird_detection_lambda/
This folder contains all files needed to build a Docker image for the bird_detection Lambda function.

* lambda/birdnet_lambda/
This folder contains all files needed to build a Docker image for the birdnet_audio Lambda function.

* lambda/find_files_by_content/audio/
This folder contains all files needed to build a Docker image for the search_by_audio Lambda function.

* lambda/find_files_by_content/image_video/
This folder contains all files needed to build a Docker image for the search_by_vid_img Lambda function. 

The Dockerfiles install the necessary dependencies to enable bird species detection from uploaded files. Once built, the image is pushed to AWS Elastic Container Registry (ECR) and linked to the corresponding Lambda for runtime execution.

* Other scripts
All remaining Python scripts are named after and correspond directly to their respective Lambda functions.
