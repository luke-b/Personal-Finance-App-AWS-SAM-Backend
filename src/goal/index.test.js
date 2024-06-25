const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index'); 

AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore();  // Reset AWS mocks
  process.env.GOAL_TABLE = 'Goals';
});

afterAll(() => {
  AWSMock.restore();
});

describe('Goal Service Tests', () => {
  it('retrieves all goals successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
      callback(null, {
        Items: [{ GoalID: '1', GoalName: 'Save for vacation', TargetAmount: 2000, CurrentAmount: 500 }],
        Count: 1
      });
    });

    const event = {
      httpMethod: 'GET',
      path: '/goal',
      requestContext: {
        authorizer: {
          claims: { sub: 'user-id-1' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveLength(1);
  });

  it('creates a new goal successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        GoalName: 'Buy a new car',
        TargetAmount: 30000,
        CurrentAmount: 0,
        Deadline: '2025-12-31'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user-id-2' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).message).toEqual('Goal created successfully');
  });

  it('updates an existing goal successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {
        Item: { GoalID: '2', UserID: 'user-id-3' }
      });
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      callback(null, {
        Attributes: {
          GoalID: '2',
          GoalName: 'New Home',
          TargetAmount: 50000,
          CurrentAmount: 2000,
          Deadline: '2024-01-01'
        }
      });
    });

    const event = {
      httpMethod: 'PUT',
      pathParameters: { id: '2' },
      body: JSON.stringify({
        GoalName: 'New Home',
        TargetAmount: 50000,
        CurrentAmount: 2000,
        Deadline: '2024-01-01'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user-id-3' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toEqual('Goal updated successfully');
  });

  it('deletes a goal successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: { GoalID: '3', UserID: 'user-id-4' } });
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'DELETE',
      pathParameters: { id: '3' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user-id-4' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toEqual('Goal deleted successfully');
  });

  it('handles not found or unauthorized goal operations', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});  // Goal not found
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'nonexistent' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user-id-5' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toEqual('Goal not found');
  });
});


