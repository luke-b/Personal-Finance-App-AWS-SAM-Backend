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

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.BUDGET_TABLE;

const budgetSchema = Joi.object({
    UserID: Joi.string().required(),
    Category: Joi.string().required(),
    Amount: Joi.number().positive().required(),
    Period: Joi.string().valid('weekly', 'monthly', 'yearly').required()
});

const response = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
});

const log = (message, data) => {
    console.log(`[BUDGET] ${message}`, JSON.stringify(data, null, 2));
};

exports.handler = async (event) => {
    log('Event received', event);

    const { httpMethod, path, body, pathParameters } = event;

    try {
        switch (httpMethod) {
            case 'GET':
                if (path === '/budget') {
                    const params = { TableName: TABLE_NAME };
                    const result = await dynamodb.scan(params).promise();
                    log('Budgets retrieved', result);
                    return response(200, result.Items);
                } else {
                    const budgetId = pathParameters.id;
                    const params = {
                        TableName: TABLE_NAME,
                        Key: { BudgetID: budgetId }
                    };
                    const result = await dynamodb.get(params).promise();
                    if (!result.Item) {
                        return response(404, { message: 'Budget not found' });
                    }
                    log('Budget retrieved', result.Item);
                    return response(200, result.Item);
                }

            case 'POST':
                const budget = JSON.parse(body);
                const { error } = budgetSchema.validate(budget);
                if (error) {
                    return response(400, { message: error.details[0].message });
                }
                budget.BudgetID = uuidv4();
                const params = {
                    TableName: TABLE_NAME,
                    Item: budget
                };
                await dynamodb.put(params).promise();
                log('Budget created', budget);
                return response(201, { message: 'Budget created successfully', budget });

            case 'PUT':
                const updateBudget = JSON.parse(body);
                const { error: updateError } = budgetSchema.validate(updateBudget);
                if (updateError) {
                    return response(400, { message: updateError.details[0].message });
                }
                const updateParams = {
                    TableName: TABLE_NAME,
                    Key: { BudgetID: pathParameters.id },
                    UpdateExpression: 'set Category = :category, Amount = :amount, Period = :period',
                    ExpressionAttributeValues: {
                        ':category': updateBudget.Category,
                        ':amount': updateBudget.Amount,
                        ':period': updateBudget.Period
                    },
                    ReturnValues: 'ALL_NEW'
                };
                const updateResult = await dynamodb.update(updateParams).promise();
                log('Budget updated', updateResult.Attributes);
                return response(200, { message: 'Budget updated successfully', budget: updateResult.Attributes });

            case 'DELETE':
                const deleteParams = {
                    TableName: TABLE_NAME,
                    Key: { BudgetID: pathParameters.id }
                };
                await dynamodb.delete(deleteParams).promise();
                log('Budget deleted', { BudgetID: pathParameters.id });
                return response(200, { message: 'Budget deleted successfully' });

            default:
                return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        log('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};
