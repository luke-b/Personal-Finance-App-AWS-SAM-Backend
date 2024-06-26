const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index');

// Set AWS SDK instance to mock
AWSMock.setSDKInstance(AWS);

const context = { awsRequestId: 'mockRequestId' };

beforeEach(() => {
  AWSMock.restore('DynamoDB.DocumentClient'); // Resets DynamoDB mocks
});

afterEach(() => {
  AWSMock.restore(); // Ensure clean slate for mocks after each test
});

describe('getAllBudgets', () => {
  it('retrieves all budgets for a user', async () => {
    const mockBudgets = [
      { BudgetID: '1', Category: 'Housing', Amount: 1200, Period: 'monthly', UserID: 'user123' },
      { BudgetID: '2', Category: 'Food', Amount: 300, Period: 'monthly', UserID: 'user123' }
    ];

    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
      callback(null, { Items: mockBudgets });
    });

    const event = {
      httpMethod: 'GET',
      path: '/budget',
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).length).toBe(2);
  });
});

describe('getBudget', () => {
  it('retrieves a single budget by ID', async () => {
    const mockBudget = { BudgetID: '1', Category: 'Housing', Amount: 1200, Period: 'monthly', UserID: 'user123' };

    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: mockBudget });
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: '1' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).Category).toEqual('Housing');
  });

  it('returns 404 if the budget is not found', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: '2' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(404);
  });
});

describe('createBudget', () => {
  it('successfully creates a new budget', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ Category: 'Travel', Amount: 1000, Period: 'yearly' }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).message).toContain('successfully');
  });

  it('returns an error for invalid budget data', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ Category: '', Amount: -100, Period: 'daily' }), // Invalid period and negative amount
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(400);
  });
});

describe('updateBudget', () => {
  it('successfully updates an existing budget', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: { BudgetID: '1', UserID: 'user123', Category: 'Food', Amount: 300, Period: 'monthly' } });
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      callback(null, { Attributes: { Category: 'Food', Amount: 350, Period: 'monthly' } });
    });

    const event = {
      httpMethod: 'PUT',
      pathParameters: { id: '1' },
      body: JSON.stringify({ Category: 'Food', Amount: 350, Period: 'monthly' }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('successfully');
    expect(JSON.parse(result.body).budget.Amount).toEqual(350);
  });

  it('returns an error if the budget to update does not exist', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'PUT',
      pathParameters: { id: 'nonexistent' },
      body: JSON.stringify({ Category: 'Entertainment', Amount: 200, Period: 'yearly' }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toEqual('Budget not found');
  });
});

describe('deleteBudget', () => {
  it('successfully deletes a budget', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: { BudgetID: '1', UserID: 'user123' } });
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'DELETE',
      pathParameters: { id: '1' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('successfully');
  });

  it('returns an error if attempting to delete a budget that does not exist', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'DELETE',
      pathParameters: { id: 'nonexistent' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event, context); // Pass context to handler
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toEqual('Budget not found');
  });
});

