/**

This implementation includes:

CRUD operations for financial goals.
Input validation using Joi.
Error handling and logging.
Consistent response format.
Use of environment variables for the table name.

Key points:

The goalSchema defines the structure and validation rules for a goal.
The response function standardizes the API response format.
The log function provides consistent logging.
The handler supports GET (list all and get by ID), POST (create), PUT (update), and DELETE operations.
Each operation includes appropriate error handling and logging.
The code assumes that the GoalID is the primary key for the DynamoDB table.

To use this in your project:

Ensure the necessary dependencies (aws-sdk, uuid, and joi) are installed.
Make sure the GOAL_TABLE environment variable is set in your template.yaml file.
Implement corresponding unit tests in src/goal/index.test.js.
Update the template.yaml file to include this Lambda function and its API Gateway triggers.

This implementation provides a solid foundation for managing financial goals in your Personal Finance App.

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
  defaultMeta: { service: 'goal-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TABLE_NAME = process.env.GOAL_TABLE;
const STAGE = process.env.STAGE;

// Validation schema
const goalSchema = Joi.object({
  GoalName: Joi.string().required(),
  TargetAmount: Joi.number().positive().required(),
  CurrentAmount: Joi.number().min(0).required(),
  Deadline: Joi.date().iso().required()
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
 * Retrieves all goals for a specific user from the database.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getAllGoals = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'UserID = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };
  const result = await dynamodb.scan(params).promise();
  logger.info('Goals retrieved', { userId, count: result.Items.length });
  return createResponse(200, result.Items);
};

/**
 * Retrieves a single goal from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} goalId - The ID of the goal to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getGoal = async (userId, goalId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { GoalID: goalId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item || result.Item.UserID !== userId) {
    logger.warn('Goal not found or unauthorized', { userId, goalId });
    return createResponse(404, { message: 'Goal not found' });
  }
  logger.info('Goal retrieved', { userId, goalId });
  return createResponse(200, result.Item);
};

/**
 * Creates a new goal in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} goal - The goal data to create.
 * @returns {Promise<Object>} The Lambda response object.
 */
const createGoal = async (userId, goal) => {
  const { error } = goalSchema.validate(goal);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  const newGoal = {
    ...goal,
    GoalID: uuidv4(),
    UserID: userId,
    CreatedAt: new Date().toISOString()
  };
  const params = {
    TableName: TABLE_NAME,
    Item: newGoal
  };
  await dynamodb.put(params).promise();
  logger.info('Goal created', { userId, goalId: newGoal.GoalID });
  return createResponse(201, { message: 'Goal created successfully', goal: newGoal });
};

/**
 * Updates an existing goal in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} goalId - The ID of the goal to update.
 * @param {Object} goal - The updated goal data.
 * @returns {Promise<Object>} The Lambda response object.
 */
const updateGoal = async (userId, goalId, goal) => {
  const { error } = goalSchema.validate(goal);
  if (error) {
    logger.warn('Invalid input', { userId, goalId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  
  // First, check if the goal belongs to the user
  const getParams = {
    TableName: TABLE_NAME,
    Key: { GoalID: goalId }
  };
  const getResult = await dynamodb.get(getParams).promise();
  if (!getResult.Item || getResult.Item.UserID !== userId) {
    logger.warn('Goal not found or unauthorized', { userId, goalId });
    return createResponse(404, { message: 'Goal not found' });
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { GoalID: goalId },
    UpdateExpression: 'set GoalName = :name, TargetAmount = :target, CurrentAmount = :current, Deadline = :deadline, UpdatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':name': goal.GoalName,
      ':target': goal.TargetAmount,
      ':current': goal.CurrentAmount,
      ':deadline': goal.Deadline,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };
  const result = await dynamodb.update(params).promise();
  logger.info('Goal updated', { userId, goalId });
  return createResponse(200, { message: 'Goal updated successfully', goal: result.Attributes });
};

/**
 * Deletes a goal from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} goalId - The ID of the goal to delete.
 * @returns {Promise<Object>} The Lambda response object.
 */
const deleteGoal = async (userId, goalId) => {
  // First, check if the goal belongs to the user
  const getParams = {
    TableName: TABLE_NAME,
    Key: { GoalID: goalId }
  };
  const getResult = await dynamodb.get(getParams).promise();
  if (!getResult.Item || getResult.Item.UserID !== userId) {
    logger.warn('Goal not found or unauthorized', { userId, goalId });
    return createResponse(404, { message: 'Goal not found' });
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { GoalID: goalId }
  };
  await dynamodb.delete(params).promise();
  logger.info('Goal deleted', { userId, goalId });
  return createResponse(200, { message: 'Goal deleted successfully' });
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
        return path === '/goal' ? await getAllGoals(userId) : await getGoal(userId, pathParameters.id);
      case 'POST':
        return await createGoal(userId, JSON.parse(body));
      case 'PUT':
        return await updateGoal(userId, pathParameters.id, JSON.parse(body));
      case 'DELETE':
        return await deleteGoal(userId, pathParameters.id);
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
    getAllGoals,
    getGoal,
    createGoal,
    updateGoal,
    deleteGoal
  };
}
