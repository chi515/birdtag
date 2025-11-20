import json
import boto3
import os
from bird_detection import image_prediction, video_prediction

s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
table_name = 'birdtag_location'

def lambda_handler(event, context):
    try:
        for record in event['Records']:
            bucket_name = record['s3']['bucket']['name']
            object_key = record['s3']['object']['key']
            print(f"Triggered by: s3://{bucket_name}/{object_key}")

            # Extract user_id and item_id from the object key
            # Format: users/{user_id}/raw/{filename}
            parts = object_key.split('/')
            if len(parts) < 4 or parts[0] != 'users' or parts[2] != 'raw':
                print(f"Skipping invalid S3 path: {object_key}")
                continue
            user_id = parts[1]
            filename = parts[3]
            item_id, ext = os.path.splitext(filename)
            ext = ext.lower()

            # Download the image from S3
            tmp_path = f"/tmp/{filename}"
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            with open(tmp_path, 'wb') as f:
                f.write(response['Body'].read())

            # Check the file is image or video
            if ext in ['.jpg', '.jpeg', '.png']:
                species_counts = image_prediction(tmp_path)
                file_type = "image"

            elif ext in ['.mp4', '.mov']:
                species_counts = video_prediction(tmp_path)
                file_type = "video"

            else:
                raise ValueError(f"Unsupported file type: {ext}")

            if isinstance(species_counts, str):
                species_counts = json.loads(species_counts)

            if not species_counts:
                print(f"No birds detected for {filename}")
                continue
        
                
            # Update the item to DynamoDB
            dynamodb.update_item(
                TableName=table_name,
                Key={'id': {'S': item_id}},
                UpdateExpression="SET file_type = :ftype, tags = :tags",
                ExpressionAttributeValues={
                    ':ftype': {'S': file_type},
                    ':tags': {'M': {k: {'N': str(v)} for k, v in species_counts.items()}}
                }
            )

            
        return {
            "statusCode": 200,
            "body": json.dumps("Bird detection completed")
        }
    except Exception as e:
        print(f'Error: {e}')
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}")
        }

