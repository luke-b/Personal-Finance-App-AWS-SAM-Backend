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
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TABLE_NAME = process.env.USER_TABLE;
const STAGE = process.env.STAGE;

// Validation schema for user data
const userSchema = Joi.object({
  Name: Joi.string().required(),
  Email: Joi.string().email().required()
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
 * Retrieves the user from the database.
 *
 * @param {string} userId - The ID of the user to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getUser = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item) {
    logger.warn('User not found', { userId });
    return createResponse(404, { message: 'User not found' });
  }
  logger.info('User retrieved', { userId });
  return createResponse(200, result.Item);
};

/**
 * Creates a new user in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} user - The user data to create.
 * @returns {Promise<Object>} The Lambda response object.
 */
const createUser = async (userId, user) => {
  const { error } = userSchema.validate(user);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  const newUser = {
    ...user,
    UserID: userId,
    CreatedAt: new Date().toISOString()
  };
  const params = {
    TableName: TABLE_NAME,
    Item: newUser,
    ConditionExpression: 'attribute_not_exists(UserID)'
  };
  try {
    await dynamodb.put(params).promise();
    logger.info('User created', { userId });
    return createResponse(201, { message: 'User created successfully', user: newUser });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('User already exists', { userId });
      return createResponse(409, { message: 'User already exists' });
    }
    throw error;
  }
};

/**
 * Updates an existing user in the database.
 *
 * @param {string} userId - The ID of the user to update.
 * @param {Object} user - The updated user data.
 * @returns {Promise<Object>} The Lambda response object.
 */
const updateUser = async (userId, user) => {
  const { error } = userSchema.validate(user);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId },
    UpdateExpression: 'set #name = :name, Email = :email, UpdatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'Name'
    },
    ExpressionAttributeValues: {
      ':name': user.Name,
      ':email': user.Email,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };
  const result = await dynamodb.update(params).promise();
  logger.info('User updated', { userId });
  return createResponse(200, { message: 'User updated successfully', user: result.Attributes });
};

/**
 * Deletes a user from the database.
 *
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<Object>} The Lambda response object.
 */
const deleteUser = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId }
  };
  await dynamodb.delete(params).promise();
  logger.info('User deleted', { userId });
  return createResponse(200, { message: 'User deleted successfully' });
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

  const { httpMethod, body } = event;

  try {
    const userId = getUserId(event);
    
    switch (httpMethod) {
      case 'GET':
        return await getUser(userId);
      case 'POST':
        return await createUser(userId, JSON.parse(body));
      case 'PUT':
        return await updateUser(userId, JSON.parse(body));
      case 'DELETE':
        return await deleteUser(userId);
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
    getUser,
    createUser,
    updateUser,
    deleteUser
  };
}
