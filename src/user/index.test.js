/**

This test file covers all the main functionalities of the user Lambda function:

Getting all users
Getting a single user
Handling non-existent user requests
Creating a new user
Handling invalid user data
Updating an existing user
Deleting a user
Handling unsupported HTTP methods
Handling internal server errors

The tests use Jest's mocking capabilities to mock AWS SDK calls and the UUID generation. This allows us to test the function's logic without actually interacting with AWS services.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

jest.mock('aws-sdk');
jest.mock('uuid');

describe('User Lambda Function', () => {
    let mockDynamoDb;

    beforeEach(() => {
        mockDynamoDb = {
            scan: jest.fn().mockReturnThis(),
            get: jest.fn().mockReturnThis(),
            put: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        AWS.DynamoDB.DocumentClient.mockImplementation(() => mockDynamoDb);
        uuidv4.mockReturnValue('mocked-uuid');
    });

    it('should return all users', async () => {
        const mockUsers = [{ UserID: '1', Name: 'John Doe', Email: 'john@example.com' }];
        mockDynamoDb.promise.mockResolvedValue({ Items: mockUsers });

        const event = {
            httpMethod: 'GET',
            path: '/user'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockUsers);
    });

    it('should return a single user', async () => {
        const mockUser = { UserID: '1', Name: 'John Doe', Email: 'john@example.com' };
        mockDynamoDb.promise.mockResolvedValue({ Item: mockUser });

        const event = {
            httpMethod: 'GET',
            path: '/user/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockUser);
    });

    it('should return 404 for non-existent user', async () => {
        mockDynamoDb.promise.mockResolvedValue({});

        const event = {
            httpMethod: 'GET',
            path: '/user/999',
            pathParameters: { id: '999' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({ message: 'User not found' });
    });

    it('should create a new user', async () => {
        mockDynamoDb.promise.mockResolvedValue({});

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ Name: 'Jane Doe', Email: 'jane@example.com' })
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body)).toEqual({
            message: 'User created successfully',
            user: {
                UserID: 'mocked-uuid',
                Name: 'Jane Doe',
                Email: 'jane@example.com'
            }
        });
    });

    it('should return 400 for invalid user data', async () => {
        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ Name: 'Jane Doe' }) // Missing Email
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('"Email" is required');
    });

    it('should update an existing user', async () => {
        const updatedUser = { UserID: '1', Name: 'Jane Updated', Email: 'jane.updated@example.com' };
        mockDynamoDb.promise.mockResolvedValue({ Attributes: updatedUser });

        const event = {
            httpMethod: 'PUT',
            pathParameters: { id: '1' },
            body: JSON.stringify({ Name: 'Jane Updated', Email: 'jane.updated@example.com' })
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'User updated successfully',
            user: updatedUser
        });
    });

    it('should delete a user', async () => {
        mockDynamoDb.promise.mockResolvedValue({});

        const event = {
            httpMethod: 'DELETE',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ message: 'User deleted successfully' });
    });

    it('should return 400 for unsupported HTTP method', async () => {
        const event = {
            httpMethod: 'PATCH',
            path: '/user'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Unsupported HTTP method' });
    });

    it('should return 500 for internal server error', async () => {
        mockDynamoDb.promise.mockRejectedValue(new Error('Database error'));

        const event = {
            httpMethod: 'GET',
            path: '/user'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
    });
});
