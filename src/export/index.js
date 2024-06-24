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

'use strict';

const AWS = require('aws-sdk');
const winston = require('winston');

// Initialize AWS SDK and Winston logger
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'transaction-export-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TRANSACTION_TABLE = process.env.TRANSACTION_TABLE;
const EXPORT_BUCKET = process.env.EXPORT_BUCKET;
const STAGE = process.env.STAGE;

/**
 * Creates a standardized response object.
 *
 * @param {number} statusCode - The HTTP status code.
 * @param {Object} body - The response body.
 * @returns {Object} The formatted response object.
 */
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

/**
 * Extracts the user ID from the Cognito authorizer context.
 *
 * @param {Object} event - The Lambda event object.
 * @returns {string} The user ID.
 * @throws {Error} If the user ID is not found in the event.
 */
const getUserId = (event) => {
  if (event.requestContext && 
      event.requestContext.authorizer && 
      event.requestContext.authorizer.claims && 
      event.requestContext.authorizer.claims.sub) {
    return event.requestContext.authorizer.claims.sub;
  }
  throw new Error('User ID not found in the event object');
};

/**
 * Retrieves all transactions for a specific user from the database.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array>} An array of transaction objects.
 */
const getAllTransactions = async (userId) => {
  const params = {
    TableName: TRANSACTION_TABLE,
    FilterExpression: 'UserID = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  };
  const result = await dynamodb.scan(params).promise();
  logger.info('Transactions retrieved', { userId, count: result.Items.length });
  return result.Items;
};

/**
 * Converts an array of transaction objects to a CSV string.
 *
 * @param {Array} transactions - An array of transaction objects.
 * @returns {string} A CSV string representation of the transactions.
 */
const convertToCSV = (transactions) => {
  const header = ['Date', 'Amount', 'Category', 'Description'];
  const rows = transactions.map(t => [t.Date, t.Amount, t.Category, t.Description]);
  return [header, ...rows].map(row => row.join(',')).join('\n');
};

/**
 * Uploads data to S3.
 *
 * @param {string} data - The data to upload.
 * @param {string} filename - The name of the file to create in S3.
 * @returns {Promise<Object>} The S3 upload result.
 */
const uploadToS3 = async (data, filename) => {
  const params = {
    Bucket: EXPORT_BUCKET,
    Key: filename,
    Body: data,
    ContentType: 'text/csv'
  };
  const result = await s3.putObject(params).promise();
  logger.info('File uploaded to S3', { filename, bucket: EXPORT_BUCKET });
  return result;
};

/**
 * Main handler function for the Lambda.
 *
 * @param {Object} event - The Lambda event object.
 * @param {Object} context - The Lambda context object.
 * @returns {Promise<Object>} The Lambda response object.
 */
exports.handler = async (event, context) => {
  logger.info('Received event', { 
    requestId: context.awsRequestId,
    event: JSON.stringify(event)
  });

  try {
    const userId = getUserId(event);
    const transactions = await getAllTransactions(userId);
    
    if (transactions.length === 0) {
      logger.info('No transactions found for user', { userId });
      return createResponse(404, { message: 'No transactions found' });
    }

    const csv = convertToCSV(transactions);
    const filename = `export_${userId}_${new Date().toISOString()}.csv`;

    await uploadToS3(csv, filename);

    logger.info('Export successful', { userId, filename });
    return createResponse(200, { message: 'Export successful', filename });
  } catch (error) {
    if (error.message === 'User ID not found in the event object') {
      logger.error('Unauthorized access attempt', { error: error.message });
      return createResponse(401, { message: 'Unauthorized' });
    }
    logger.error('Error processing export request', { error: error.message, stack: error.stack });
    return createResponse(500, { message: 'Internal server error' });
  }
};

// If running in a test environment, export internal functions for unit testing
if (STAGE === 'test') {
  module.exports = {
    createResponse,
    getUserId,
    getAllTransactions,
    convertToCSV,
    uploadToS3
  };
}
