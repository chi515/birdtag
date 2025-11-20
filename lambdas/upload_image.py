import json
import base64
import numpy as np
import uuid
import boto3
import mimetypes
import cv2
import os

s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
bucket_name = 'birdtag-cloud170'
table_name = 'birdtag_location'
table_name_user = 'birdtag_users'
original_prefix = 'raw/'
thumbnail_prefix = 'thumbnail/'


def create_thumbnail(image, size=150):
    h, w = image.shape[:2]
    if h > w:
        new_h = size
        new_w = int((new_h / h) * w)
    else:
        new_w = size
        new_h = int((new_w / w) * h)    
    resized_image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized_image


def lambda_handler(event, context):
    try:
        # parse incoming request
        body = json.loads(event['body'])
        user_id = body['user_id']
        file_b64 = body['file']
        file_name = body['file_name'] 

        # generate unique file id
        file_id = str(uuid.uuid4())

        # decode file
        decoded_file = base64.b64decode(file_b64)
                     
        # get file key
        _, ext = os.path.splitext(file_name)
        file_key = f'users/{user_id}/{original_prefix}{file_id}{ext}'

        # get content type 
        mimetype, _ = mimetypes.guess_type(file_name)
        if not mimetype:
            mimetype = 'application/octet-stream'
        
        # upload raw files to S3
        s3.put_object(Bucket=bucket_name, Key=file_key, Body=decoded_file, ContentType=mimetype)
                
        # create thumbnail
        if mimetype.startswith("video/"):
            tmp_path = f"/tmp/{file_name}"
            print(tmp_path)
            
            with open(tmp_path, "wb") as f:
                f.write(decoded_file)

            cap = cv2.VideoCapture(tmp_path)
            _, frame = cap.read()
            cap.release()
            thumbnail = create_thumbnail(frame)
        
        elif mimetype.startswith("image/"):
            image_array = np.frombuffer(decoded_file, np.uint8)
            image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
            thumbnail = create_thumbnail(image)
        
        # encode thumbnail image
        _, buffer = cv2.imencode(ext, thumbnail)
        thumbnail_bytes = buffer.tobytes()
                
        # upload thumbnail to S3
        thumbnail_key = f'users/{user_id}/{thumbnail_prefix}{file_id}{ext}'
        s3.put_object(Bucket=bucket_name, Key=thumbnail_key, Body=thumbnail_bytes, ContentType=mimetype)
        
        # insert result into DynamoDB (birdtag_location)
        dynamodb.put_item(
            TableName=table_name,
            Item={
                'user_id': {'S': user_id},
                'id': {'S': file_id},
                'thumbnail_url': {'S': f'https://{bucket_name}.s3.ap-southeast-2.amazonaws.com/{thumbnail_key}'},
                'original_url': {'S': f'https://{bucket_name}.s3.ap-southeast-2.amazonaws.com/{file_key}'}
            }
        )

        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin":"*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
            },
            'body': json.dumps({'message': 'Image uploaded successfully'})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'message': str(e)})
        }
    
