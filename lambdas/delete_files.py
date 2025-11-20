import json
import boto3
from boto3.dynamodb.conditions import Key
from urllib.parse import urlparse


s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table_name = "birdtag_location"
table = dynamodb.Table(table_name)

def extract_bucket_and_key(url):
    parsed = urlparse(url)
    bucket = parsed.netloc.split('.')[0]
    key = parsed.path.lstrip('/')
    return bucket, key

def lambda_handler(event, context):
    cors_headers = { 
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
     }
    try:
        if isinstance(event, dict) and 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event 

        # 1. check user_id
        # user_id = event['requestContext']['authorizer']['claims']['sub']
        user_id = body.get('user_id')
        print(f'user: {user_id}')
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing required user_id'}),
                'headers': cors_headers
                }

        # 2. check requested urls to delete        ]
        urls = body.get("urls", [])
        # print(f'body: {body}')
        # print(f'urls: {urls}')
        if not urls:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing required urls'}),
                'headers': cors_headers
                }        

        # 3. find all files based on user_id
        response = table.query(
            IndexName='user_id-index',
            KeyConditionExpression=Key('user_id').eq(user_id),
            ProjectionExpression="id, user_id, original_url, thumbnail_url, tags"
        )
        user_items = response['Items']
        # print(f'response: {response}')
        print(f'user_items: {user_items}')
        # 4. check if requested urls are in the response
        files_to_delete = []

        for item in user_items:            
            if item.get('original_url') in urls or item.get('thumbnail_url') in urls:
                files_to_delete.append(item)

        print(f'files_to_delete: {files_to_delete}')

        if not files_to_delete:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No files found to delete'}),
                'headers': cors_headers
                }

        # 5. delete files
        file_deleted = []
        for item in files_to_delete:

            item_id = item.get('id')
            original_url = item.get('original_url')
            thumbnail_url = item.get('thumbnail_url')
            tags = item.get('tags')
            
            original_deleted = False
            thumbnail_deleted = True  # Assume true if no thumbnail

            # 5.1 delete original file
            try:                
                bucket_org, key_org = extract_bucket_and_key(original_url)
                s3.delete_object(Bucket=bucket_org, Key=key_org)
                print(f'bucket: {bucket_org}, key: {key_org}')
                print(f'deleted from S3 original: {original_url}')
                original_deleted = True
            except Exception as s3err:
                print(f"[WARN] Failed to delete {original_url}: {s3err}")

            # 5.2 delete thumbnail file (if exists)                        
            if thumbnail_url:
                try:
                    bucket_tb, key_tb = extract_bucket_and_key(thumbnail_url)
                    print(f'bucket: {bucket_tb}, key: {key_tb}')
                    print(f'deleted from S3 thumbnail: {thumbnail_url}') 
                    thumbnail_deleted = True
                except Exception as s3err:
                    print(f"[WARN] Failed to delete {thumbnail_url}: {s3err}")
                    thumbnail_deleted = False


            # 5.3 delete item from dynamodb if all s3 deletes succeeded
            if original_deleted and thumbnail_deleted:
                try:
                    table.delete_item(Key={'id': item_id})
                    file_deleted.append(item_id)
                    print(f'deleted from dynamodb: {item_id}')
                except Exception as db_err:
                    print(f"[WARN] Failed to delete DynamoDB item {item['id']}: {db_err}")

        filename = key_org.split('/')[-1]

        return {
            'statusCode': 200,
            'headers': cors_headers,            
            'body': json.dumps({'Deleted files': file_deleted})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)}),
            'headers': cors_headers
        }
