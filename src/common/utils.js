'use strict';

const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

// Function to generate a UUID
function generateUUID() {
    return uuidv4();
}

// Utility function to get environment variable or throw an error if not set
function getEnvVariable(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is not set`);
    }
    return value;
}

// Constants (these can be extended as needed)
const TABLE_NAME = getEnvVariable('USER_TABLE');
const TRANSACTION_TABLE = getEnvVariable('TRANSACTION_TABLE');
const BUDGET_TABLE = getEnvVariable('BUDGET_TABLE');
const GOAL_TABLE = getEnvVariable('GOAL_TABLE');
const AUDIT_TABLE = getEnvVariable('AUDIT_TABLE');
const EXPORT_BUCKET = getEnvVariable('EXPORT_BUCKET');
const STAGE = getEnvVariable('STAGE');

/**
 * Extracts the user ID from the Cognito authorizer context.
 *
 * @param {Object} event - The Lambda event object.
 * @returns {string} The user ID.
 * @throws {Error} If the user ID is not found in the event.
 */
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
    generateUUID,
    getEnvVariable,
    TABLE_NAME,
    TRANSACTION_TABLE,
    BUDGET_TABLE,
    GOAL_TABLE,
    AUDIT_TABLE,
    EXPORT_BUCKET,
    STAGE,
    getUserId,
    AWS,
};
