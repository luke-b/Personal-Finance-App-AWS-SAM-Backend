const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.USER_TABLE;

// Validation schema for user data
const userSchema = Joi.object({
    Name: Joi.string().required(),
    Email: Joi.string().email().required()
});

// Helper function for API responses
const response = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
});

// Helper function for logging
const log = (message, data) => {
    console.log(`[USER] ${message}`, JSON.stringify(data, null, 2));
};

exports.handler = async (event) => {
    log('Event received', event);

    const { httpMethod, path, body, pathParameters } = event;

    try {
        switch (httpMethod) {
            case 'GET':
                if (path === '/user') {
                    const params = { TableName: TABLE_NAME };
                    const result = await dynamodb.scan(params).promise();
                    log('Users retrieved', result);
                    return response(200, result.Items);
                } else {
                    const userId = pathParameters.id;
                    const params = {
                        TableName: TABLE_NAME,
                        Key: { UserID: userId }
                    };
                    const result = await dynamodb.get(params).promise();
                    if (!result.Item) {
                        return response(404, { message: 'User not found' });
                    }
                    log('User retrieved', result.Item);
                    return response(200, result.Item);
                }

            case 'POST':
                const user = JSON.parse(body);
                const { error } = userSchema.validate(user);
                if (error) {
                    return response(400, { message: error.details[0].message });
                }
                user.UserID = uuidv4();
                const params = {
                    TableName: TABLE_NAME,
                    Item: user
                };
                await dynamodb.put(params).promise();
                log('User created', user);
                return response(201, { message: 'User created successfully', user });

            case 'PUT':
                const updateUser = JSON.parse(body);
                const { error: updateError } = userSchema.validate(updateUser);
                if (updateError) {
                    return response(400, { message: updateError.details[0].message });
                }
                const updateParams = {
                    TableName: TABLE_NAME,
                    Key: { UserID: pathParameters.id },
                    UpdateExpression: 'set #name = :name, #email = :email',
                    ExpressionAttributeNames: {
                        '#name': 'Name',
                        '#email': 'Email'
                    },
                    ExpressionAttributeValues: {
                        ':name': updateUser.Name,
                        ':email': updateUser.Email
                    },
                    ReturnValues: 'ALL_NEW'
                };
                const updateResult = await dynamodb.update(updateParams).promise();
                log('User updated', updateResult.Attributes);
                return response(200, { message: 'User updated successfully', user: updateResult.Attributes });

            case 'DELETE':
                const deleteParams = {
                    TableName: TABLE_NAME,
                    Key: { UserID: pathParameters.id }
                };
                await dynamodb.delete(deleteParams).promise();
                log('User deleted', { UserID: pathParameters.id });
                return response(200, { message: 'User deleted successfully' });

            default:
                return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        log('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};
