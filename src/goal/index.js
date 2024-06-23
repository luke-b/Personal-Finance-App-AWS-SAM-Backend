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


const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.GOAL_TABLE;

const goalSchema = Joi.object({
    UserID: Joi.string().required(),
    GoalName: Joi.string().required(),
    TargetAmount: Joi.number().positive().required(),
    CurrentAmount: Joi.number().min(0).required(),
    Deadline: Joi.date().iso().required()
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
    console.log(`[GOAL] ${message}`, JSON.stringify(data, null, 2));
};

exports.handler = async (event) => {
    log('Event received', event);

    const { httpMethod, path, body, pathParameters } = event;

    try {
        switch (httpMethod) {
            case 'GET':
                if (path === '/goal') {
                    const params = { TableName: TABLE_NAME };
                    const result = await dynamodb.scan(params).promise();
                    log('Goals retrieved', result);
                    return response(200, result.Items);
                } else {
                    const goalId = pathParameters.id;
                    const params = {
                        TableName: TABLE_NAME,
                        Key: { GoalID: goalId }
                    };
                    const result = await dynamodb.get(params).promise();
                    if (!result.Item) {
                        return response(404, { message: 'Goal not found' });
                    }
                    log('Goal retrieved', result.Item);
                    return response(200, result.Item);
                }

            case 'POST':
                const goal = JSON.parse(body);
                const { error } = goalSchema.validate(goal);
                if (error) {
                    return response(400, { message: error.details[0].message });
                }
                goal.GoalID = uuidv4();
                const params = {
                    TableName: TABLE_NAME,
                    Item: goal
                };
                await dynamodb.put(params).promise();
                log('Goal created', goal);
                return response(201, { message: 'Goal created successfully', goal });

            case 'PUT':
                const updateGoal = JSON.parse(body);
                const { error: updateError } = goalSchema.validate(updateGoal);
                if (updateError) {
                    return response(400, { message: updateError.details[0].message });
                }
                const updateParams = {
                    TableName: TABLE_NAME,
                    Key: { GoalID: pathParameters.id },
                    UpdateExpression: 'set GoalName = :name, TargetAmount = :target, CurrentAmount = :current, Deadline = :deadline',
                    ExpressionAttributeValues: {
                        ':name': updateGoal.GoalName,
                        ':target': updateGoal.TargetAmount,
                        ':current': updateGoal.CurrentAmount,
                        ':deadline': updateGoal.Deadline
                    },
                    ReturnValues: 'ALL_NEW'
                };
                const updateResult = await dynamodb.update(updateParams).promise();
                log('Goal updated', updateResult.Attributes);
                return response(200, { message: 'Goal updated successfully', goal: updateResult.Attributes });

            case 'DELETE':
                const deleteParams = {
                    TableName: TABLE_NAME,
                    Key: { GoalID: pathParameters.id }
                };
                await dynamodb.delete(deleteParams).promise();
                log('Goal deleted', { GoalID: pathParameters.id });
                return response(200, { message: 'Goal deleted successfully' });

            default:
                return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        log('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};
