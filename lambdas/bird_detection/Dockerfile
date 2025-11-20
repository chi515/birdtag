FROM public.ecr.aws/lambda/python:3.10

# Install system-level dependencies
RUN yum install -y mesa-libGL && yum clean all

ENV MPLCONFIGDIR=/tmp
ENV TRANSFORMERS_CACHE=/tmp
ENV TORCH_HOME=/tmp


RUN pip install --no-cache-dir \
    numpy==1.24.4 \
    torch==2.2.2 \
    torchvision==0.17.2 \
    ultralytics==8.3.148 \
    supervision==0.25.1 \
    opencv-python-headless==4.9.0.80 \
    matplotlib \
    requests \
    boto3

# Copy your handler
COPY bird_detection.py bird_detection_lambda.py ${LAMBDA_TASK_ROOT}/

# Set handler
CMD ["bird_detection_lambda.lambda_handler"]

# RUN pip install --no-cache-dir torch==2.2.2 torchvision==0.17.2
# RUN pip install --no-cache-dir ultralytics==8.3.148 supervision==0.25.1 \
#     opencv-python-headless==4.9.0.80 numpy requests boto3