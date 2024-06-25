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
