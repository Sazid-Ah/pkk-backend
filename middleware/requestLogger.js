const fs = require('fs');
const path = require('path');

const requestLogger = (req, res, next) => {
    const startHrTime = process.hrtime();

    res.on('finish', () => {
        const elapsedHrTime = process.hrtime(startHrTime);
        const elapsedMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;

        const logRecord = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: elapsedMs.toFixed(3),
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user ? req.user._id : null,
        };

        const logLine = JSON.stringify(logRecord);

        if (process.env.REQUEST_LOG_TO_FILE === 'true') {
            const logDir = path.resolve(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logFile = path.join(logDir, 'requests.log');
            fs.appendFile(logFile, logLine + '\n', (err) => {
                if (err) {
                    console.error('Failed to write request log:', err);
                }
            });
        } else {
            console.log(logLine);
        }
    });

    next();
};

module.exports = requestLogger;
