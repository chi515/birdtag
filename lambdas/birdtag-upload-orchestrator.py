import json
import uuid
import boto3
import mimetypes
import os


s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
bucket_name = 'birdtag-cloud170'
table_name = 'birdtag_location'

def lambda_handler(event, context):
    try:
        # parse incoming request
        body = json.loads(event['body'])        
        user_id = body.get('user_id')
        file_name = body.get('file_name')
        client_content_type = body.get('content_type')

        # generate unique file id
        file_id = str(uuid.uuid4())
                     
        # get file key
        _, ext = os.path.splitext(file_name)
        file_key = f'users/{user_id}/raw/{file_id}{ext}'

        # get content type 
        final_content_type = None
        if client_content_type and client_content_type.strip():
            final_content_type = client_content_type
        else:
            if file_name:
                mimetype, _ = mimetypes.guess_type(file_name)
                if mimetype:
                    final_content_type = mimetype
                else:
                    mimetype = 'application/octet-stream'
                final_content_type = mimetype


        # mimetype, _ = mimetypes.guess_type(file_name)
        # if not mimetype:
        #     mimetype = 'application/octet-stream'

        # upload raw files to S3
        # s3.put_object(Bucket=bucket_name, Key=file_key, Body=decoded_file, ContentType=mimetype)
        upload_url = s3.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': file_key,
                'ContentType': final_content_type #mimetype
                },
            ExpiresIn=300
        )

        dynamodb.put_item(
            TableName=table_name,
            Item={
                'user_id': {'S': user_id},
                'id': {'S': file_id},
                'original_url': {'S': f'https://{bucket_name}.s3.ap-southeast-2.amazonaws.com/{file_key}'}
            }
        )
                
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },            
            'body': json.dumps({
                'upload_url': upload_url,
                's3_key': file_key,
                'file_id': file_id,
                'message': 'Pre-signed URL generated successfully for upload.'        
                })
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'message': str(e)})
        }
    