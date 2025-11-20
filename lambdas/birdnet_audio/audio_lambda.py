import os
import json
import boto3
import subprocess
import pandas as pd

s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):
    try:
        for record in event['Records']:
            bucket_name = record['s3']['bucket']['name']
            object_key = record['s3']['object']['key']
            parts = object_key.split('/')
            filename = parts[3]
            tmp_audio_path = f"/tmp/{filename}"
            item_id, ext = os.path.splitext(filename)
            ext = ext.lower()

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
                continue

            df = pd.read_csv(result_file_path, sep="\t")

            if df.empty:
                print(f"No birds detected in {filename}")
                continue

            species_list = df['Common Name'].unique().tolist()
            species_counts = {species: 1 for species in species_list}

            print(f"Species detected in {filename}:", species_counts)

            dynamodb.update_item(
                TableName='birdtag_location',
                Key={'id': {'S': item_id}},
                UpdateExpression="SET file_type = :ftype, tags = :tags",
                ExpressionAttributeValues={
                    ':ftype': {'S': 'audio'},
                    ':tags': {'M': {k: {'N': str(v)} for k, v in species_counts.items()}}
                }
            )


        return {
            "statusCode": 200,
            "body": json.dumps("Bird audio detection completed")
        }
    
    except Exception as e:
        print(f'Error: {e}')
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}")
        }
