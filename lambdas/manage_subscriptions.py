import boto3
import json

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns', region_name='ap-southeast-2')

users_table = dynamodb.Table('birdtag_users')
sns_topic_arn = 'arn:aws:sns:ap-southeast-2:703227778966:BirdTag-Topic'

def lambda_handler(event, context):
    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        # "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token"
    }
    try:

        # Extract identity from Cognito JWT claims
        claims = event['requestContext']['authorizer']['claims']
        user_id = claims.get('sub')
        email = claims.get('email')
        print("JWT claims:", json.dumps(claims, indent=2))

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        tags = body.get('tags', [])
        if not tags or not isinstance(tags, list):
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'message': 'tags must be a non-empty list'})
            }

        # Subscribe user to SNS Topic
        response = sns.subscribe(
            TopicArn=sns_topic_arn,
            Protocol='email',
            Endpoint=email,
            ReturnSubscriptionArn=True
        )

        subscription_arn = response['SubscriptionArn']

        filter_policy = {}
        # Add UserId to the filter policy
        if user_id:
            filter_policy['UserId'] = [user_id]

        if filter_policy: 
            sns.set_subscription_attributes(
                SubscriptionArn=subscription_arn,
                AttributeName='FilterPolicy',
                AttributeValue=json.dumps(filter_policy)
            )
            print('Filter policy set successfully.')

        # Store user info into DynamoDB
        users_table.put_item(
            Item={
                'user_id': user_id,
                'email': email,
                'tags': [tag.lower() for tag in tags],
                'subscription_arn': subscription_arn
            }
        )

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'message': 'Subscription successful. Please check your email to confirm.'})
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'message': 'Internal server error', 'error': str(e)})
        }
