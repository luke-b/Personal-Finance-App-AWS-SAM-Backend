const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index');  

AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore('DynamoDB.DocumentClient');
  process.env.USER_TABLE = 'Users';
});

afterAll(() => {
  AWSMock.restore();
});

describe('User Service Lambda Function', () => {
  // Mock environment setup for user ID extraction
  const mockEvent = (httpMethod, userId, body) => ({
    httpMethod,
    body: body ? JSON.stringify(body) : null,
    requestContext: {
      authorizer: {
        claims: {
          sub: userId
        }
      }
    }
  });

  // Test case for getting a user
  describe('getUser', () => {
    it('retrieves a user successfully', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
        callback(null, {
          Item: {
            UserID: 'user123',
            Name: 'Test User',
            Email: 'test@example.com'
          }
        });
      });

      const event = mockEvent('GET', 'user123');
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).Name).toEqual('Test User');
    });

    it('returns 404 when user not found', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
        callback(null, {});
      });

      const event = mockEvent('GET', 'nonexistent');
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).message).toEqual('User not found');
    });
  });

  // Test case for creating a user
  describe('createUser', () => {
    it('creates a user successfully', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        callback(null, {});
      });

      const event = mockEvent('POST', 'user123', {
        Name: 'New User',
        Email: 'newuser@example.com'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body).message).toEqual('User created successfully');
    });

    it('returns 400 for invalid input', async () => {
      const event = mockEvent('POST', 'user123', {
        Name: '',
        Email: 'invalid-email'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
    });

    it('returns 409 if user already exists', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
        const error = new Error('ConditionalCheckFailedException');
        error.code = 'ConditionalCheckFailedException';
        callback(error);
      });

      const event = mockEvent('POST', 'user123', {
        Name: 'Existing User',
        Email: 'existing@example.com'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(409);
      expect(JSON.parse(result.body).message).toEqual('User already exists');
    });
  });

  // Test case for updating a user
  describe('updateUser', () => {
    it('updates a user successfully', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
        callback(null, {
          Attributes: {
            UserID: 'user123',
            Name: 'Updated User',
            Email: 'updated@example.com'
          }
        });
      });

      const event = mockEvent('PUT', 'user123', {
        Name: 'Updated User',
        Email: 'updated@example.com'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toEqual('User updated successfully');
    });

    it('returns 400 for invalid input', async () => {
      const event = mockEvent('PUT', 'user123', {
        Name: '',
        Email: 'invalid-email'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
    });
  });

  // Test case for deleting a user
  describe('deleteUser', () => {
    it('deletes a user successfully', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
        callback(null, {});
      });

      const event = mockEvent('DELETE', 'user123');
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toEqual('User deleted successfully');
    });
  });

  // Test for unauthorized access
  describe('Unauthorized Access', () => {
    it('returns 401 for unauthorized access', async () => {
      const event = {
        httpMethod: 'GET',
        requestContext: {}
      };
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toEqual('Unauthorized');
    });
  });

  // Test for unsupported HTTP methods
  describe('HTTP Method Handling', () => {
    it('returns 400 for unsupported HTTP methods', async () => {
      const event = mockEvent('PATCH', 'user123');
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).message).toEqual('Unsupported HTTP method');
    });
  });

  // Test error handling
  describe('Error Handling', () => {
    it('handles DynamoDB service errors', async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'update', (params, callback) => {
        callback(new Error('Internal server error'), null);
      });

      const event = mockEvent('PUT', 'user123', {
        Name: 'Test User',
        Email: 'test@example.com'
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toEqual('Internal server error');
    });
  });
});
