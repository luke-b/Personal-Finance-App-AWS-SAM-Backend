'use strict';

const winston = require('winston');

function createLogger(serviceName) {
    return winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        defaultMeta: { service: serviceName },
        transports: [
            new winston.transports.Console()
        ],
    });
}

module.exports = createLogger;
