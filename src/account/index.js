/**

This implementation includes:

1. CRUD operations for accounts (Create, Read, Update, Delete).
2. Input validation using Joi.
3. Error handling and logging.
4. Proper response formatting.
5. Use of environment variables for the table name.
6. UUID generation for new accounts.

Key points:

- The `accountSchema` defines the required fields and their types for an account.
- The `response` function standardizes the API response format.
- The `log` function provides consistent logging.
- The handler function uses a switch statement to route different HTTP methods to the appropriate logic.
- Each operation (GET, POST, PUT, DELETE) is implemented with proper error checking and DynamoDB interactions.
- The code assumes that the `AccountID` is the primary key for the DynamoDB table.

To use this in your project:

1. Ensure the necessary dependencies (`aws-sdk`, `uuid`, and `joi`) are installed.
2. Make sure the `ACCOUNT_TABLE` environment variable is set in your `template.yaml` file.
3. Implement corresponding unit tests in `index.test.js`.
4. Update the `template.yaml` file to include this Lambda function and its API Gateway event.
 
*/

'use strict';

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const winston = require('winston');

// Initialize AWS SDK and Winston logger
const dynamodb = new AWS.DynamoDB.DocumentClient();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'account-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TABLE_NAME = process.env.ACCOUNT_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE;
const STAGE = process.env.STAGE;

// Validation schema
const accountSchema = Joi.object({
  AccountName: Joi.string().required().max(100),
  Balance: Joi.number().required().precision(2),
  Type: Joi.string().valid('Checking', 'Savings', 'Credit Card', 'Investment').required()
});

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.replace(/[^\w\s.-]/gi, '');
  }
  return input;
};

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
 * Logs an audit event.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} action - The action performed.
 * @param {Object} details - Additional details about the action.
 * @returns {Promise<void>}
 */
const logAuditEvent = async (userId, action, details) => {
  const auditEvent = {
    AuditID: uuidv4(),
    UserID: userId,
    Action: action,
    Timestamp: new Date().toISOString(),
    Details: details
  };
  
  await dynamodb.put({
    TableName: AUDIT_TABLE,
    Item: auditEvent
  }).promise();
};

/**
 * Retrieves all accounts for a specific user from the database with pagination.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} [lastEvaluatedKey] - The last evaluated key for pagination.
 * @param {number} [limit=20] - The maximum number of items to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getAllAccounts = async (userId, lastEvaluatedKey, limit = 20) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'UserID = :userId AND IsActive = :isActive',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':isActive': true
    },
    Limit: limit
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString());
  }

  const result = await dynamodb.scan(params).promise();
  logger.info('Accounts retrieved', { userId, count: result.Items.length });

  const response = {
    accounts: result.Items,
    nextPageKey: result.LastEvaluatedKey 
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null
  };

  return createResponse(200, response);
};

/**
 * Retrieves a single account from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} accountId - The ID of the account to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getAccount = async (userId, accountId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { AccountID: accountId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item || result.Item.UserID !== userId || !result.Item.IsActive) {
    logger.warn('Account not found or unauthorized', { userId, accountId });
    return createResponse(404, { message: 'Account not found' });
  }
  logger.info('Account retrieved', { userId, accountId });
  return createResponse(200, result.Item);
};

/**
 * Creates a new account in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} account - The account data to create.
 * @returns {Promise<Object>} The Lambda response object.
 */
const createAccount = async (userId, account) => {
  const { error } = accountSchema.validate(account);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  
  const sanitizedAccount = {
    AccountName: sanitizeInput(account.AccountName),
    Balance: account.Balance,
    Type: account.Type
  };
  
  const newAccount = {
    ...sanitizedAccount,
    AccountID: uuidv4(),
    UserID: userId,
    IsActive: true,
    Version: 1,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  };
  
  const params = {
    TableName: TABLE_NAME,
    Item: newAccount
  };
  
  await dynamodb.put(params).promise();
  logger.info('Account created', { userId, accountId: newAccount.AccountID });
  
  await logAuditEvent(userId, 'CREATE_ACCOUNT', { accountId: newAccount.AccountID });
  
  return createResponse(201, { message: 'Account created successfully', account: newAccount });
};

