const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index'); // Path to your transaction Lambda function file

AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore('DynamoDB.DocumentClient');
  process.env.TRANSACTION_TABLE = 'Transactions';
});

afterAll(() => {
  AWSMock.restore();
});

describe('createTransaction', () => {
  it('successfully creates a transaction', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        AccountID: '12345',
        Date: '2021-01-01T12:00:00Z',
        Amount: 100.00,
        Category: 'Utilities',
        Description: 'Electricity bill'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).message).toEqual('Transaction created successfully');
  });

  it('fails to create a transaction with invalid data', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        AccountID: '12345',
        Date: 'invalid-date',
        Amount: 'not-a-number',
        Category: ''  // Required field missing
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain('Invalid input');
  });
});

describe('getTransaction', () => {
  it('retrieves a specific transaction successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {
        Item: {
          TransactionID: 'txn123',
          UserID: 'user123',
          AccountID: '12345',
          Date: '2021-01-01T12:00:00Z',
          Amount: 100.00,
          Category: 'Utilities',
          Description: 'Electricity bill'
        }
      });
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'txn123' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).Category).toEqual('Utilities');
  });

  it('fails to retrieve a transaction not belonging to the user', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: null });
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'txn124' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user124' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});


describe('updateTransaction', () => {
  it('successfully updates a transaction', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      callback(null, {
        Attributes: {
          TransactionID: 'txn123',
          AccountID: '12345',
          Date: '2021-02-01T12:00:00Z',
          Amount: 150.00,
          Category: 'Utilities',
          Description: 'Updated electricity bill'
        }
      });
    });

    const event = {
      httpMethod: 'PUT',
      pathParameters: { id: 'txn123' },
      body: JSON.stringify({
        AccountID: '12345',
        Date: '2021-02-01T12:00:00Z',
        Amount: 150.00,
        Category: 'Utilities',
        Description: 'Updated electricity bill'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toEqual('Transaction updated successfully');
  });

  it('fails to update a transaction that does not exist or does not belong to the user', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
      const error = new Error('ConditionalCheckFailedException');
      error.code = 'ConditionalCheckFailedException';
      callback(error, null);
    });

    const event = {
      httpMethod: 'PUT',
      pathParameters: { id: 'txn125' },
      body: JSON.stringify({
        AccountID: '12345',
        Date: '2021-02-01T12:00:00Z',
        Amount: 150.00,
        Category: 'Utilities',
        Description: 'Another electricity bill'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user124' }  // Mismatched user
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toContain('Transaction not found or does not belong to the user');
  });
});


describe('deleteTransaction', () => {
  it('successfully deletes a transaction', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});  // Mock successful delete
    });

    const event = {
      httpMethod: 'DELETE',
      pathParameters: { id: 'txn123' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toEqual('Transaction deleted successfully');
  });

  it('fails to delete a transaction that does not exist or does not belong to the user', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      const error = new Error('ConditionalCheckFailedException');
      error.code = 'ConditionalCheckFailedException';
      callback(error, null);
    });

    const event = {
      httpMethod: 'DELETE',
      pathParameters: { id: 'txn126' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user124' }  // Mismatched user
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toContain('Transaction not found or does not belong to the user');
  });
});
