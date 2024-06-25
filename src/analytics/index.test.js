const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index');  

// Setting up the AWS SDK DynamoDB DocumentClient mock
AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore('DynamoDB.DocumentClient');
  process.env.TRANSACTION_TABLE = 'Transactions';
  process.env.BUDGET_TABLE = 'Budgets';
  process.env.GOAL_TABLE = 'Goals';
});

afterAll(() => {
  AWSMock.restore();
});

describe('Analytics Data Retrieval', () => {
  it('should retrieve and analyze financial data correctly', async () => {
    // Mock DynamoDB responses for transactions, budgets, and goals
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', function (params, callback){
      if (params.TableName === process.env.TRANSACTION_TABLE) {
        callback(null, { Items: [{ Amount: 500, Date: new Date().toISOString(), Category: 'Food' }] });
      } else if (params.TableName === process.env.BUDGET_TABLE) {
        callback(null, { Items: [{ Category: 'Food', Amount: 600 }] });
      } else if (params.TableName === process.env.GOAL_TABLE) {
        callback(null, { Items: [{ GoalName: 'Vacation', TargetAmount: 1000, CurrentAmount: 300 }] });
      }
    });

    const event = {
      httpMethod: 'GET',
      path: '/analytics/summary',
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123'  // Mocked user ID
          }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.incomeVsExpenses.netIncome).toBe(500);
    expect(body.budgetProgress[0].remaining).toBe(100);
    expect(body.goalProgress[0].progress).toBe(30);
    expect(body.monthlyTrend.length).toBeGreaterThan(0);
  });
});


describe('Error Handling in Analytics Service', () => {
  it('should handle missing user ID with unauthorized error', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/analytics/summary',
      requestContext: {
        authorizer: {}
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toEqual('Unauthorized');
  });

  it('should return not found for incorrect paths', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/invalid/path',
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123'
          }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toEqual('Not found');
  });
});


