/**

This test file covers:

Getting all transactions for a user
Getting a specific transaction
Creating a new transaction
Updating an existing transaction
Deleting a transaction
Handling invalid input
Handling attempts to update or delete non-existent transactions
Handling unexpected errors

It mocks the AWS SDK and UUID generation to isolate the Lambda function's behavior. The tests check for correct status codes, response messages, and in some cases, the structure of the returned data.
This comprehensive test suite ensures that the transaction Lambda function behaves correctly under various scenarios, including both successful operations and error conditions.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

jest.mock('aws-sdk');
jest.mock('uuid');

describe('Transaction Lambda Function', () => {
    let mockDynamoDb;
    const userId = 'test-user-id';
    const mockAuthorizer = {
        claims: { sub: userId }
    };

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
        uuidv4.mockReturnValue('mock-uuid');
    });

    it('should get all transactions for a user', async () => {
        const mockTransactions = [
            { TransactionID: '1', UserID: userId, Amount: 100 },
            { TransactionID: '2', UserID: userId, Amount: -50 }
        ];
        mockDynamoDb.promise.mockResolvedValue({ Items: mockTransactions });

        const event = {
            httpMethod: 'GET',
            path: '/transaction',
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockTransactions);
    });

    it('should get a specific transaction for a user', async () => {
        const mockTransaction = { TransactionID: '1', UserID: userId, Amount: 100 };
        mockDynamoDb.promise.mockResolvedValue({ Item: mockTransaction });

        const event = {
            httpMethod: 'GET',
            path: '/transaction/1',
            pathParameters: { id: '1' },
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockTransaction);
    });

    it('should create a new transaction', async () => {
        const newTransaction = {
            AccountID: 'account-1',
            Date: '2023-06-24',
            Amount: 100,
            Category: 'Income',
            Description: 'Salary'
        };
        mockDynamoDb.promise.mockResolvedValue({});

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(newTransaction),
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body).message).toBe('Transaction created successfully');
        expect(JSON.parse(result.body).transaction.TransactionID).toBe('mock-uuid');
    });

    it('should update an existing transaction', async () => {
        const updatedTransaction = {
            AccountID: 'account-1',
            Date: '2023-06-24',
            Amount: 150,
            Category: 'Income',
            Description: 'Updated Salary'
        };
        mockDynamoDb.promise.mockResolvedValue({ Attributes: { ...updatedTransaction, TransactionID: '1', UserID: userId } });

        const event = {
            httpMethod: 'PUT',
            pathParameters: { id: '1' },
            body: JSON.stringify(updatedTransaction),
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Transaction updated successfully');
    });

    it('should delete an existing transaction', async () => {
        mockDynamoDb.promise.mockResolvedValue({});

        const event = {
            httpMethod: 'DELETE',
            pathParameters: { id: '1' },
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Transaction deleted successfully');
    });

    it('should return 400 for invalid input', async () => {
        const invalidTransaction = {
            AccountID: 'account-1',
            // Missing required fields
        };

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(invalidTransaction),
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('"Date" is required');
    });

    it('should return 404 when updating non-existent transaction', async () => {
        mockDynamoDb.promise.mockRejectedValue({ code: 'ConditionalCheckFailedException' });

        const event = {
            httpMethod: 'PUT',
            pathParameters: { id: 'non-existent' },
            body: JSON.stringify({
                AccountID: 'account-1',
                Date: '2023-06-24',
                Amount: 150,
                Category: 'Income',
                Description: 'Updated Salary'
            }),
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Transaction not found or does not belong to the user');
    });

    it('should return 404 when deleting non-existent transaction', async () => {
        mockDynamoDb.promise.mockRejectedValue({ code: 'ConditionalCheckFailedException' });

        const event = {
            httpMethod: 'DELETE',
            pathParameters: { id: 'non-existent' },
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Transaction not found or does not belong to the user');
    });

    it('should return 500 for unexpected errors', async () => {
        mockDynamoDb.promise.mockRejectedValue(new Error('Unexpected error'));

        const event = {
            httpMethod: 'GET',
            path: '/transaction',
            requestContext: { authorizer: mockAuthorizer }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message).toBe('Internal server error');
    });
});
