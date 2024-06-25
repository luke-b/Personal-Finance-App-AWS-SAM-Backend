const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index');  

// Setting up the AWS SDK DynamoDB DocumentClient mock
AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore('DynamoDB.DocumentClient');
  process.env.ACCOUNT_TABLE = 'Accounts';
  process.env.AUDIT_TABLE = 'Audit';
});

afterAll(() => {
  AWSMock.restore();
});

describe('createAccount', () => {
  it('successfully creates an account', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        AccountName: 'Test Account',
        Balance: 100.50,
        Type: 'Savings'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).message).toEqual('Account created successfully');
  });

  it('fails to create an account with invalid data', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        AccountName: '',
        Balance: -100,
        Type: 'InvalidType'
      }),
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});


describe('getAccount', () => {
  it('retrieves a specific account successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {
        Item: {
          AccountID: 'account123',
          AccountName: 'Existing Account',
          Balance: 500,
          Type: 'Checking',
          IsActive: true
        }
      });
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'account123' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).AccountName).toEqual('Existing Account');
  });

  it('fails to retrieve a non-existent account', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'nonexistent' },
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});


describe('HTTP Method Handling', () => {
  it('rejects unsupported HTTP methods', async () => {
    const event = {
      httpMethod: 'PATCH',
      requestContext: {
        authorizer: {
          claims: { sub: 'user123' }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toEqual('Unsupported HTTP method');
  });
});

describe('Unauthorized Access', () => {
  it('rejects unauthorized access', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { id: 'account123' }
      // Missing authorization context
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toEqual('Unauthorized');
  });
});


