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

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TRANSACTION_TABLE;

const transactionSchema = Joi.object({
    UserID: Joi.string().required(),
    AccountID: Joi.string().required(),
    Date: Joi.date().iso().required(),
    Amount: Joi.number().required(),
    Category: Joi.string().required(),
    Description: Joi.string().allow('').optional()
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
    console.log(`[TRANSACTION] ${message}`, JSON.stringify(data, null, 2));
};

exports.handler = async (event) => {
    log('Event received', event);

    const { httpMethod, path, body, pathParameters, requestContext } = event;
    const userId = requestContext.authorizer.claims.sub;

    try {
        switch (httpMethod) {
            case 'GET':
                if (path === '/transaction') {
                    const params = {
                        TableName: TABLE_NAME,
                        FilterExpression: 'UserID = :userId',
                        ExpressionAttributeValues: { ':userId': userId }
                    };
                    const result = await dynamodb.scan(params).promise();
                    log('Transactions retrieved', result);
                    return response(200, result.Items);
                } else {
                    const transactionId = pathParameters.id;
                    const params = {
                        TableName: TABLE_NAME,
                        Key: { TransactionID: transactionId }
                    };
                    const result = await dynamodb.get(params).promise();
                    if (!result.Item || result.Item.UserID !== userId) {
                        return response(404, { message: 'Transaction not found' });
                    }
                    log('Transaction retrieved', result.Item);
                    return response(200, result.Item);
                }

            case 'POST':
                const transaction = JSON.parse(body);
                transaction.UserID = userId;
                const { error } = transactionSchema.validate(transaction);
                if (error) {
                    return response(400, { message: error.details[0].message });
                }
                transaction.TransactionID = uuidv4();
                const params = {
                    TableName: TABLE_NAME,
                    Item: transaction
                };
                await dynamodb.put(params).promise();
                log('Transaction created', transaction);
                return response(201, { message: 'Transaction created successfully', transaction });

            case 'PUT':
                const updateTransaction = JSON.parse(body);
                updateTransaction.UserID = userId;
                const { error: updateError } = transactionSchema.validate(updateTransaction);
                if (updateError) {
                    return response(400, { message: updateError.details[0].message });
                }
                const updateParams = {
                    TableName: TABLE_NAME,
                    Key: { TransactionID: pathParameters.id },
                    UpdateExpression: 'set AccountID = :accountId, #date = :date, Amount = :amount, Category = :category, Description = :description',
                    ExpressionAttributeNames: {
                        '#date': 'Date'
                    },
                    ExpressionAttributeValues: {
                        ':accountId': updateTransaction.AccountID,
                        ':date': updateTransaction.Date,
                        ':amount': updateTransaction.Amount,
                        ':category': updateTransaction.Category,
                        ':description': updateTransaction.Description
                    },
                    ConditionExpression: 'UserID = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    },
                    ReturnValues: 'ALL_NEW'
                };
                try {
                    const updateResult = await dynamodb.update(updateParams).promise();
                    log('Transaction updated', updateResult.Attributes);
                    return response(200, { message: 'Transaction updated successfully', transaction: updateResult.Attributes });
                } catch (error) {
                    if (error.code === 'ConditionalCheckFailedException') {
                        return response(404, { message: 'Transaction not found or does not belong to the user' });
                    }
                    throw error;
                }

            case 'DELETE':
                const deleteParams = {
                    TableName: TABLE_NAME,
                    Key: { TransactionID: pathParameters.id },
                    ConditionExpression: 'UserID = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    }
                };
                try {
                    await dynamodb.delete(deleteParams).promise();
                    log('Transaction deleted', { TransactionID: pathParameters.id });
                    return response(200, { message: 'Transaction deleted successfully' });
                } catch (error) {
                    if (error.code === 'ConditionalCheckFailedException') {
                        return response(404, { message: 'Transaction not found or does not belong to the user' });
                    }
                    throw error;
                }

            default:
                return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        log('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};
