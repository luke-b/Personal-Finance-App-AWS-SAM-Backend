/**

This test file covers the following scenarios:

Getting all accounts
Getting a specific account
Creating a new account with valid data
Updating an existing account
Deleting an account
Handling an invalid HTTP method
Handling invalid input data when creating an account
Handling a request for a non-existent account
Handling unexpected errors

The tests mock the AWS SDK and UUID generation to isolate the Lambda function's logic. They also set the ACCOUNT_TABLE environment variable to mimic the AWS Lambda environment.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

jest.mock('aws-sdk');
jest.mock('uuid');

describe('Account Lambda Function', () => {
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
        
        process.env.ACCOUNT_TABLE = 'test-account-table';
    });

    it('should return all accounts when GET /account is called', async () => {
        const mockAccounts = [
            { AccountID: '1', UserID: 'user1', AccountName: 'Checking', Balance: 1000, Type: 'Checking' },
            { AccountID: '2', UserID: 'user1', AccountName: 'Savings', Balance: 5000, Type: 'Savings' }
        ];
        mockDynamoDb.promise.mockResolvedValue({ Items: mockAccounts });

        const event = {
            httpMethod: 'GET',
            path: '/account'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockAccounts);
    });

    it('should return a specific account when GET /account/{id} is called', async () => {
        const mockAccount = { AccountID: '1', UserID: 'user1', AccountName: 'Checking', Balance: 1000, Type: 'Checking' };
        mockDynamoDb.promise.mockResolvedValue({ Item: mockAccount });

        const event = {
            httpMethod: 'GET',
            path: '/account/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockAccount);
    });

    it('should create a new account when POST /account is called with valid data', async () => {
        const mockAccountData = { UserID: 'user1', AccountName: 'New Account', Balance: 0, Type: 'Savings' };
        const mockAccountId = 'new-account-id';
        uuidv4.mockReturnValue(mockAccountId);

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(mockAccountData)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Account created successfully',
            account: { ...mockAccountData, AccountID: mockAccountId }
        });
    });

    it('should update an account when PUT /account/{id} is called with valid data', async () => {
        const mockUpdateData = { UserID: 'user1', AccountName: 'Updated Account', Balance: 2000, Type: 'Checking' };
        const mockUpdatedAccount = { ...mockUpdateData, AccountID: '1' };
        mockDynamoDb.promise.mockResolvedValue({ Attributes: mockUpdatedAccount });

        const event = {
            httpMethod: 'PUT',
            path: '/account/1',
            pathParameters: { id: '1' },
            body: JSON.stringify(mockUpdateData)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Account updated successfully',
            account: mockUpdatedAccount
        });
    });

    it('should delete an account when DELETE /account/{id} is called', async () => {
        const event = {
            httpMethod: 'DELETE',
            path: '/account/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ message: 'Account deleted successfully' });
    });

    it('should return 400 when an invalid HTTP method is used', async () => {
        const event = {
            httpMethod: 'PATCH',
            path: '/account'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Unsupported HTTP method' });
    });

    it('should return 400 when creating an account with invalid data', async () => {
        const invalidAccountData = { UserID: 'user1', AccountName: 'Invalid Account' }; // Missing Balance and Type
        
        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(invalidAccountData)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('"Balance" is required');
    });

    it('should return 404 when getting a non-existent account', async () => {
        mockDynamoDb.promise.mockResolvedValue({ Item: null });

        const event = {
            httpMethod: 'GET',
            path: '/account/non-existent',
            pathParameters: { id: 'non-existent' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({ message: 'Account not found' });
    });

    it('should return 500 when an unexpected error occurs', async () => {
        mockDynamoDb.promise.mockRejectedValue(new Error('Unexpected error'));

        const event = {
            httpMethod: 'GET',
            path: '/account'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
    });
});
