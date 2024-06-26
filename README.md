# Personal Finance App Backend

[![AWS SAM](https://img.shields.io/badge/AWS%20SAM-Deployed-brightgreen)](https://aws.amazon.com/serverless/sam/)
[![Node.js](https://img.shields.io/badge/Node.js-v14.x-blue)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust, serverless backend for a Personal Finance App, built with AWS SAM (Serverless Application Model). This application helps users manage their finances by tracking transactions, setting budgets, and achieving financial goals.

```
personal-finance-app/
│
├── src/
│   ├── user/
│   │   ├── index.js
│   │   └── index.test.js
│   ├── account/
│   │   ├── index.js
│   │   └── index.test.js
│   ├── transaction/
│   │   ├── index.js
│   │   └── index.test.js
│   ├── budget/
│   │   ├── index.js
│   │   └── index.test.js
│   ├── goal/
│   │   ├── index.js
│   │   └── index.test.js
│   ├── analytics/
│   │   ├── index.js
│   │   └── index.test.js
│   └── export/
│       ├── index.js
│       └── index.test.js
│
├── template.yaml
├── samconfig.toml
├── package.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

## Features

- User Authentication with Amazon Cognito
- CRUD operations for users, accounts, transactions, budgets, and financial goals
- Analytics for financial insights
- Data export functionality
- Serverless architecture for scalability and cost-efficiency

## Architecture

This application is built using a microservices architecture with AWS Lambda functions:

- User Service
- Account Service
- Transaction Service
- Budget Service
- Goal Service
- Analytics Service
- Export Service

Data is stored in Amazon DynamoDB, and the API is exposed through Amazon API Gateway.

## Prerequisites

- [AWS Account](https://aws.amazon.com/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate permissions
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- [Node.js](https://nodejs.org/) (v14.x or later)
- [npm](https://www.npmjs.com/)

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/luke-b/Personal-Finance-App-AWS-SAM-Backend.git
   cd Personal-Finance-App-AWS-SAM-Backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the SAM application:
   ```
   sam build
   ```

4. Deploy the application:
   ```
   sam deploy --guided
   ```
   Follow the prompts to configure your deployment.

5. After deployment, SAM will output the API Gateway endpoint URL. Save this for use in your frontend application.

## Running Tests

Run the test suite with:

```
npm test
```

## API Endpoints

- `POST /user`: Create a new user
- `GET /user/{id}`: Get user details
- `PUT /user/{id}`: Update user details
- `DELETE /user/{id}`: Delete a user

(Similar endpoints exist for accounts, transactions, budgets, and goals)

- `GET /analytics/summary`: Get financial analytics summary
- `GET /export`: Export user's financial data

For detailed API documentation, please refer to the [API Documentation](API_DOCS.md) file.

## Security

This application uses Amazon Cognito for user authentication. Make sure to include the appropriate authentication headers in your requests.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub issue tracker.

## Roadmap

- Implement multi-currency support
- Add support for recurring transactions
- Integrate with third-party financial services for automatic transaction imports

Thank you for using or contributing to the Personal Finance App Backend!

---

## GitHub Actions workflow does the following:

1. On every push to main and pull request to main, it runs the `build-and-test` job:
   - Sets up Node.js
   - Installs dependencies
   - Runs tests

2. If it's a push to the main branch, it runs the `deploy-dev` job:
   - Sets up Python and installs SAM CLI
   - Configures AWS credentials
   - Builds the SAM application using the `default` config
   - Deploys to the development environment

3. If the `deploy-dev` job succeeds, it runs the `deploy-prod` job:
   - Similar to `deploy-dev`, but uses the `prod` config
   - Deploys to the production environment

To use this workflow:

1. Add the `.github/workflows/sam-pipeline.yml` file to your repository.

2. In your GitHub repository settings, add the following secrets:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key ID
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

   Make sure these credentials have the necessary permissions to deploy your SAM application.

3. Optionally, create a `production` environment in your GitHub repository settings if you want to add approval steps or additional protection for production deployments.

This setup provides a continuous integration and deployment pipeline that automatically tests your changes, deploys to a development environment on every push to main, and then deploys to production if the development deployment is successful.

## Approval requirements for deploying to specific environments

GitHub's environment protection rules allow you to set up approval requirements for deploying to specific environments, like production. Here's how you can set up approval steps for your production deployment:

1. Create a Production Environment:
   - Go to your GitHub repository
   - Click on "Settings" > "Environments"
   - Click "New environment"
   - Name it "production" (to match the environment name in the GitHub Actions workflow)

2. Configure Protection Rules:
   - In the environment settings, enable "Required reviewers"
   - Add one or more people or teams who can approve production deployments
   - Optionally, you can also set up other protection rules like:
     - Wait timer (e.g., wait 10 minutes before allowing deployments)
     - Deployment branches (restrict which branches can deploy to this environment)

3. How It Works in the Workflow:
   - In our `sam-pipeline.yml`, the `deploy-prod` job has this line:
     ```yaml
     environment: production
     ```
   - This line associates the job with the "production" environment we just created

4. Deployment Process with Approvals:
   - When a push to main triggers the workflow, it will run `build-and-test` and `deploy-dev` as before
   - When it reaches the `deploy-prod` job, it will pause and wait for approval
   - Designated reviewers will receive a notification
   - They can go to the GitHub Actions page to review and approve the deployment
   - Once approved, the production deployment will proceed

5. Approval Interface:
   - Approvers can see the changes that are about to be deployed
   - They can leave comments or request changes
   - They can approve or reject the deployment

To make this process even more robust, you could:

1. Add more detailed environment-specific checks in your `deploy-prod` job.
2. Use GitHub environments to store environment-specific secrets.
3. Implement a ChatOps solution to manage approvals via Slack or Microsoft Teams.

Remember, while this adds a layer of protection, it's also important to have proper testing, staging environments, and rollback procedures in place for a comprehensive production deployment strategy.


---

# Personal Finance App API Documentation

This document provides detailed information about the API endpoints for the Personal Finance App backend.

## Base URL

All API requests should be prefixed with:

```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

Replace `{api-id}`, `{region}`, and `{stage}` with the appropriate values from your AWS deployment.

## Authentication

All endpoints require authentication. Include the following header in your requests:

```
Authorization: Bearer {id_token}
```

Where `{id_token}` is the ID token received from Amazon Cognito after successful authentication.

## Endpoints

### Users

#### Create a User

- **POST** `/user`
- **Body**:
  ```json
  {
    "Name": "John Doe",
    "Email": "john@example.com"
  }
  ```
- **Response**: 201 Created
  ```json
  {
    "message": "User created successfully",
    "user": {
      "UserID": "123e4567-e89b-12d3-a456-426614174000",
      "Name": "John Doe",
      "Email": "john@example.com"
    }
  }
  ```

#### Get User Details

- **GET** `/user/{id}`
- **Response**: 200 OK
  ```json
  {
    "UserID": "123e4567-e89b-12d3-a456-426614174000",
    "Name": "John Doe",
    "Email": "john@example.com"
  }
  ```

#### Update User

- **PUT** `/user/{id}`
- **Body**:
  ```json
  {
    "Name": "John Updated Doe",
    "Email": "john.updated@example.com"
  }
  ```
- **Response**: 200 OK
  ```json
  {
    "message": "User updated successfully",
    "user": {
      "UserID": "123e4567-e89b-12d3-a456-426614174000",
      "Name": "John Updated Doe",
      "Email": "john.updated@example.com"
    }
  }
  ```

#### Delete User

- **DELETE** `/user/{id}`
- **Response**: 200 OK
  ```json
  {
    "message": "User deleted successfully"
  }
  ```

### Accounts

#### Create an Account

- **POST** `/account`
- **Body**:
  ```json
  {
    "AccountName": "Savings Account",
    "Balance": 1000.00
  }
  ```
- **Response**: 201 Created
  ```json
  {
    "message": "Account created successfully",
    "account": {
      "AccountID": "234e5678-e89b-12d3-a456-426614174000",
      "AccountName": "Savings Account",
      "Balance": 1000.00
    }
  }
  ```

#### Get Account Details

- **GET** `/account/{id}`
- **Response**: 200 OK
  ```json
  {
    "AccountID": "234e5678-e89b-12d3-a456-426614174000",
    "AccountName": "Savings Account",
    "Balance": 1000.00
  }
  ```

#### Update Account

- **PUT** `/account/{id}`
- **Body**:
  ```json
  {
    "AccountName": "Updated Savings Account",
    "Balance": 1500.00
  }
  ```
- **Response**: 200 OK
  ```json
  {
    "message": "Account updated successfully",
    "account": {
      "AccountID": "234e5678-e89b-12d3-a456-426614174000",
      "AccountName": "Updated Savings Account",
      "Balance": 1500.00
    }
  }
  ```

#### Delete Account

- **DELETE** `/account/{id}`
- **Response**: 200 OK
  ```json
  {
    "message": "Account deleted successfully"
  }
  ```

### Transactions

#### Create a Transaction

- **POST** `/transaction`
- **Body**:
  ```json
  {
    "AccountID": "234e5678-e89b-12d3-a456-426614174000",
    "Amount": -50.00,
    "Category": "Groceries",
    "Description": "Weekly grocery shopping",
    "Date": "2023-06-22T10:30:00Z"
  }
  ```
- **Response**: 201 Created
  ```json
  {
    "message": "Transaction created successfully",
    "transaction": {
      "TransactionID": "345e6789-e89b-12d3-a456-426614174000",
      "AccountID": "234e5678-e89b-12d3-a456-426614174000",
      "Amount": -50.00,
      "Category": "Groceries",
      "Description": "Weekly grocery shopping",
      "Date": "2023-06-22T10:30:00Z"
    }
  }
  ```

#### Get Transaction Details

- **GET** `/transaction/{id}`
- **Response**: 200 OK
  ```json
  {
    "TransactionID": "345e6789-e89b-12d3-a456-426614174000",
    "AccountID": "234e5678-e89b-12d3-a456-426614174000",
    "Amount": -50.00,
    "Category": "Groceries",
    "Description": "Weekly grocery shopping",
    "Date": "2023-06-22T10:30:00Z"
  }
  ```

#### Update Transaction

- **PUT** `/transaction/{id}`
- **Body**:
  ```json
  {
    "Amount": -55.00,
    "Description": "Updated weekly grocery shopping"
  }
  ```
- **Response**: 200 OK
  ```json
  {
    "message": "Transaction updated successfully",
    "transaction": {
      "TransactionID": "345e6789-e89b-12d3-a456-426614174000",
      "AccountID": "234e5678-e89b-12d3-a456-426614174000",
      "Amount": -55.00,
      "Category": "Groceries",
      "Description": "Updated weekly grocery shopping",
      "Date": "2023-06-22T10:30:00Z"
    }
  }
  ```

#### Delete Transaction

- **DELETE** `/transaction/{id}`
- **Response**: 200 OK
  ```json
  {
    "message": "Transaction deleted successfully"
  }
  ```

### Budgets

(Similar CRUD operations as above)

### Goals

(Similar CRUD operations as above)

### Analytics

#### Get Financial Summary

- **GET** `/analytics/summary`
- **Response**: 200 OK
  ```json
  {
    "incomeVsExpenses": {
      "income": 5000.00,
      "expenses": 3000.00,
      "netIncome": 2000.00
    },
    "budgetProgress": [
      {
        "category": "Groceries",
        "limit": 500.00,
        "spent": 350.00,
        "remaining": 150.00,
        "percentUsed": 70
      }
    ],
    "goalProgress": [
      {
        "name": "Vacation Fund",
        "target": 2000.00,
        "current": 500.00,
        "remaining": 1500.00,
        "progress": 25
      }
    ],
    "topCategories": [
      {
        "category": "Groceries",
        "total": 350.00
      },
      {
        "category": "Utilities",
        "total": 200.00
      }
    ],
    "monthlyTrend": [
      {
        "month": "2023-05",
        "income": 4800.00,
        "expenses": 2900.00
      },
      {
        "month": "2023-06",
        "income": 5000.00,
        "expenses": 3000.00
      }
    ]
  }
  ```

### Export

#### Export Financial Data

- **GET** `/export`
- **Response**: 200 OK
  ```json
  {
    "message": "Export successful",
    "filename": "export_123e4567-e89b-12d3-a456-426614174000_2023-06-22T15:00:00Z.csv"
  }
  ```

## Error Responses

All endpoints may return the following error responses:

- 400 Bad Request: When the request is malformed or contains invalid data.
- 401 Unauthorized: When the authentication token is missing or invalid.
- 403 Forbidden: When the authenticated user doesn't have permission for the requested operation.
- 404 Not Found: When the requested resource doesn't exist.
- 500 Internal Server Error: When an unexpected error occurs on the server.

Error response body:

```json
{
  "message": "Error description"
}
```

## Rate Limiting

API requests are limited to 100 requests per minute per user. If you exceed this limit, you'll receive a 429 Too Many Requests response.

## Versioning

This API is currently at version 1.0. The version is included in the base URL. As the API evolves, we may introduce new versions to maintain backwards compatibility.

For any questions or issues regarding the API, please contact our support team or file an issue in our GitHub repository.

---

## TO-DO:

### Pre-processing and Post-processing Layers

#### Pre-processing Layer
This layer handles tasks that should occur before the main logic of the Lambda function is executed, such as:
- **Input Validation**
- **Authentication and Authorization**
- **Sanitization**

#### Post-processing Layer
This layer handles tasks that should occur after the main logic of the Lambda function is executed, such as:
- **Logging**
- **Response Formatting**
- **Error Handling**

### Implementing Pre-processing and Post-processing

Here’s how you can structure and implement these layers in your project.

#### Refactored Project Structure

```
personal-finance-app/
│
├── src/
│   ├── middlewares/
│   │   ├── preProcess.js
│   │   └── postProcess.js
│   ├── user/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── userService.js
│   │   ├── models/
│   │   │   └── userModel.js
│   │   └── utils/
│   │       └── userUtils.js
│   │
│   ├── account/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── accountService.js
│   │   ├── models/
│   │   │   └── accountModel.js
│   │   └── utils/
│   │       └── accountUtils.js
│   │
│   ├── transaction/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── transactionService.js
│   │   ├── models/
│   │   │   └── transactionModel.js
│   │   └── utils/
│   │       └── transactionUtils.js
│   │
│   ├── budget/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── budgetService.js
│   │   ├── models/
│   │   │   └── budgetModel.js
│   │   └── utils/
│   │       └── budgetUtils.js
│   │
│   ├── goal/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── goalService.js
│   │   ├── models/
│   │   │   └── goalModel.js
│   │   └── utils/
│   │       └── goalUtils.js
│   │
│   ├── analytics/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── analyticsService.js
│   │   ├── models/
│   │   │   └── analyticsModel.js
│   │   └── utils/
│   │       └── analyticsUtils.js
│   │
│   ├── export/
│   │   ├── handlers/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   └── exportService.js
│   │   ├── models/
│   │   │   └── exportModel.js
│   │   └── utils/
│   │       └── exportUtils.js
│   │
│   ├── utils/
│   │   └── commonUtils.js
│   └── middlewares/
│       ├── preProcess.js
│       └── postProcess.js
│
├── tests/
│   ├── user.test.js
│   ├── account.test.js
│   ├── transaction.test.js
│   ├── budget.test.js
│   ├── goal.test.js
│   ├── analytics.test.js
│   └── export.test.js
│
├── config/
│   ├── default.json
│   ├── production.json
│   └── development.json
│
├── .env
├── template.yaml
├── samconfig.toml
├── package.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

### Implementing Pre-processing and Post-processing Middleware

#### `preProcess.js`

```javascript
const Joi = require('joi');

const validateInput = (event, schema) => {
  const { error } = schema.validate(JSON.parse(event.body));
  if (error) {
    throw new Error(`Invalid input: ${error.details[0].message}`);
  }
};

const getUserId = (event) => {
  if (event.requestContext && 
      event.requestContext.authorizer && 
      event.requestContext.authorizer.claims && 
      event.requestContext.authorizer.claims.sub) {
    return event.requestContext.authorizer.claims.sub;
  }
  throw new Error('User ID not found in the event object');
};

module.exports = {
  validateInput,
  getUserId
};
```

#### `postProcess.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'generic-service' },
  transports: [
    new winston.transports.Console()
  ],
});

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const handleError = (error) => {
  logger.error('Error processing request', { error: error.message, stack: error.stack });
  return createResponse(500, { message: 'Internal server error' });
};

module.exports = {
  createResponse,
  handleError,
  logger
};
```

### Refactoring a Lambda Function to Use Middleware

#### `user/handlers/index.js`

```javascript
'use strict';

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validateInput, getUserId } = require('../../middlewares/preProcess');
const { createResponse, handleError, logger } = require('../../middlewares/postProcess');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.USER_TABLE;

