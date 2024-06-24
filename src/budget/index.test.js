/**

This test file covers the following scenarios:

Getting all budgets
Getting a specific budget
Creating a new budget
Updating an existing budget
Deleting a budget
Handling invalid input
Handling requests for non-existent budgets
Handling unsupported HTTP methods

The tests use Jest's mocking capabilities to mock AWS SDK calls and the UUID generation. This allows us to test the Lambda function's logic without actually interacting with AWS services.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

jest.mock('aws-sdk');
jest.mock('uuid');

describe('Budget Lambda Function', () => {
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
        uuidv4.mockReturnValue('mock-uuid');
    });

    it('should return all budgets', async () => {
        const mockBudgets = [{ BudgetID: '1', Category: 'Food', Amount: 500 }];
        mockDynamoDb.promise.mockResolvedValue({ Items: mockBudgets });

        const event = {
            httpMethod: 'GET',
            path: '/budget'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockBudgets);
    });

    it('should return a specific budget', async () => {
        const mockBudget = { BudgetID: '1', Category: 'Food', Amount: 500 };
        mockDynamoDb.promise.mockResolvedValue({ Item: mockBudget });

        const event = {
            httpMethod: 'GET',
            path: '/budget/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockBudget);
    });

    it('should create a new budget', async () => {
        const newBudget = {
            UserID: 'user1',
            Category: 'Food',
            Amount: 500,
            Period: 'monthly'
        };

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(newBudget)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body).message).toBe('Budget created successfully');
        expect(JSON.parse(result.body).budget.BudgetID).toBe('mock-uuid');
    });

    it('should update an existing budget', async () => {
        const updatedBudget = {
            UserID: 'user1',
            Category: 'Food',
            Amount: 600,
            Period: 'monthly'
        };

        mockDynamoDb.promise.mockResolvedValue({
            Attributes: { ...updatedBudget, BudgetID: '1' }
        });

        const event = {
            httpMethod: 'PUT',
            pathParameters: { id: '1' },
            body: JSON.stringify(updatedBudget)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Budget updated successfully');
    });

    it('should delete a budget', async () => {
        const event = {
            httpMethod: 'DELETE',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Budget deleted successfully');
    });

    it('should return 400 for invalid input', async () => {
        const invalidBudget = {
            UserID: 'user1',
            Category: 'Food',
            Amount: -500,  // Invalid: negative amount
            Period: 'monthly'
        };

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(invalidBudget)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('"Amount" must be a positive number');
    });

    it('should return 404 for non-existent budget', async () => {
        mockDynamoDb.promise.mockResolvedValue({ Item: null });

        const event = {
            httpMethod: 'GET',
            path: '/budget/999',
            pathParameters: { id: '999' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Budget not found');
    });

    it('should return 400 for unsupported HTTP method', async () => {
        const event = {
            httpMethod: 'PATCH',
            path: '/budget/1'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Unsupported HTTP method');
    });
});
