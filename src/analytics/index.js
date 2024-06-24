/**

This analytics function provides a comprehensive summary of the user's financial data, including:

Income vs. Expenses analysis
Budget progress for each category
Progress towards financial goals
Top spending categories
Monthly income and expense trends

The function expects to be triggered by an HTTP GET request to the /analytics/summary endpoint. It retrieves data from the transaction, budget, and goal tables, performs the necessary calculations, and returns a JSON response with the analysis results.
Note that this implementation assumes that the necessary IAM permissions are set up for the Lambda function to access the DynamoDB tables. You'll need to ensure that the TRANSACTION_TABLE, BUDGET_TABLE, and GOAL_TABLE environment variables are correctly set in your SAM template.
Also, keep in mind that this implementation uses a scan operation on the DynamoDB tables, which can be inefficient for large datasets. For a production application with a large number of users and transactions, you might want to consider using more efficient querying methods or implementing pagination.

*/

'use strict';

const AWS = require('aws-sdk');
const winston = require('winston');

// Initialize AWS SDK and Winston logger
const dynamodb = new AWS.DynamoDB.DocumentClient();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'analytics-service' },
  transports: [
    new winston.transports.Console()
  ],
});

// Environment variables
const TRANSACTION_TABLE = process.env.TRANSACTION_TABLE;
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const GOAL_TABLE = process.env.GOAL_TABLE;
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
 * Retrieves all items for a specific user from a DynamoDB table.
 *
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array>} The array of items retrieved.
 */
async function getAllItems(tableName, userId) {
  const params = {
    TableName: tableName,
    FilterExpression: 'UserID = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };
  const result = await dynamodb.scan(params).promise();
  return result.Items;
}

/**
 * Analyzes income vs expenses from transactions.
 *
 * @param {Array} transactions - The array of transactions.
 * @returns {Object} The income vs expenses analysis.
 */
function analyzeIncomeVsExpenses(transactions) {
  const income = transactions.filter(t => t.Amount > 0).reduce((sum, t) => sum + t.Amount, 0);
  const expenses = transactions.filter(t => t.Amount < 0).reduce((sum, t) => sum + Math.abs(t.Amount), 0);
  return { income, expenses, netIncome: income - expenses };
}

/**
 * Analyzes budget progress based on transactions and budgets.
 *
 * @param {Array} transactions - The array of transactions.
 * @param {Array} budgets - The array of budgets.
 * @returns {Array} The budget progress analysis.
 */
function analyzeBudgetProgress(transactions, budgets) {
  return budgets.map(budget => {
    const spent = transactions
      .filter(t => t.Category === budget.Category && t.Amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.Amount), 0);
    return {
      category: budget.Category,
      limit: budget.Amount,
      spent,
      remaining: budget.Amount - spent,
      percentUsed: (spent / budget.Amount) * 100
    };
  });
}

/**
 * Analyzes goal progress.
 *
 * @param {Array} goals - The array of goals.
 * @returns {Array} The goal progress analysis.
 */
function analyzeGoalProgress(goals) {
  return goals.map(goal => ({
    name: goal.GoalName,
    target: goal.TargetAmount,
    current: goal.CurrentAmount,
    remaining: goal.TargetAmount - goal.CurrentAmount,
    progress: (goal.CurrentAmount / goal.TargetAmount) * 100
  }));
}

/**
 * Analyzes top spending categories from transactions.
 *
 * @param {Array} transactions - The array of transactions.
 * @returns {Array} The top categories analysis.
 */
function analyzeTopCategories(transactions) {
  const categoryTotals = transactions.reduce((totals, t) => {
    if (!totals[t.Category]) totals[t.Category] = 0;
    totals[t.Category] += Math.abs(t.Amount);
    return totals;
  }, {});

  return Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({ category, total }));
}

/**
 * Analyzes monthly spending trends from transactions.
 *
 * @param {Array} transactions - The array of transactions.
 * @returns {Array} The monthly trend analysis.
 */
function analyzeMonthlyTrend(transactions) {
  const monthlyTotals = transactions.reduce((totals, t) => {
    const date = new Date(t.Date);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!totals[monthYear]) totals[monthYear] = { income: 0, expenses: 0 };
    if (t.Amount > 0) totals[monthYear].income += t.Amount;
    else totals[monthYear].expenses += Math.abs(t.Amount);
    return totals;
  }, {});

  return Object.entries(monthlyTotals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { income, expenses }]) => ({ month, income, expenses }));
}

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

  const { httpMethod, path } = event;

  try {
    const userId = getUserId(event);

    if (httpMethod === 'GET') {
      if (path === '/analytics/summary') {
        const transactions = await getAllItems(TRANSACTION_TABLE, userId);
        const budgets = await getAllItems(BUDGET_TABLE, userId);
        const goals = await getAllItems(GOAL_TABLE, userId);

        const summary = {
          incomeVsExpenses: analyzeIncomeVsExpenses(transactions),
          budgetProgress: analyzeBudgetProgress(transactions, budgets),
          goalProgress: analyzeGoalProgress(goals),
          topCategories: analyzeTopCategories(transactions),
          monthlyTrend: analyzeMonthlyTrend(transactions)
        };

        logger.info('Analytics summary generated', { userId });
        return createResponse(200, summary);
      } else {
        logger.warn('Invalid path requested', { userId, path });
        return createResponse(404, { message: 'Not found' });
      }
    } else {
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
    getAllItems,
    analyzeIncomeVsExpenses,
    analyzeBudgetProgress,
    analyzeGoalProgress,
    analyzeTopCategories,
    analyzeMonthlyTrend
  };
}