/**
 * Updates an existing account in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} accountId - The ID of the account to update.
 * @param {Object} account - The updated account data.
 * @returns {Promise<Object>} The Lambda response object.
 */
const updateAccount = async (userId, accountId, account) => {
  const { error } = accountSchema.validate(account);
  if (error) {
    logger.warn('Invalid input', { userId, accountId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  
  const sanitizedAccount = {
    AccountName: sanitizeInput(account.AccountName),
    Balance: account.Balance,
    Type: account.Type
  };
  
  const params = {
    TableName: TABLE_NAME,
    Key: { AccountID: accountId },
    UpdateExpression: 'set AccountName = :name, Balance = :balance, #type = :type, UpdatedAt = :updatedAt, Version = Version + :increment',
    ConditionExpression: 'UserID = :userId AND IsActive = :isActive AND Version = :version',
    ExpressionAttributeNames: {
      '#type': 'Type'
    },
    ExpressionAttributeValues: {
      ':name': sanitizedAccount.AccountName,
      ':balance': sanitizedAccount.Balance,
      ':type': sanitizedAccount.Type,
      ':updatedAt': new Date().toISOString(),
      ':userId': userId,
      ':isActive': true,
      ':version': account.Version,
      ':increment': 1
    },
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const result = await dynamodb.update(params).promise();
    logger.info('Account updated', { userId, accountId });
    
    await logAuditEvent(userId, 'UPDATE_ACCOUNT', { 
      accountId: accountId, 
      oldVersion: account.Version, 
      newVersion: result.Attributes.Version 
    });
    
    return createResponse(200, { message: 'Account updated successfully', account: result.Attributes });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('Concurrent update detected', { userId, accountId });
      return createResponse(409, { message: 'Account was modified by another request. Please retry with the latest version.' });
    }
    throw error;
  }
};

/**
 * Soft deletes an account from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} accountId - The ID of the account to delete.
 * @returns {Promise<Object>} The Lambda response object.
 */
const deleteAccount = async (userId, accountId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { AccountID: accountId },
    UpdateExpression: 'set IsActive = :isActive, UpdatedAt = :updatedAt',
    ConditionExpression: 'UserID = :userId AND IsActive = :currentActive',
    ExpressionAttributeValues: {
      ':isActive': false,
      ':updatedAt': new Date().toISOString(),
      ':userId': userId,
      ':currentActive': true
    },
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const result = await dynamodb.update(params).promise();
    logger.info('Account soft deleted', { userId, accountId });
    
    await logAuditEvent(userId, 'DELETE_ACCOUNT', { accountId: accountId });
    
    return createResponse(200, { message: 'Account deleted successfully' });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('Account not found or already deleted', { userId, accountId });
      return createResponse(404, { message: 'Account not found' });
    }
    throw error;
  }
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

  const { httpMethod, path, body, pathParameters, queryStringParameters } = event;

  try {
    const userId = getUserId(event);
    
    switch (httpMethod) {
      case 'GET':
        if (path === '/account') {
          const { lastEvaluatedKey, limit } = queryStringParameters || {};
          return await getAllAccounts(userId, lastEvaluatedKey, limit ? parseInt(limit) : undefined);
        } else {
          return await getAccount(userId, pathParameters.id);
        }
      case 'POST':
        return await createAccount(userId, JSON.parse(body));
      case 'PUT':
        return await updateAccount(userId, pathParameters.id, JSON.parse(body));
      case 'DELETE':
        return await deleteAccount(userId, pathParameters.id);
      default:
        logger.warn('Unsupported HTTP method', { userId, method: httpMethod });
        return createResponse(400, { message: 'Unsupported HTTP method' });
    }
  } catch (error) {
    if (error.message === 'User ID not found in the event object') {
      logger.error('Unauthorized access attempt', { error: error.message });
      return createResponse(401, { message: 'Unauthorized' });
    }
    logger.error('Error processing request', { error: error.message, stack: error.stack });
    return createResponse(500, { message: 'Internal server error' });
  }
};

// If running in a test environment, export internal functions for unit testing
if (STAGE === 'test') {
  module.exports = {
    createResponse,
    getUserId,
    logAuditEvent,
    getAllAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    sanitizeInput
  };
}
