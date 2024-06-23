/**

This index.js file in the export directory implements the functionality to export user transactions to a CSV file and upload it to an S3 bucket. Here's a breakdown of its functionality:

It uses AWS SDK to interact with DynamoDB and S3.
The handler function is the entry point for the Lambda function.
It retrieves the user ID from the Cognito authorizer claims.
It fetches all transactions for the user from DynamoDB.
The transactions are converted to CSV format.
The CSV data is uploaded to an S3 bucket with a unique filename.
It returns a success response with the filename of the exported CSV.

The file includes helper functions:

getAllTransactions: Retrieves all transactions for a given user from DynamoDB.
convertToCSV: Converts the transaction data to CSV format.
uploadToS3: Uploads the CSV data to the specified S3 bucket.
response: A utility function to format the Lambda response.

This implementation assumes that the necessary environment variables (TRANSACTION_TABLE and EXPORT_BUCKET) are set in the Lambda function's configuration, which should be defined in the template.yaml file.
Remember to handle errors appropriately and consider implementing more robust error checking and logging for a production environment.

*/

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TRANSACTION_TABLE = process.env.TRANSACTION_TABLE;
const EXPORT_BUCKET = process.env.EXPORT_BUCKET;

exports.handler = async (event) => {
    console.log('Event received', JSON.stringify(event, null, 2));

    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const transactions = await getAllTransactions(userId);
        const csv = convertToCSV(transactions);
        const filename = `export_${userId}_${new Date().toISOString()}.csv`;

        await uploadToS3(csv, filename);

        return response(200, { message: 'Export successful', filename });
    } catch (error) {
        console.error('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};

async function getAllTransactions(userId) {
    const params = {
        TableName: TRANSACTION_TABLE,
        FilterExpression: 'UserID = :userId',
        ExpressionAttributeValues: { ':userId': userId }
    };
    const result = await dynamodb.scan(params).promise();
    return result.Items;
}

function convertToCSV(transactions) {
    const header = ['Date', 'Amount', 'Category', 'Description'];
    const rows = transactions.map(t => [t.Date, t.Amount, t.Category, t.Description]);
    return [header, ...rows].map(row => row.join(',')).join('\n');
}

async function uploadToS3(data, filename) {
    const params = {
        Bucket: EXPORT_BUCKET,
        Key: filename,
        Body: data,
        ContentType: 'text/csv'
    };
    await s3.putObject(params).promise();
}

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(body),
    };
}
