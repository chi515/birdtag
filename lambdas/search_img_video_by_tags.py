import json
import boto3
from boto3.dynamodb.conditions import Attr, Key
from decimal import Decimal
import os
from botocore.client import Config
from botocore.exceptions import ClientError
from urllib.parse import urlparse

try:
    dynamodb_resource = boto3.resource('dynamodb')
    TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', "birdtag_location")
    table = dynamodb_resource.Table(TABLE_NAME)
    S3_CLIENT = boto3.client('s3', config=Config(signature_version='s3v4'))
    S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME')
    PRESIGNED_URL_EXPIRATION = int(os.environ.get('PRESIGNED_URL_EXPIRATION_SECONDS', 3600))
    if not S3_BUCKET_NAME: raise EnvironmentError("S3_BUCKET_NAME env var not set.")
    if not TABLE_NAME: raise EnvironmentError("DYNAMODB_TABLE_NAME env var not set.")

except Exception as e:
    print(f"Init error: {str(e)}")
    dynamodb_resource = None; table = None; S3_CLIENT = None; S3_BUCKET_NAME = None

def decimal_default(obj): 
    if isinstance(obj, Decimal): return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

def extract_url_tags(params): 
    tag_count = {}
    if not params: return tag_count
  
    for i in range(1, 20):
        tag_key_param = f'tag{i}'
        count_key_param = f'count{i}'
        tag_value = params.get(tag_key_param)
        count_str = params.get(count_key_param)
        if tag_value:
            if count_str:
                try: tag_count[tag_value.lower()] = int(count_str)
                except ValueError: tag_count[tag_value.lower()] = 1
            else: tag_count[tag_value.lower()] = 1
    return tag_count

def get_s3_key_from_object_url(s3_object_url):

    if not s3_object_url or not s3_object_url.startswith('https://'):
        print(f"get_s3_key_from_object_url received non-HTTPs URL or empty: '{s3_object_url}', assuming it's a key or invalid.")
        return s3_object_url 
    try:
        parsed_url = urlparse(s3_object_url)
        s3_key = parsed_url.path.lstrip('/')

        print(f"parsed S3 Key '{s3_key}' from URL '{s3_object_url}'")
        return s3_key
    except Exception as e:
        print(f"Error parsing S3 Object URL '{s3_object_url}': {str(e)}")
        return None


def generate_presigned_get_url(s3_object_url_from_db): 
    if not S3_CLIENT or not S3_BUCKET_NAME or not s3_object_url_from_db:
        print(f"Cannot generate presigned URL: Missing S3 client, bucket name, or S3 object URL ('{s3_object_url_from_db}')")
        return None
    try:
        # Extract the S3 Object Key from the full URL stored in DynamoDB
        s3_key_to_sign = get_s3_key_from_object_url(s3_object_url_from_db)

        if not s3_key_to_sign:
            print(f"Couldn't get a valid S3 key: '{s3_object_url_from_db}'")
            return None

        url = S3_CLIENT.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key_to_sign},
            ExpiresIn=PRESIGNED_URL_EXPIRATION,
            HttpMethod='GET'
        )
        return url
    except ClientError as e:
        print(f"Error: '{s3_object_url_from_db}' (parsed key: '{s3_key_to_sign if 's3_key_to_sign' in locals() else 'unknown'}'): {str(e)}")
        return None
    except Exception as e:
        print(f"Error: '{s3_object_url_from_db}': {str(e)}")
        return None

