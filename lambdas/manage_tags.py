import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from urllib.parse import urlparse
import os


s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table_name = "birdtag_location"
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", # Restrict in production
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token", # Important
        "Access-Control-Allow-Methods": "POST,OPTIONS" # For this specific endpoint
    }

    try:         
        body = json.loads(event['body'])
        user_id = body.get('user_id')
        urls = body.get("url", [])
        op_type = body.get("operation")
        tags = body.get("tags")

        print(f'user: {user_id}')
        print(f'urls: {urls}')
        print(f'op_type: {op_type}')
        print(f'tags: {tags}')

        # 1. check user_id and urls
        if not user_id:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Missing user_id'})
                }
        print(f'length of urls: {len(urls)}')
        if (not urls) or (len(urls) == 0):
            print('Missing url')
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Missing url'})
                }
        # 2. check requested operation
        if op_type not in [0, 1]:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'message': 'Invalid Operation Type. Type must be 0 (remove) or 1 (add).'})
            }
        
        # 3. check tags
        try:
            tag_dict = {}
            for tag in tags:
                tag_parts = tag.split(',')
                tag_name, tag_count = tag_parts[0], int(tag_parts[1])
                tag_dict[tag_name] = tag_count
            print(tag_dict)
        
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'error': 'No Valid Tags', 'message': str(e)}),
        }

        # 3. find all files based on user_id
        try: 
            response = table.query(
                IndexName='user_id-index',
                KeyConditionExpression=Key('user_id').eq(user_id),
                ProjectionExpression="id, user_id, original_url, thumbnail_url, tags"
            )
            user_records = response['Items']

            files_to_update = []
            for item in user_records:            
                if item.get('original_url') in urls or item.get('thumbnail_url') in urls:
                    files_to_update.append(item)
        except:
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'error': 'No records found'})
            }

        # print(f'files_to_update: {files_to_update}')

        # iterate over each file records
        for file in files_to_update:
            url = file.get('original_url') or file.get('thumbnail_url')
            filename = os.path.basename(urlparse(url).path)
            
            existing_tags = file.get('tags', {})
            print(f'original file: {file}')
            print(f'original tags: {existing_tags}')

            updated_tags = existing_tags.copy()

            # remove tags
            if op_type == 0:
                # iterate over each requested tag and count                
                for tag_name, tag_count in tag_dict.items():     
                    updated_tags.pop(tag_name, None)               
                    # existing_value = existing_tags.get(tag_name, Decimal(0)) # get existing tag count, set to 0 if not exists
                    # updated_value = existing_value - Decimal(tag_count) # subtract by requested count 
                    # if updated_value > 0: # update tag when updated value > 0
                    #     updated_tags[tag_name] = updated_value
                    # else:
                    #     updated_tags.pop(tag_name, None) # remove otherwise
            
            # add tags
            elif op_type == 1:
                # iterate over each requested tag and count
                for tag_name, tag_count in tag_dict.items():
                    existing_value = existing_tags.get(tag_name, Decimal(0))
                    updated_value = existing_value + Decimal(tag_count)
                    updated_tags[tag_name] = updated_value          
            
            print(f'updated tags: {updated_tags}')
            # file['tags'] = updated_tags
            # print(f'updated file: {file}')

            # Update data in DynamoDB
            table.update_item(
                Key={'id': file['id']},
                UpdateExpression="SET tags = :tags",
                ExpressionAttributeValues={':tags': updated_tags}
                )

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'message': 'Tags updated successfully', 'updated_files': [f['id'] for f in files_to_update]})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)}),
            'headers': cors_headers
        }
