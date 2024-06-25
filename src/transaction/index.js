/**

This implementation includes:

CRUD operations for transactions
Input validation using Joi
Error handling and logging
User-specific data access (using the user ID from the Cognito authorizer)
Conditional updates and deletes to ensure a user can only modify their own transactions

Key points:

The transactionSchema defines the expected structure of a transaction.
The userId is extracted from the Cognito authorizer claims.
GET operations filter transactions by the user ID.
POST operation validates the input and creates a new transaction with a UUID.
PUT operation updates a transaction, ensuring it belongs to the current user.
DELETE operation removes a transaction, ensuring it belongs to the current user.
All operations include error handling and logging.

This implementation provides a secure and robust way to manage transactions in the Personal Finance App, ensuring that users can only access and modify their own data.

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
  defaultMeta: { service: 'transaction-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TABLE_NAME = process.env.TRANSACTION_TABLE;
const STAGE = process.env.STAGE;

// Validation schema
const transactionSchema = Joi.object({
  AccountID: Joi.string().required(),
  Date: Joi.date().iso().required(),
  Amount: Joi.number().required(),
  Category: Joi.string().required(),
  Description: Joi.string().allow('').optional()
});

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
 * @returns {Promise<Object>} The Lambda response object.
 */
const getAllTransactions = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'UserID = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  };
  const result = await dynamodb.scan(params).promise();
  logger.info('Transactions retrieved', { userId, count: result.Items.length });
  return createResponse(200, result.Items);
};

/**
 * Retrieves a single transaction from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} transactionId - The ID of the transaction to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getTransaction = async (userId, transactionId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { TransactionID: transactionId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item || result.Item.UserID !== userId) {
    logger.warn('Transaction not found or unauthorized', { userId, transactionId });
    return createResponse(404, { message: 'Transaction not found' });
  }
  logger.info('Transaction retrieved', { userId, transactionId });
  return createResponse(200, result.Item);
};

/**
 * Creates a new transaction in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} transaction - The transaction data to create.
 * @returns {Promise<Object>} The Lambda response object.
 */
const createTransaction = async (userId, transaction) => {
  const { error } = transactionSchema.validate(transaction);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  const newTransaction = {
    ...transaction,
    TransactionID: uuidv4(),
    UserID: userId,
    CreatedAt: new Date().toISOString()
  };
  const params = {
    TableName: TABLE_NAME,
    Item: newTransaction
  };
  await dynamodb.put(params).promise();
  logger.info('Transaction created', { userId, transactionId: newTransaction.TransactionID });
  return createResponse(201, { message: 'Transaction created successfully', transaction: newTransaction });
};

/**
 * Updates an existing transaction in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} transactionId - The ID of the transaction to update.
 * @param {Object} transaction - The updated transaction data.
 * @returns {Promise<Object>} The Lambda response object.
 */
const updateTransaction = async (userId, transactionId, transaction) => {
  const { error } = transactionSchema.validate(transaction);
  if (error) {
    logger.warn('Invalid input', { userId, transactionId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { TransactionID: transactionId },
    UpdateExpression: 'set AccountID = :accountId, #date = :date, Amount = :amount, Category = :category, Description = :description, UpdatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#date': 'Date'
    },
    ExpressionAttributeValues: {
      ':accountId': transaction.AccountID,
      ':date': transaction.Date,
      ':amount': transaction.Amount,
      ':category': transaction.Category,
      ':description': transaction.Description,
      ':updatedAt': new Date().toISOString(),
      ':userId': userId
    },
    ConditionExpression: 'UserID = :userId',
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const result = await dynamodb.update(params).promise();
    logger.info('Transaction updated', { userId, transactionId });
    return createResponse(200, { message: 'Transaction updated successfully', transaction: result.Attributes });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('Transaction not found or unauthorized', { userId, transactionId });
      return createResponse(404, { message: 'Transaction not found or does not belong to the user' });
    }
    throw error;
  }
};

/**
 * Deletes a transaction from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} transactionId - The ID of the transaction to delete.
 * @returns {Promise<Object>} The Lambda response object.
 */
const deleteTransaction = async (userId, transactionId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { TransactionID: transactionId },
    ConditionExpression: 'UserID = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };
  
  try {
    await dynamodb.delete(params).promise();
    logger.info('Transaction deleted', { userId, transactionId });
    return createResponse(200, { message: 'Transaction deleted successfully' });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('Transaction not found or unauthorized', { userId, transactionId });
      return createResponse(404, { message: 'Transaction not found or does not belong to the user' });
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

  const { httpMethod, path, body, pathParameters } = event;

  try {
    const userId = getUserId(event);
    
    switch (httpMethod) {
      case 'GET':
        return path === '/transaction' ? await getAllTransactions(userId) : await getTransaction(userId, pathParameters.id);
      case 'POST':
        return await createTransaction(userId, JSON.parse(body));
      case 'PUT':
        return await updateTransaction(userId, pathParameters.id, JSON.parse(body));
      case 'DELETE':
        return await deleteTransaction(userId, pathParameters.id);
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
    getAllTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction
  };
}