// Validation schema for user data
const userSchema = Joi.object({
  Name: Joi.string().required(),
  Email: Joi.string().email().required()
});

const getUser = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId }
  };
  const result = await dynamodb.get(params).promise();
  if (!result.Item) {
    logger.warn('User not found', { userId });
    return createResponse(404, { message: 'User not found' });
  }
  logger.info('User retrieved', { userId });
  return createResponse(200, result.Item);
};

const createUser = async (userId, user) => {
  validateInput(user, userSchema);
  const newUser = {
    ...user,
    UserID: userId,
    CreatedAt: new Date().toISOString()
  };
  const params = {
    TableName: TABLE_NAME,
    Item: newUser,
    ConditionExpression: 'attribute_not_exists(UserID)'
  };
  try {
    await dynamodb.put(params).promise();
    logger.info('User created', { userId });
    return createResponse(201, { message: 'User created successfully', user: newUser });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('User already exists', { userId });
      return createResponse(409, { message: 'User already exists' });
    }
    throw error;
  }
};

const updateUser = async (userId, user) => {
  validateInput(user, userSchema);
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId },
    UpdateExpression: 'set #name = :name, Email = :email, UpdatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'Name'
    },
    ExpressionAttributeValues: {
      ':name': user.Name,
      ':email': user.Email,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };
  const result = await dynamodb.update(params).promise();
  logger.info('User updated', { userId });
  return createResponse(200, { message: 'User updated successfully', user: result.Attributes });
};

