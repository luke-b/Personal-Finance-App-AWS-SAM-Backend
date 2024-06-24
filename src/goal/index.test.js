/**

This test file covers:

Retrieving all goals
Retrieving a specific goal
Handling the case when a goal is not found
Creating a new goal
Handling invalid input when creating a goal
Updating an existing goal
Deleting a goal
Handling unsupported HTTP methods
Handling internal server errors

The tests use Jest's mocking capabilities to mock AWS SDK calls and the UUID generation. This allows us to test the Lambda function's logic without actually interacting with AWS services.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

jest.mock('aws-sdk');
jest.mock('uuid');

describe('Goal Lambda Function', () => {
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

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return all goals', async () => {
        const mockGoals = [{ GoalID: '1', GoalName: 'Test Goal' }];
        mockDynamoDb.promise.mockResolvedValue({ Items: mockGoals });

        const event = {
            httpMethod: 'GET',
            path: '/goal'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockGoals);
    });

    it('should return a specific goal', async () => {
        const mockGoal = { GoalID: '1', GoalName: 'Test Goal' };
        mockDynamoDb.promise.mockResolvedValue({ Item: mockGoal });

        const event = {
            httpMethod: 'GET',
            path: '/goal/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(mockGoal);
    });

    it('should return 404 when goal is not found', async () => {
        mockDynamoDb.promise.mockResolvedValue({ Item: null });

        const event = {
            httpMethod: 'GET',
            path: '/goal/1',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({ message: 'Goal not found' });
    });

    it('should create a new goal', async () => {
        const mockGoal = {
            UserID: 'user1',
            GoalName: 'New Goal',
            TargetAmount: 1000,
            CurrentAmount: 0,
            Deadline: '2023-12-31'
        };

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(mockGoal)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body).message).toBe('Goal created successfully');
        expect(JSON.parse(result.body).goal).toEqual({
            ...mockGoal,
            GoalID: 'mock-uuid'
        });
    });

    it('should return 400 when creating a goal with invalid data', async () => {
        const invalidGoal = {
            UserID: 'user1',
            GoalName: 'Invalid Goal',
            TargetAmount: -1000, // Invalid negative amount
            CurrentAmount: 0,
            Deadline: '2023-12-31'
        };

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify(invalidGoal)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('"TargetAmount" must be a positive number');
    });

    it('should update an existing goal', async () => {
        const updatedGoal = {
            GoalName: 'Updated Goal',
            TargetAmount: 2000,
            CurrentAmount: 500,
            Deadline: '2024-06-30'
        };

        mockDynamoDb.promise.mockResolvedValue({
            Attributes: { ...updatedGoal, GoalID: '1', UserID: 'user1' }
        });

        const event = {
            httpMethod: 'PUT',
            pathParameters: { id: '1' },
            body: JSON.stringify(updatedGoal)
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Goal updated successfully');
        expect(JSON.parse(result.body).goal).toEqual({
            ...updatedGoal,
            GoalID: '1',
            UserID: 'user1'
        });
    });

    it('should delete a goal', async () => {
        const event = {
            httpMethod: 'DELETE',
            pathParameters: { id: '1' }
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe('Goal deleted successfully');
    });

    it('should return 400 for unsupported HTTP method', async () => {
        const event = {
            httpMethod: 'PATCH',
            path: '/goal'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Unsupported HTTP method');
    });

    it('should return 500 for internal server errors', async () => {
        mockDynamoDb.promise.mockRejectedValue(new Error('Database error'));

        const event = {
            httpMethod: 'GET',
            path: '/goal'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message).toBe('Internal server error');
    });
});
