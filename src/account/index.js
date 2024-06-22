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

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.ACCOUNT_TABLE;

const accountSchema = Joi.object({
    UserID: Joi.string().required(),
    AccountName: Joi.string().required(),
    Balance: Joi.number().required(),
    Type: Joi.string().valid('Checking', 'Savings', 'Credit Card', 'Investment').required()
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
    console.log(`[ACCOUNT] ${message}`, JSON.stringify(data, null, 2));
};

exports.handler = async (event) => {
    log('Event received', event);

    const { httpMethod, path, body, pathParameters } = event;

    try {
        switch (httpMethod) {
            case 'GET':
                if (path === '/account') {
                    const params = { TableName: TABLE_NAME };
                    const result = await dynamodb.scan(params).promise();
                    log('Accounts retrieved', result);
                    return response(200, result.Items);
                } else {
                    const accountId = pathParameters.id;
                    const params = {
                        TableName: TABLE_NAME,
                        Key: { AccountID: accountId }
                    };
                    const result = await dynamodb.get(params).promise();
                    if (!result.Item) {
                        return response(404, { message: 'Account not found' });
                    }
                    log('Account retrieved', result.Item);
                    return response(200, result.Item);
                }

            case 'POST':
                const account = JSON.parse(body);
                const { error } = accountSchema.validate(account);
                if (error) {
                    return response(400, { message: error.details[0].message });
                }
                account.AccountID = uuidv4();
                const params = {
                    TableName: TABLE_NAME,
                    Item: account
                };
                await dynamodb.put(params).promise();
                log('Account created', account);
                return response(201, { message: 'Account created successfully', account });

            case 'PUT':
                const updateAccount = JSON.parse(body);
                const { error: updateError } = accountSchema.validate(updateAccount);
                if (updateError) {
                    return response(400, { message: updateError.details[0].message });
                }
                const updateParams = {
                    TableName: TABLE_NAME,
                    Key: { AccountID: pathParameters.id },
                    UpdateExpression: 'set AccountName = :name, Balance = :balance, #type = :type',
                    ExpressionAttributeNames: {
                        '#type': 'Type'
                    },
                    ExpressionAttributeValues: {
                        ':name': updateAccount.AccountName,
                        ':balance': updateAccount.Balance,
                        ':type': updateAccount.Type
                    },
                    ReturnValues: 'ALL_NEW'
                };
                const updateResult = await dynamodb.update(updateParams).promise();
                log('Account updated', updateResult.Attributes);
                return response(200, { message: 'Account updated successfully', account: updateResult.Attributes });

            case 'DELETE':
                const deleteParams = {
                    TableName: TABLE_NAME,
                    Key: { AccountID: pathParameters.id }
                };
                await dynamodb.delete(deleteParams).promise();
                log('Account deleted', { AccountID: pathParameters.id });
                return response(200, { message: 'Account deleted successfully' });

            default:
                return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        log('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};