const deleteUser = async (userId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { UserID: userId

 }
  };
  await dynamodb.delete(params).promise();
  logger.info('User deleted', { userId });
  return createResponse(200, { message: 'User deleted successfully' });
};

exports.handler = async (event, context) => {
  logger.info('Received event', { 
    requestId: context.awsRequestId,
    event: JSON.stringify(event)
  });

  try {
    const userId = getUserId(event);
    const { httpMethod, body } = event;

    switch (httpMethod) {
      case 'GET':
        return await getUser(userId);
      case 'POST':
        return await createUser(userId, JSON.parse(body));
      case 'PUT':
        return await updateUser(userId, JSON.parse(body));
      case 'DELETE':
        return await deleteUser(userId);
      default:
        logger.warn('Unsupported HTTP method', { userId, method: httpMethod });
        return createResponse(400, { message: 'Unsupported HTTP method' });
    }
  } catch (error) {
    if (error.message === 'User ID not found in the event object') {
      logger.error('Unauthorized access attempt', { error: error.message });
      return createResponse(401, { message: 'Unauthorized' });
    }
    return handleError(error);
  }
};
```

By implementing pre-processing and post-processing layers, you centralize common logic and enhance the maintainability, readability, and scalability of your project. This approach ensures that cross-cutting concerns such as validation, logging, error handling, and response formatting are handled consistently across all Lambda functions.




