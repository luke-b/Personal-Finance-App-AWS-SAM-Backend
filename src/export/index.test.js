/**

This test file covers several key aspects of the export function:

It tests the successful export of transactions, verifying that:

The correct status code and message are returned
The filename is generated correctly
The DynamoDB scan is called with the correct parameters
The S3 putObject is called with the correct parameters


It tests error handling, ensuring that when an error occurs, the function returns the appropriate error response.
It tests the CSV conversion, verifying that the transactions are correctly converted to CSV format.

The test file uses Jest's mocking capabilities to mock the AWS SDK, allowing us to test the function without actually interacting with AWS services. It also sets up environment variables to mimic the Lambda environment.

*/

const AWS = require('aws-sdk');
const { handler } = require('./index');

jest.mock('aws-sdk');

describe('Export Lambda Function', () => {
    let mockS3;
    let mockDynamoDB;

    beforeEach(() => {
        mockS3 = {
            putObject: jest.fn().mockReturnThis(),
            promise: jest.fn().mockResolvedValue({})
        };
        mockDynamoDB = {
            scan: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };

        AWS.S3.mockImplementation(() => mockS3);
        AWS.DynamoDB.DocumentClient.mockImplementation(() => mockDynamoDB);

        process.env.TRANSACTION_TABLE = 'test-transaction-table';
        process.env.EXPORT_BUCKET = 'test-export-bucket';
    });

    it('should export transactions successfully', async () => {
        const mockTransactions = [
            { Date: '2023-01-01', Amount: 100, Category: 'Income', Description: 'Salary' },
            { Date: '2023-01-02', Amount: -50, Category: 'Food', Description: 'Groceries' }
        ];

        mockDynamoDB.promise.mockResolvedValue({ Items: mockTransactions });

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
        expect(JSON.parse(result.body).message).toBe('Export successful');
        expect(JSON.parse(result.body).filename).toMatch(/^export_user123_.*\.csv$/);

        expect(mockDynamoDB.scan).toHaveBeenCalledWith({
            TableName: 'test-transaction-table',
            FilterExpression: 'UserID = :userId',
            ExpressionAttributeValues: { ':userId': 'user123' }
        });

        expect(mockS3.putObject).toHaveBeenCalledWith(expect.objectContaining({
            Bucket: 'test-export-bucket',
            ContentType: 'text/csv',
            Body: expect.stringContaining('Date,Amount,Category,Description')
        }));
    });

    it('should handle errors gracefully', async () => {
        mockDynamoDB.promise.mockRejectedValue(new Error('Database error'));

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

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message).toBe('Internal server error');
    });

    it('should convert transactions to CSV correctly', async () => {
        const mockTransactions = [
            { Date: '2023-01-01', Amount: 100, Category: 'Income', Description: 'Salary' },
            { Date: '2023-01-02', Amount: -50, Category: 'Food', Description: 'Groceries' }
        ];

        mockDynamoDB.promise.mockResolvedValue({ Items: mockTransactions });

        const event = {
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user123'
                    }
                }
            }
        };

        await handler(event);

        const expectedCSV = 'Date,Amount,Category,Description\n2023-01-01,100,Income,Salary\n2023-01-02,-50,Food,Groceries';

        expect(mockS3.putObject).toHaveBeenCalledWith(expect.objectContaining({
            Body: expectedCSV
        }));
    });
});
