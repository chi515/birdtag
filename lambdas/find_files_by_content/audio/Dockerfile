FROM public.ecr.aws/lambda/python:3.11

ENV MPLCONFIGDIR=/tmp
ENV TRANSFORMERS_CACHE=/tmp
ENV TORCH_HOME=/tmp
ENV NUMBA_CACHE_DIR=/tmp
ENV NUMBA_DISABLE_CACHE=1
ENV XDG_CACHE_HOME=/tmp

# Install system-level dependencies
RUN yum install -y \
    ffmpeg \
    mesa-libGL \
    libsndfile \
    unzip \
 && yum clean all

RUN pip install --no-cache-dir pandas==1.5.3 numpy==1.24.4

COPY BirdNET-Analyzer /opt/BirdNET-Analyzer
RUN pip install --no-cache-dir /opt/BirdNET-Analyzer

COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_handler.lambda_handler"]
