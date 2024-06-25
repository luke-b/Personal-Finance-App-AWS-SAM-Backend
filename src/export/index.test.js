const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const { handler } = require('./index'); 

AWSMock.setSDKInstance(AWS);

beforeEach(() => {
  AWSMock.restore(); // Reset mocks before each test
  process.env.TRANSACTION_TABLE = 'Transactions';
  process.env.EXPORT_BUCKET = 'ExportBucket';
});

afterAll(() => {
  AWSMock.restore(); // Clean up mocks after all tests
});


describe('getAllTransactions', () => {
  it('retrieves transactions successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
      callback(null, { Items: [{ Date: '2021-01-01', Amount: 100, Category: 'Food', Description: 'Lunch' }] });
    });

    const transactions = await getAllTransactions('user123');
    expect(transactions).toEqual([{ Date: '2021-01-01', Amount: 100, Category: 'Food', Description: 'Lunch' }]);
  });
});


describe('convertToCSV', () => {
  it('converts transaction data to CSV format', () => {
    const transactions = [{ Date: '2021-01-01', Amount: 100, Category: 'Food', Description: 'Lunch' }];
    const csv = convertToCSV(transactions);
    expect(csv).toBe('Date,Amount,Category,Description\n2021-01-01,100,Food,Lunch');
  });
});


describe('uploadToS3', () => {
  it('uploads data to S3 successfully', async () => {
    AWSMock.mock('S3', 'putObject', (params, callback) => {
      callback(null, { ETag: '"abcdef1234567890"' }); // Mock successful upload
    });

    const result = await uploadToS3('data', 'filename.csv');
    expect(result).toHaveProperty('ETag');
  });
});


describe('handler', () => {
  it('handles the export process successfully', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
      callback(null, { Items: [{ Date: '2021-01-01', Amount: 100, Category: 'Food', Description: 'Lunch' }] });
    });
    AWSMock.mock('S3', 'putObject', (params, callback) => {
      callback(null, { ETag: '"abcdef1234567890"' });
    });

    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123'
          }
        }
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toEqual('Export successful');
  });

  it('returns an error if no transactions are found', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
      callback(null, { Items: [] });
    });

    const event = {
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
    expect(JSON.parse(result.body).message).toEqual('No transactions found');
  });
});
