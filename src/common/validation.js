'use strict';

const Joi = require('joi');

// Account Schema
const accountSchema = Joi.object({
    AccountName: Joi.string().required().max(100),
    Balance: Joi.number().required().precision(2),
    Type: Joi.string().valid('Checking', 'Savings', 'Credit Card', 'Investment').required()
});

// Budget Schema
const budgetSchema = Joi.object({
    Category: Joi.string().required(),
    Amount: Joi.number().positive().required(),
    Period: Joi.string().valid('weekly', 'monthly', 'yearly').required()
});

// Goal Schema
const goalSchema = Joi.object({
    GoalName: Joi.string().required(),
    TargetAmount: Joi.number().positive().required(),
    CurrentAmount: Joi.number().min(0).required(),
    Deadline: Joi.date().iso().required()
});

// Transaction Schema
const transactionSchema = Joi.object({
    AccountID: Joi.string().required(),
    Date: Joi.date().iso().required(),
    Amount: Joi.number().required(),
    Category: Joi.string().required(),
    Description: Joi.string().allow('').optional()
});

// User Schema
const userSchema = Joi.object({
    Name: Joi.string().required(),
    Email: Joi.string().email().required()
});

module.exports = {
    accountSchema,
    budgetSchema,
    goalSchema,
    transactionSchema,
    userSchema
};
