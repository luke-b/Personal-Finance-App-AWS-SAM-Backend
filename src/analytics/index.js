/**

This analytics function provides a comprehensive summary of the user's financial data, including:

Income vs. Expenses analysis
Budget progress for each category
Progress towards financial goals
Top spending categories
Monthly income and expense trends

The function expects to be triggered by an HTTP GET request to the /analytics/summary endpoint. It retrieves data from the transaction, budget, and goal tables, performs the necessary calculations, and returns a JSON response with the analysis results.
Note that this implementation assumes that the necessary IAM permissions are set up for the Lambda function to access the DynamoDB tables. You'll need to ensure that the TRANSACTION_TABLE, BUDGET_TABLE, and GOAL_TABLE environment variables are correctly set in your SAM template.
Also, keep in mind that this implementation uses a scan operation on the DynamoDB tables, which can be inefficient for large datasets. For a production application with a large number of users and transactions, you might want to consider using more efficient querying methods or implementing pagination.

*/

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TRANSACTION_TABLE = process.env.TRANSACTION_TABLE;
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const GOAL_TABLE = process.env.GOAL_TABLE;

exports.handler = async (event) => {
    console.log('Event received', JSON.stringify(event, null, 2));

    const { httpMethod, path } = event;

    try {
        if (httpMethod === 'GET') {
            if (path === '/analytics/summary') {
                const transactions = await getAllItems(TRANSACTION_TABLE);
                const budgets = await getAllItems(BUDGET_TABLE);
                const goals = await getAllItems(GOAL_TABLE);

                const summary = {
                    incomeVsExpenses: analyzeIncomeVsExpenses(transactions),
                    budgetProgress: analyzeBudgetProgress(transactions, budgets),
                    goalProgress: analyzeGoalProgress(goals),
                    topCategories: analyzeTopCategories(transactions),
                    monthlyTrend: analyzeMonthlyTrend(transactions)
                };

                return response(200, summary);
            } else {
                return response(404, { message: 'Not found' });
            }
        } else {
            return response(400, { message: 'Unsupported HTTP method' });
        }
    } catch (error) {
        console.error('Error', error);
        return response(500, { message: 'Internal server error' });
    }
};

async function getAllItems(tableName) {
    const params = { TableName: tableName };
    const result = await dynamodb.scan(params).promise();
    return result.Items;
}

function analyzeIncomeVsExpenses(transactions) {
    const income = transactions.filter(t => t.Amount > 0).reduce((sum, t) => sum + t.Amount, 0);
    const expenses = transactions.filter(t => t.Amount < 0).reduce((sum, t) => sum + Math.abs(t.Amount), 0);
    return { income, expenses, netIncome: income - expenses };
}

function analyzeBudgetProgress(transactions, budgets) {
    return budgets.map(budget => {
        const spent = transactions
            .filter(t => t.Category === budget.Category && t.Amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.Amount), 0);
        return {
            category: budget.Category,
            limit: budget.Amount,
            spent,
            remaining: budget.Amount - spent,
            percentUsed: (spent / budget.Amount) * 100
        };
    });
}

function analyzeGoalProgress(goals) {
    return goals.map(goal => ({
        name: goal.GoalName,
        target: goal.TargetAmount,
        current: goal.CurrentAmount,
        remaining: goal.TargetAmount - goal.CurrentAmount,
        progress: (goal.CurrentAmount / goal.TargetAmount) * 100
    }));
}

function analyzeTopCategories(transactions) {
    const categoryTotals = transactions.reduce((totals, t) => {
        if (!totals[t.Category]) totals[t.Category] = 0;
        totals[t.Category] += Math.abs(t.Amount);
        return totals;
    }, {});

    return Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, total]) => ({ category, total }));
}

function analyzeMonthlyTrend(transactions) {
    const monthlyTotals = transactions.reduce((totals, t) => {
        const date = new Date(t.Date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!totals[monthYear]) totals[monthYear] = { income: 0, expenses: 0 };
        if (t.Amount > 0) totals[monthYear].income += t.Amount;
        else totals[monthYear].expenses += Math.abs(t.Amount);
        return totals;
    }, {});

    return Object.entries(monthlyTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, { income, expenses }]) => ({ month, income, expenses }));
}

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(body),
    };
}
