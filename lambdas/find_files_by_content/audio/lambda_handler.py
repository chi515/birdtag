import os
import json
import boto3
import subprocess
import pandas as pd
from urllib.parse import urlparse
from decimal import Decimal
from boto3.dynamodb.conditions import Key
import datetime


s3_client = boto3.client('s3')
s3_bucket_name = 'birdtag-cloud170'
dynamodb = boto3.resource('dynamodb')
query_table_name = 'birdtag_location'
query_table = dynamodb.Table(query_table_name)
results_table_name = 'birdtag_query_job_results'
results_table = dynamodb.Table(results_table_name)


def lambda_handler(event, context):
    try:
        for record in event['Records']:

            bucket_name = record['s3']['bucket']['name']
            object_key = record['s3']['object']['key']
            print(f"Triggered by: s3://{bucket_name}/{object_key}")

            # Extract user_id and item_id from the object key
            # Format: f'tmp/{user_id}/{file_id}{ext}'
            parts = object_key.split('/')
            user_id = parts[1]
            filename = parts[2]
            tmp_audio_path = f"/tmp/{filename}"
            
            job_id, ext = os.path.splitext(filename)
            ext = ext.lower()
            print(f"Processing tmp file: {object_key} for Job ID: {job_id}, User: {user_id}")

            job_status = 'PROCESSING'
            results_table.update_item(
                Key={'job_id': job_id},
                UpdateExpression="SET job_status = :s, user_id_of_querier = :uid, temp_s3_key = :tsk, received_at = :ra",
                ExpressionAttributeValues={
                    ':s': job_status,
                    ':uid': user_id,
                    ':tsk': object_key,
                    ':ra': str(datetime.datetime.utcnow().isoformat())
                }
            )

            if ext not in ['.wav', '.mp3']:
                print(f"Unsupported file type: {ext}")
                continue

            # Download audio file to /tmp/
            s3_client.download_file(bucket_name, object_key, tmp_audio_path)

            env = os.environ.copy()
            env["NUMBA_CACHE_DIR"] = "/tmp/numba_cache"
            env["NUMBA_DISABLE_CACHE"] = "1"
            env["TMPDIR"] = "/tmp"
            env["TEMP"] = "/tmp"
            
            # Run BirdNET CLI
            output_dir = "/tmp"
            # os.chdir('/Users/miranda/Monash/FIT5225/BirdNET-Analyzer') #local test only
            os.chdir('/opt/BirdNET-Analyzer')
            command = [
                "python3", "-m", "birdnet_analyzer.analyze",
                tmp_audio_path,
                "--output", output_dir,
                "--rtype", "table",
                "--sensitivity", "0.5",
                "--threads", "1"
            ]

            try:
                subprocess.run(command, check=True, env=env)
            except subprocess.CalledProcessError as e:
                print("BirdNET Analyzer failed:", e)
                return {"statusCode": 500, "body": "Detection failed"}
            
            base_name = os.path.splitext(filename)[0]
            result_file_path = os.path.join(output_dir, f"{base_name}.BirdNET.selection.table.txt")
            if not os.path.exists(result_file_path):
                print(f"No result file generated for {filename}")
                job_status = 'COMPLETED' 
                results_table.update_item(
                    Key={'job_id': job_id},
                    UpdateExpression="SET job_status = :s, discovered_tags = :dt, search_results_payload = :p",
                    ExpressionAttributeValues={
                        ':s': job_status,
                        ':dt': {},
                        ':p': json.dumps({"results": []})
                    }
                )                
                continue

            df = pd.read_csv(result_file_path, sep="\t")

            if df.empty:
                print(f"No birds detected in {filename}")
                job_status = 'COMPLETED' 
                results_table.update_item(
                    Key={'job_id': job_id},
                    UpdateExpression="SET job_status = :s, discovered_tags = :dt, search_results_payload = :p",
                    ExpressionAttributeValues={
                        ':s': job_status,
                        ':dt': {},
                        ':p': json.dumps({"results": []})
                    }
                )                
                continue

            species_list = df['Common Name'].unique().tolist()
            species_counts = {species: 1 for species in species_list}
            print(f"Species detected in {filename}:", species_counts)

            # Load response from dynamo db
            response = query_table.query(
                IndexName='user_id-index',
                KeyConditionExpression=Key('user_id').eq(user_id),
                ProjectionExpression="id, user_id, original_url, thumbnail_url, tags, file_type"
            )
            user_items = response['Items']

            processed_results = []
            for item in user_items:
                db_item_id = item.get('id')            
                item_tags = item.get('tags', {})
                item_tags_int = {k: int(v) for k, v in item_tags.items()}            

                matches_all = all(
                    species in item_tags_int and item_tags_int[species] >= count
                    for species, count in species_counts.items()
                )

                if matches_all:
                    print(db_item_id)
                    item_file_type = item.get('file_type', "unknown")
                    item_file_name = item.get('file_name', "")
                    db_thumbnail_url_field = item.get('thumbnail_url')
                    db_original_url_field = item.get('original_url')
                    presigned_thumb_url = None; 
                    presigned_orig_url = None;
                    s3_key_thumbnail = get_s3_key_from_object_url(db_thumbnail_url_field) if db_thumbnail_url_field else None
                    s3_key_original = get_s3_key_from_object_url(db_original_url_field) if db_original_url_field else None

                    if item_file_type == 'image':
                        # For display, generate presigned URL from the thumbnail URL (which contains the key)
                        if db_thumbnail_url_field:
                            presigned_thumb_url = generate_presigned_get_url(db_thumbnail_url_field) # Pass the full URL from DB
                        elif db_original_url_field: # Fallback to original if no thumbnail URL
                            presigned_thumb_url = generate_presigned_get_url(db_original_url_field)
                    else:
                        if db_original_url_field:
                            presigned_orig_url = generate_presigned_get_url(db_original_url_field)        

                    processed_results.append({
                        'id': db_item_id,
                        'type': item_file_type,
                        'file_name': item_file_name,
                        'tags': item_tags,
                        'presigned_url_for_display': presigned_thumb_url,
                        'presigned_original_url': presigned_orig_url,
                        's3_key_original': s3_key_original,
                        's3_key_thumbnail': s3_key_thumbnail
                    })            
            print(processed_results)
            job_status = 'COMPLETED'

            # store results and statis in results table
            results_table.update_item(
                Key={'job_id': job_id},
                UpdateExpression="SET job_status = :s, search_results_payload = :p, discovered_tags = :dt",
                ExpressionAttributeValues={
                    ':s': job_status,
                    ':p': json.dumps({"results": processed_results}, default=decimal_default), 
                    ':dt': species_counts
                }
            )    

            # remove tmp upload files
            s3_client.delete_object(Bucket=bucket_name, Key=object_key)
            print(f"Deleted input file from S3: s3://{bucket_name}/{object_key}")

        return {
            "statusCode": 200,
            'body': json.dumps({"results": processed_results}, default=decimal_default)
        }
    
    except Exception as e:
        print(f'Error: {e}')
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}")
        }


