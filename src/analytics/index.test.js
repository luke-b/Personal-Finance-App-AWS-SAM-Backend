/**

This test file covers several scenarios:

It tests that the function returns a 404 for unknown paths.
It tests that the function returns a 400 for non-GET HTTP methods.
It tests the main functionality of the analytics summary, checking that:

The function correctly calculates income vs expenses.
It properly analyzes budget progress.
It correctly calculates goal progress.
It identifies top spending categories.
It generates the monthly trend data.

It tests error handling, ensuring that the function returns a 500 status for internal errors.

The test file mocks the AWS SDK to avoid actual DynamoDB calls during testing. It also sets up mock data to test the various analytical functions.

*/

const { handler } = require('./index');
const AWS = require('aws-sdk');

jest.mock('aws-sdk');

describe('Analytics Lambda Function', () => {
    let mockDynamoDb;

    beforeEach(() => {
        mockDynamoDb = {
            scan: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        AWS.DynamoDB.DocumentClient.mockImplementation(() => mockDynamoDb);

        process.env.TRANSACTION_TABLE = 'transactions';
        process.env.BUDGET_TABLE = 'budgets';
        process.env.GOAL_TABLE = 'goals';
    });

    it('should return a 404 for unknown paths', async () => {
        const event = {
            httpMethod: 'GET',
            path: '/analytics/unknown'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({ message: 'Not found' });
    });

    it('should return a 400 for non-GET methods', async () => {
        const event = {
            httpMethod: 'POST',
            path: '/analytics/summary'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Unsupported HTTP method' });
    });

    it('should return a summary of analytics', async () => {
        const mockTransactions = [
            { Amount: 1000, Category: 'Income', Date: '2023-01-01' },
            { Amount: -500, Category: 'Food', Date: '2023-01-15' },
            { Amount: -300, Category: 'Transport', Date: '2023-02-01' },
        ];
        const mockBudgets = [
            { Category: 'Food', Amount: 600 },
            { Category: 'Transport', Amount: 400 },
        ];
        const mockGoals = [
            { GoalName: 'Vacation', TargetAmount: 5000, CurrentAmount: 2000 },
        ];

        mockDynamoDb.promise
            .mockResolvedValueOnce({ Items: mockTransactions })
            .mockResolvedValueOnce({ Items: mockBudgets })
            .mockResolvedValueOnce({ Items: mockGoals });

        const event = {
            httpMethod: 'GET',
            path: '/analytics/summary'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);

        expect(body).toHaveProperty('incomeVsExpenses');
        expect(body).toHaveProperty('budgetProgress');
        expect(body).toHaveProperty('goalProgress');
        expect(body).toHaveProperty('topCategories');
        expect(body).toHaveProperty('monthlyTrend');

        expect(body.incomeVsExpenses).toEqual({
            income: 1000,
            expenses: 800,
            netIncome: 200
        });

        expect(body.budgetProgress).toHaveLength(2);
        expect(body.budgetProgress[0]).toEqual({
            category: 'Food',
            limit: 600,
            spent: 500,
            remaining: 100,
            percentUsed: (500 / 600) * 100
        });

        expect(body.goalProgress).toHaveLength(1);
        expect(body.goalProgress[0]).toEqual({
            name: 'Vacation',
            target: 5000,
            current: 2000,
            remaining: 3000,
            progress: 40
        });

        expect(body.topCategories).toHaveLength(3);
        expect(body.topCategories[0]).toEqual({
            category: 'Income',
            total: 1000
        });

        expect(body.monthlyTrend).toHaveLength(2);
        expect(body.monthlyTrend[0]).toEqual({
            month: '2023-01',
            income: 1000,
            expenses: 500
        });
    });

    it('should handle errors and return a 500 status', async () => {
        mockDynamoDb.promise.mockRejectedValue(new Error('Database error'));

        const event = {
            httpMethod: 'GET',
            path: '/analytics/summary'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
    });
});
