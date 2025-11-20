import boto3
import json

dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table('birdtag_users')
sns = boto3.client('sns')

def extract_tags(dynamo_tags):

    if 'M' not in dynamo_tags:
        return []

    return list(dynamo_tags['M'].keys())


def lambda_handler(event, context):
    for record in event['Records']:
        event_name = record['eventName']
        
        # Delete files
        if event_name == 'REMOVE':
            old_image = record['dynamodb'].get('OldImage', {})
            if 'tags' not in old_image:
                continue

            deleted_tags = extract_tags(old_image['tags'])
            print(f"Deleted tags: {deleted_tags}")
            filename = old_image.get('original_url', {}).get('S').split('/')[-1]

            response = users_table.scan()
            for user in response.get('Items', []):
                subscribed_tags = user.get('tags', [])
                subscription_arn = user.get('subscription_arn')
                user_id = user.get('user_id')
                email = user.get('email')
                

                # if not subscription_arn or not subscribed_tags:
                #     continue

                if not subscribed_tags or not user_id:
                    continue

                if any(tag in deleted_tags for tag in subscribed_tags):
                    # # message = f"A file with tags {', '.join(deleted_tags)} has been deleted."
                    try:

                        sns.publish(
                            TopicArn='arn:aws:sns:ap-southeast-2:703227778966:BirdTag-Topic',
                            # TargetArn=subscription_arn, 
                            Message=json.dumps({
                                'default': f"The file [{filename}] has been deleted. Your related subscribed tags: {list(deleted_tags)}."
                            }),
                            Subject="BirdTag: Subscribed Tag Update Notification",
                            MessageStructure='json',
                            MessageAttributes={
                                'UserId': {
                                    'DataType': 'String',
                                    'StringValue': user_id
                                }
                            }
                        )
                        print(f"Deletion notification sent to {email}")
                    except Exception as e:
                        print(f"Failed to notify {email} on deletion: {e}")

        
        # New files or update files
        elif event_name in ['INSERT', 'MODIFY']:
            new_image = record['dynamodb'].get('NewImage', {})
            if 'tags' not in new_image:
                continue
            
            detected_tags = extract_tags(new_image['tags'])
            print(f"Detected tags: {detected_tags}")
            filename = new_image.get('original_url', {}).get('S').split('/')[-1]

            file_user_id = new_image.get('user_id', {}).get('S')
            if not file_user_id:
                continue

            user_response = users_table.get_item(Key={'user_id': file_user_id})
            user = user_response.get('Item')
            if not user:
                continue
                
            subscribed_tags = user.get('tags', [])
            # subscription_arn = user.get('subscription_arn')
            # print(subscription_arn)
            user_id = user.get('user_id')
            email = user.get('email')
            

            # if not subscription_arn or not subscribed_tags:
            #     continue
            if not subscribed_tags or not user_id:
                continue
            
            if event_name == 'INSERT': 
                if any(tag in detected_tags for tag in subscribed_tags):
                    # message = f"A new file has been tagged with: {', '.join(detected_tags)}"
                    try:

                        sns.publish(
                            TopicArn='arn:aws:sns:ap-southeast-2:703227778966:BirdTag-Topic',
                            Message=json.dumps({
                                'default': f"The file [{filename}] has been uploaded. Your related subscribed tags: {list(detected_tags)}"
                            }),
                            Subject="BirdTag: Subscribed Tag Update Notification",
                            MessageStructure='json',
                            MessageAttributes={
                                'UserId': {
                                    'DataType': 'String',
                                    'StringValue': user_id
                                }
                            }
                        )
                        print(f"Notification sent to {email}")
                    except Exception as e:
                        print(f"Failed to notify {email}: {e}")

            else:
                if any(tag in detected_tags for tag in subscribed_tags):
                    # message = f"A new file has been tagged with: {', '.join(detected_tags)}"
                    try:

                        sns.publish(
                            TopicArn='arn:aws:sns:ap-southeast-2:703227778966:BirdTag-Topic',
                            Message=json.dumps({
                                'default': f"The file [{filename}] has been updated. Your related subscribed tags: {list(detected_tags)}"
                            }),
                            Subject="BirdTag: Subscribed Tag Update Notification",
                            MessageStructure='json',
                            MessageAttributes={
                                'UserId': {
                                    'DataType': 'String',
                                    'StringValue': user_id
                                }
                            }
                        )
                        print(f"Notification sent to {email}")
                    except Exception as e:
                        print(f"Failed to notify {email}: {e}")
