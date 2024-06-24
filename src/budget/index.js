/**

This implementation includes:

CRUD operations for budgets.
Input validation using Joi.
Error handling and logging.
Proper response formatting.

Key points:

The budgetSchema defines the structure and validation rules for a budget entry.
The response function standardizes the API response format.
The log function provides consistent logging.
The main handler function processes different HTTP methods:

GET: Retrieves all budgets or a specific budget by ID.
POST: Creates a new budget.
PUT: Updates an existing budget.
DELETE: Removes a budget.

Remember to update the template.yaml file to include the necessary permissions for this Lambda function to access the DynamoDB table. Also, ensure that the environment variable BUDGET_TABLE is set correctly in the SAM template.
This implementation provides a solid foundation for managing budgets in your Personal Finance App. You may need to adjust it based on your specific requirements or if you need to add more complex operations.

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
  defaultMeta: { service: 'budget-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TABLE_NAME = process.env.BUDGET_TABLE;
const STAGE = process.env.STAGE;

// Validation schema
const budgetSchema = Joi.object({
  Category: Joi.string().required(),
  Amount: Joi.number().positive().required(),
  Period: Joi.string().valid('weekly', 'monthly', 'yearly').required()
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
 * Retrieves all budgets for a specific user from the database.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getAllBudgets = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'UserID = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };
  const result = await dynamodb.scan(params).promise();
  logger.info('Budgets retrieved', { userId, count: result.Items.length });
  return createResponse(200, result.Items);
};

/**
 * Retrieves a single budget from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} budgetId - The ID of the budget to retrieve.
 * @returns {Promise<Object>} The Lambda response object.
 */
const getBudget = async (userId, budgetId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { BudgetID: budgetId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item || result.Item.UserID !== userId) {
    logger.warn('Budget not found or unauthorized', { userId, budgetId });
    return createResponse(404, { message: 'Budget not found' });
  }
  logger.info('Budget retrieved', { userId, budgetId });
  return createResponse(200, result.Item);
};

/**
 * Creates a new budget in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {Object} budget - The budget data to create.
 * @returns {Promise<Object>} The Lambda response object.
 */
const createBudget = async (userId, budget) => {
  const { error } = budgetSchema.validate(budget);
  if (error) {
    logger.warn('Invalid input', { userId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  const newBudget = {
    ...budget,
    BudgetID: uuidv4(),
    UserID: userId,
    CreatedAt: new Date().toISOString()
  };
  const params = {
    TableName: TABLE_NAME,
    Item: newBudget
  };
  await dynamodb.put(params).promise();
  logger.info('Budget created', { userId, budgetId: newBudget.BudgetID });
  return createResponse(201, { message: 'Budget created successfully', budget: newBudget });
};

/**
 * Updates an existing budget in the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} budgetId - The ID of the budget to update.
 * @param {Object} budget - The updated budget data.
 * @returns {Promise<Object>} The Lambda response object.
 */
const updateBudget = async (userId, budgetId, budget) => {
  const { error } = budgetSchema.validate(budget);
  if (error) {
    logger.warn('Invalid input', { userId, budgetId, error: error.details[0].message });
    return createResponse(400, { message: error.details[0].message });
  }
  
  // First, check if the budget belongs to the user
  const getParams = {
    TableName: TABLE_NAME,
    Key: { BudgetID: budgetId }
  };
  const getResult = await dynamodb.get(getParams).promise();
  if (!getResult.Item || getResult.Item.UserID !== userId) {
    logger.warn('Budget not found or unauthorized', { userId, budgetId });
    return createResponse(404, { message: 'Budget not found' });
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { BudgetID: budgetId },
    UpdateExpression: 'set Category = :category, Amount = :amount, Period = :period, UpdatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':category': budget.Category,
      ':amount': budget.Amount,
      ':period': budget.Period,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };
  const result = await dynamodb.update(params).promise();
  logger.info('Budget updated', { userId, budgetId });
  return createResponse(200, { message: 'Budget updated successfully', budget: result.Attributes });
};

/**
 * Deletes a budget from the database.
 *
 * @param {string} userId - The ID of the user.
 * @param {string} budgetId - The ID of the budget to delete.
 * @returns {Promise<Object>} The Lambda response object.
 */
const deleteBudget = async (userId, budgetId) => {
  // First, check if the budget belongs to the user
  const getParams = {
    TableName: TABLE_NAME,
    Key: { BudgetID: budgetId }
  };
  const getResult = await dynamodb.get(getParams).promise();
  if (!getResult.Item || getResult.Item.UserID !== userId) {
    logger.warn('Budget not found or unauthorized', { userId, budgetId });
    return createResponse(404, { message: 'Budget not found' });
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: { BudgetID: budgetId }
  };
  await dynamodb.delete(params).promise();
  logger.info('Budget deleted', { userId, budgetId });
  return createResponse(200, { message: 'Budget deleted successfully' });
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
        return path === '/budget' ? await getAllBudgets(userId) : await getBudget(userId, pathParameters.id);
      case 'POST':
        return await createBudget(userId, JSON.parse(body));
      case 'PUT':
        return await updateBudget(userId, pathParameters.id, JSON.parse(body));
      case 'DELETE':
        return await deleteBudget(userId, pathParameters.id);
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
    getAllBudgets,
    getBudget,
    createBudget,
    updateBudget,
    deleteBudget
  };
}