def decimal_default(obj): 
    if isinstance(obj, Decimal): return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

def get_s3_key_from_object_url(s3_object_url):
    """
    Parses an S3 HTTPS Object URL and extracts the S3 Object Key.
    Assumes URL format like: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
    or path-style: https://s3.<region>.amazonaws.com/<bucket-name>/<key>
    """
    if not s3_object_url or not s3_object_url.startswith('https://'):
        print(f"DEBUG: get_s3_key_from_object_url received non-HTTPs URL or empty: '{s3_object_url}', assuming it's a key or invalid.")
        return s3_object_url 
    try:
        parsed_url = urlparse(s3_object_url)
        s3_key = parsed_url.path.lstrip('/')

        print(f"DEBUG: Parsed S3 Key '{s3_key}' from URL '{s3_object_url}'")
        return s3_key
    except Exception as e:
        print(f"Error parsing S3 Object URL '{s3_object_url}': {str(e)}")
        return None


def generate_presigned_get_url(s3_object_url_from_db): 
    if not s3_client or not s3_object_url_from_db:
        print(f"Cannot generate presigned URL: Missing S3 client, bucket name, or S3 object URL ('{s3_object_url_from_db}')")
        return None
    try:
        # Extract the S3 Object Key from the full URL stored in DynamoDB
        s3_key_to_sign = get_s3_key_from_object_url(s3_object_url_from_db)

        if not s3_key_to_sign:
            print(f"Could not derive a valid S3 key from DB URL: '{s3_object_url_from_db}'")
            return None

        print(f"PRESIGN_URL_GEN_ATTEMPT: Generating for Bucket: '{s3_bucket_name}', Parsed Key: '{s3_key_to_sign}'")
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': s3_bucket_name, 'Key': s3_key_to_sign},
            ExpiresIn=3600,
            HttpMethod='GET'
        )
        print(f"PRESIGN_URL_GEN_SUCCESS: Generated URL (first 100 chars): {url[:100]}...")
        return url
    
    except Exception as e:
        print(f"PRESIGN_URL_GEN_ERROR for DB URL '{s3_object_url_from_db}': {str(e)}")
        return None
