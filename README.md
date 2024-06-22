# Personal Finance App AWS SAM Backend

Project structure for the Personal Finance App backend. This structure is designed to be ready for deployment using AWS SAM.

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

This structure encompasses all the required components:

1. Separate Lambda functions for each main entity (user, account, transaction, budget, goal) and additional functions for analytics and data export.
2. Each Lambda function has its own directory with an `index.js` file for the main logic and an `index.test.js` file for unit tests.
3. The `template.yaml` file at the root defines the SAM template for deploying all resources.
4. The `samconfig.toml` file contains SAM CLI deployment configurations.
5. The `package.json` file manages npm dependencies and scripts.
6. README.md, CONTRIBUTING.md, and LICENSE files for project documentation.
7. A .gitignore file for version control.

Structure ready for implementing the code:

- CRUD operations for each entity
- Authentication using Amazon Cognito
- Analytics functionality
- Data export to S3
- Input validation using Joi
- Error handling and logging
- Unit tests for each function

Deployment procedure:

1. Implement the code for each Lambda function in their respective `index.js` files.
2. Write unit tests in the corresponding `index.test.js` files.
3. Configure the `template.yaml` file with all necessary AWS resources.
4. Set up the `samconfig.toml` file with deployment parameters.
5. Install dependencies and run tests:
   ```
   npm install
   npm test
   ```
6. Build and deploy the application:
   ```
   sam build
   sam deploy --guided
   ```