def lambda_handler(event, context):
    print(f"Search event: {json.dumps(event)}")
    cors_headers = { 
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
     }
    if not table or not S3_CLIENT or not S3_BUCKET_NAME: return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({'error': 'Lambda initialization failed.'})}

    try:
        http_method = event.get('httpMethod')
        tags_to_query = {}
        requesting_user_id = None

        if (event.get('requestContext') and
            event['requestContext'].get('authorizer') and
            event['requestContext']['authorizer'].get('claims') and
            event['requestContext']['authorizer']['claims'].get('sub')):
            requesting_user_id = event['requestContext']['authorizer']['claims']['sub']
            print(f"User ID from Cognito Authorizer claims (sub): {requesting_user_id}")
        
  
        if http_method == 'GET':
            query_params = event.get('queryStringParameters')
            tags_to_query = extract_url_tags(query_params)
            if not requesting_user_id and query_params:
                requesting_user_id = query_params.get('userId') 
                if requesting_user_id: print(f"User ID from GET query param: {requesting_user_id}")

        elif http_method == 'POST':
            body_str = event.get('body', '{}'); body = json.loads(body_str) if body_str else {}
            if not requesting_user_id:
                requesting_user_id = body.get('userId') or body.get('user_id') 
                if requesting_user_id: print(f"User ID from POST body: {requesting_user_id}")

            raw_tags_input = body.get('tags', body) 
            if isinstance(raw_tags_input, list):
                for t_obj in raw_tags_input:
                    if isinstance(t_obj, dict) and 'label' in t_obj and 'quantity' in t_obj:
                         tags_to_query[t_obj['label'].lower()] = int(t_obj['quantity'])
            elif isinstance(raw_tags_input, dict):
                temp_tags = raw_tags_input.copy()
                temp_tags.pop('userId', None) 
                temp_tags.pop('user_id', None)
                for k, v in temp_tags.items():
                    try: tags_to_query[k.lower()] = int(v)
                    except ValueError: tags_to_query[k.lower()] = 1
            else: 
                raise ValueError("Invalid 'tags' format in POST body.")
        else:
            return {'statusCode': 405, 'headers': cors_headers, 'body': json.dumps({'error': 'Method Not Allowed'})}

        if not requesting_user_id:
            return {'statusCode': 401, 'headers': cors_headers, 'body': json.dumps({'error': 'Unauthorized', 'message': 'User ID is required.'})}
        

        filter_expression_parts = [Attr('user_id').eq(requesting_user_id)] 

        if tags_to_query:
            for species, count_value in tags_to_query.items():
                try:
                    min_count = int(count_value)
                    if min_count <= 0: min_count = 1 
                except ValueError:
                    min_count = 1 
                
                if species:
                    condition = Attr(f'tags.{species}').gte(Decimal(str(min_count)))
                    filter_expression_parts.append(condition)
        
        if not filter_expression_parts: 
             return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({"error": "Internal error forming query"})}

        final_filter_expression = filter_expression_parts[0]
        for i in range(1, len(filter_expression_parts)):
            final_filter_expression = final_filter_expression & filter_expression_parts[i]
        
        print(f"DynamoDB scan filter: {final_filter_expression}")
        
        response_from_db = table.scan(FilterExpression=final_filter_expression)
        db_items = response_from_db.get('Items', [])

        while 'LastEvaluatedKey' in response_from_db: 
            response_from_db = table.scan(FilterExpression=final_filter_expression, ExclusiveStartKey=response_from_db['LastEvaluatedKey'])
            db_items.extend(response_from_db.get('Items', []))
        
        processed_results = []

        for item in db_items:
            file_type = item.get('file_type', '').lower()
            db_thumbnail_url_field = item.get('thumbnail_url') 
            db_original_url_field = item.get('original_url')
            presigned_thumb_url = None
            presigned_orig_url = None
            s3_key_thumbnail = get_s3_key_from_object_url(db_thumbnail_url_field) if db_thumbnail_url_field else None
            s3_key_original = get_s3_key_from_object_url(db_original_url_field) if db_original_url_field else None
            
            if file_type == 'image':
                if db_thumbnail_url_field:
                    presigned_thumb_url = generate_presigned_get_url(db_thumbnail_url_field)
                elif db_original_url_field:
                    presigned_thumb_url = generate_presigned_get_url(db_original_url_field)

            elif file_type == 'video':
                if db_original_url_field:
                    presigned_orig_url = generate_presigned_get_url(db_original_url_field)

            elif file_type == 'audio':
                 if db_original_url_field:
                    presigned_orig_url = generate_presigned_get_url(db_original_url_field)

            base_original_s3_url = item.get('original_url')
            base_thumbnail_s3_url = item.get('thumbnail_url')

            object_url = None
            if file_type == 'image' and base_thumbnail_s3_url:
                object_url = base_thumbnail_s3_url
            elif base_original_s3_url: 
                object_url = base_original_s3_url

            processed_results.append({
                'id': item.get('id'),
                'type': file_type,
                'file_name': item.get('file_name', (s3_key_original or s3_key_thumbnail or "").split('/')[-1] or 'Untitled'),
                'tags': item.get('tags', {}),
                'presigned_url_for_display': presigned_thumb_url, 
                'presigned_original_url': presigned_orig_url, 
                's3_key_original': s3_key_original, 
                's3_key_thumbnail': s3_key_thumbnail,  
                'object_url': object_url
            })

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({"results": processed_results}, default=decimal_default)
        }

    except ValueError as ve: 
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'Bad Request', 'message': str(ve)})}
    
    except Exception as e: 
        return {'statusCode': 500, 'headers': cors_headers, 'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}