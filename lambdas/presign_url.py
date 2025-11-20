import json
import boto3
import os
from botocore.exceptions import ClientError
from botocore.client import Config 

# Initialize S3 client outside the handler
try:
    S3_CLIENT = boto3.client(
        's3',
        config=Config(signature_version='s3v4')
    )

    S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME')
    if not S3_BUCKET_NAME:
        raise EnvironmentError("S3_BUCKET_NAME environment variable is not set.")
    PRESIGNED_URL_EXPIRATION = int(os.environ.get('PRESIGNED_URL_EXPIRATION_SECONDS', 3600))
except Exception as e:
    print(f"Error initializing S3 client or environment variables: {str(e)}")
    S3_CLIENT = None 


def lambda_handler(event, context):
    print(f"Received event for presigned URL generation: {json.dumps(event)}")

    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }

    if not S3_CLIENT or not S3_BUCKET_NAME: 
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server configuration error.'})
        }

    try:
        body_str = event.get('body', '{}')
        if not body_str: 
            body = {}
        else:
            body = json.loads(body_str)
        
        s3_object_key = body.get('s3_key')

        if not s3_object_key:
            raise ValueError("'s3_key' is required in the request body.")

        print(f"Generating presigned URL for Bucket: '{S3_BUCKET_NAME}', Key: '{s3_object_key}'")

        presigned_url = S3_CLIENT.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_object_key},
            ExpiresIn=PRESIGNED_URL_EXPIRATION,
            HttpMethod='GET'
        )
        
        print(f"Successfully generated presigned URL.")

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'presigned_url': presigned_url,
                's3_key': s3_object_key 
            })
        }

    except ValueError as ve:
        print(f"ValueError: {str(ve)}")
        return {
            'statusCode': 400, 
            'headers': cors_headers,
            'body': json.dumps({'error': 'Bad Request', 'message': str(ve)})
        }
    except json.JSONDecodeError:
        print("Error: Invalid JSON in request body.")
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Invalid JSON format in request body.'})
        }
    except ClientError as ce:
        print(f"AWS ClientError: {str(ce)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'AWS SDK error', 'message': str(ce)})
        }
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error', 'message': "An unexpected error occurred."})
        }