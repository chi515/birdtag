import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
import os
from botocore.exceptions import ClientError


dynamodb = boto3.resource('dynamodb')
table_name = 'birdtag_query_job_results'
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    print("---------------------------Start---------------------------")
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

        user_id = body.get('user_id')
        job_id = body.get('job_id')
        print(f'user: {user_id}, job_id: {job_id}')

        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing required user_id'}),
                'headers': cors_headers
                }
        
        response = table.query(
            KeyConditionExpression=Key('job_id').eq(job_id),
            # FilterExpression=Key('job_status').eq('COMPLETED')
        )
        # print(f'response: {response}')
        print('response complete')
        
        items = response.get('Items', [])       
        if not items:
            return {
                'statusCode': 200, # Return 200 OK for frontend to parse status
                'headers': cors_headers,
                'body': json.dumps({'status': 'PROCESSING', 'message': 'Job status not found or still processing.'})
            }
        item = items[0]
        print('item complete')
        print(f'item: {item}')
        print(type(item))

        job_status = item.get('job_status', 'PROCESSING')
        print(f'job_status: {job_status}')

        if job_status == 'COMPLETED':
            search_results = []
            for item in items:
                search_results_payload = item.get('search_results_payload', '{}')
                discovered_tags = item.get('discovered_tags', '{}')
                payload = json.loads(search_results_payload)
                results = payload.get("results", [])  
                          
            
                for r in results:
                    search_results.append({
                        "id": r.get("item_id"), # item_id
                        "type": r.get("type"),
                        "presigned_url_for_display": r.get("presigned_url_for_display"),
                        "presigned_original_url": r.get("presigned_original_url"),
                        "s3_key_original": r.get("s3_key_original"),
                        "s3_key_thumbnail": r.get("s3_key_thumbnail")
                    })
            
            print(f"Number of returned file: {len(search_results)}")
            print("---------------------------End---------------------------")
                    
            return {
                'statusCode': 200,
                'headers': cors_headers, 
                'body': json.dumps({'results': search_results, 'status':job_status, 'discovered_tags':discovered_tags}, default=decimal_default)
                # 'body': json.dumps({'results': search_results, 'status':job_status, 'discovered_tags':discovered_tags})
            }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)}),
            'headers': cors_headers
        }    

def decimal_default(obj): 
    if isinstance(obj, Decimal): 
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError