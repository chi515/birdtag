import json
import boto3
import os
from botocore.exceptions import ClientError

try:
    dynamodb_resource = boto3.resource('dynamodb')
    USERS_TABLE_NAME = os.environ.get('DYNAMODB_USERS_TABLE_NAME', "birdtag_users")
    users_table = dynamodb_resource.Table(USERS_TABLE_NAME)
    if not USERS_TABLE_NAME: raise EnvironmentError("DYNAMODB_USERS_TABLE_NAME env var not set.")
except Exception as e:
    print(f"CRITICAL: Init error: {str(e)}")
    users_table = None

def lambda_handler(event, context):
    print(f"Get Subscriptions event: {json.dumps(event)}")
    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,OPTIONS" 
    }
    if not users_table:
        return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({'error': 'Lambda (Users Table) init failed.'})}

    try:
        requesting_user_id = None
        if (event.get('requestContext') and event['requestContext'].get('authorizer') and
            event['requestContext']['authorizer'].get('claims') and
            event['requestContext']['authorizer']['claims'].get('sub')):
            requesting_user_id = event['requestContext']['authorizer']['claims']['sub']
        
        if not requesting_user_id:
            return {'statusCode': 401, 'headers': cors_headers, 'body': json.dumps({'error': 'Unauthorized', 'message': 'User ID is required.'})}

        print(f"Fetching subscriptions for user_id: {requesting_user_id}")
        response = users_table.get_item(
            Key={'user_id': requesting_user_id},
            ProjectionExpression="tags" 
        )
        user_subscription_data = response.get('Item')

        if user_subscription_data and 'tags' in user_subscription_data:
            subscribed_tags = user_subscription_data['tags']
        else:
            subscribed_tags = [] # User has no subscriptions yet

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'subscribed_tags': subscribed_tags})
        }
    except ClientError as ce:
        print(f"DynamoDB ClientError: {str(ce)}")
        return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({'error': 'Database error', 'message': str(ce)})}
    except Exception as e:
        import traceback
        print(f"Error: {str(e)}\n{traceback.format_exc()}")
        return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({'error': 'Internal server error'})}