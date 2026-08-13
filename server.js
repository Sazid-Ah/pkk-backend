const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const { startCronJobs } = require('./utils/cron');

dotenv.config();

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = ['MONGO_URI', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}
// Email transport: Resend (HTTP) OR SMTP creds. Not fatal — email is best-effort —
// but warn loudly so a misconfig is obvious (esp. on Cloud Run where SMTP is blocked).
if (!process.env.RESEND_API_KEY && !(process.env.SMTP_USER && process.env.SMTP_PASSWORD)) {
    console.warn('⚠️  No email transport configured — set RESEND_API_KEY (recommended on Cloud Run) or SMTP_USER/SMTP_PASSWORD. Emails will fail until then.');
}

const port = process.env.PORT || 8080;

console.log('🚀 Starting Pandit Katha Kalyan Backend...');
console.log('Environment:', process.env.NODE_ENV || 'development');

const app = express();
app.set('trust proxy', 1);

// Health check endpoint - responds immediately for hosting platforms (e.g. Render, Cloud Run)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
    if (require('mongoose').connection.readyState === 1) {
        res.status(200).json({ status: 'ready', db: 'connected' });
    } else {
        res.status(200).json({ status: 'ready', db: 'pending' });
    }
});

// Load middlewares
let globalLimiter;
try {
    const { globalLimiter: limiter } = require('./middleware/rateLimiter');
    globalLimiter = limiter;
    console.log('✓ Rate limiter loaded');
} catch (error) {
    console.error('❌ Failed to load rate limiter:', error.message);
    // Continue without rate limiter rather than crashing
}

app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const corsOrigin = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : (process.env.NODE_ENV === 'production' ? false : true);
if (!process.env.ALLOWED_ORIGINS) {
    console.warn('⚠️  CORS wildcard active — set ALLOWED_ORIGINS in production');
}

// CORS configuration
const corsOptions = {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Note: app.use(cors()) already handles preflight OPTIONS requests globally
if (globalLimiter) {
    app.use(globalLimiter);
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Prevent NoSQL injection — sanitize body and params only.
// req.query is a read-only getter in Node 18+ / Express 4.18+; calling
// express-mongo-sanitize() as a middleware would throw
// "Cannot set property query of #<IncomingMessage> which has only a getter".
try {
    const mongoSanitize = require('express-mongo-sanitize');
    app.use((req, _res, next) => {
        if (req.body) req.body = mongoSanitize.sanitize(req.body);
        if (req.params) req.params = mongoSanitize.sanitize(req.params);
        next();
    });
} catch (e) {
    console.warn('⚠️  express-mongo-sanitize not installed:', e.message);
}

app.use(requestLogger);

// Static route loaders let Vercel trace and bundle every route module.
const routeLoaders = {
    './routes/authRoutes': () => require('./routes/authRoutes'),
    './routes/activityRoutes': () => require('./routes/activityRoutes'),
    './routes/panditRoutes': () => require('./routes/panditRoutes'),
    './routes/productRoutes': () => require('./routes/productRoutes'),
    './routes/categoryRoutes': () => require('./routes/categoryRoutes'),
    './routes/orderRoutes': () => require('./routes/orderRoutes'),
    './routes/employeeRoutes': () => require('./routes/employeeRoutes'),
    './routes/occasionRoutes': () => require('./routes/occasionRoutes'),
    './routes/bookingRoutes': () => require('./routes/bookingRoutes'),
    './routes/uploadRoutes': () => require('./routes/uploadRoutes'),
    './routes/analyticsRoutes': () => require('./routes/analyticsRoutes'),
    './routes/settingsRoutes': () => require('./routes/settingsRoutes'),
    './routes/globalSettingsRoutes': () => require('./routes/globalSettingsRoutes'),
    './routes/promotionRoutes': () => require('./routes/promotionRoutes'),
    './routes/wishlistRoutes': () => require('./routes/wishlistRoutes'),
    './routes/panditApplicationRoutes': () => require('./routes/panditApplicationRoutes'),
    './routes/reviewRoutes': () => require('./routes/reviewRoutes'),
    './routes/contactRoutes': () => require('./routes/contactRoutes'),
    './routes/deletionRequestRoutes': () => require('./routes/deletionRequestRoutes'),
    './routes/notificationRoutes': () => require('./routes/notificationRoutes'),
    './routes/setupRoutes': () => require('./routes/setupRoutes'),
};

// Load routes with error handling
const routes = [
    { path: '/api/auth', file: './routes/authRoutes' },
    { path: '/api/activity-logs', file: './routes/activityRoutes' },
    { path: '/api/pandits', file: './routes/panditRoutes' },
    { path: '/api/products', file: './routes/productRoutes' },
    { path: '/api/categories', file: './routes/categoryRoutes' },
    { path: '/api/orders', file: './routes/orderRoutes' },
    { path: '/api/employees', file: './routes/employeeRoutes' },
    { path: '/api/occasions', file: './routes/occasionRoutes' },
    { path: '/api/bookings', file: './routes/bookingRoutes' },
    { path: '/api/upload', file: './routes/uploadRoutes' },
    { path: '/api/analytics', file: './routes/analyticsRoutes' },
    { path: '/api/settings', file: './routes/settingsRoutes' },
    { path: '/api/global-settings', file: './routes/globalSettingsRoutes' },
    { path: '/api/promotions', file: './routes/promotionRoutes' },
    { path: '/api/wishlist', file: './routes/wishlistRoutes' },
    { path: '/api/pandit-applications', file: './routes/panditApplicationRoutes' },
    { path: '/api/reviews', file: './routes/reviewRoutes' },
    { path: '/api/contact', file: './routes/contactRoutes' },
    { path: '/api/deletion-requests', file: './routes/deletionRequestRoutes' },
    { path: '/api/notifications', file: './routes/notificationRoutes' },
    { path: '/api/setup', file: './routes/setupRoutes' },
];

for (const route of routes) {
    try {
        console.log(`Loading route: ${route.path} from ${route.file}...`);
        const routeModule = routeLoaders[route.file]();
        app.use(route.path, routeModule);
        console.log(`✓ Route loaded: ${route.path}`);
    } catch (error) {
        console.error(`❌ Failed to load route ${route.path}:`, error.message);
        console.error(`Full error for ${route.path}:`, error);
        // Continue loading other routes instead of crashing
    }
}

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
    res.json({ message: 'Pandit Katha Kalyan Backend is running' });
});

app.use((err, req, res, next) => {
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    console.error('[GlobalError]', {
        statusCode,
        message: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
        body: req.body,
    });
    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

// Export app for Vercel/serverless environments
module.exports = app;

// Initialize database and services asynchronously (non-blocking)
// This allows Vercel serverless to respond to requests immediately
let dbInitialized = false;

async function initializeServices() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await connectDB();
        dbInitialized = true;
        console.log('✅ Database connection established');
        
        try {
            const { ensureAdminExists } = require('./config/adminSeed');
            await ensureAdminExists();
        } catch (adminErr) {
            console.error('❌ Failed to run ensureAdminExists:', adminErr.message);
        }
    } catch (error) {
        console.error('⚠️  Database connection failed:', error.message);
        // Don't exit - allow requests to proceed without DB
    }

    // Start cron jobs only if DB is connected
    if (dbInitialized) {
        try {
            startCronJobs();
            console.log('✅ Cron jobs started');
        } catch (cronErr) {
            console.error('⚠️  Failed to start cron jobs:', cronErr.message);
        }
    }

    // Email transport verification
    try {
        require('./utils/emailService').verifyEmailTransport();
    } catch (e) {
        console.error('Email transport check failed:', e.message);
    }
}

// Start initialization in background - don't wait
initializeServices().catch(err => {
    console.error('❌ Service initialization error:', err);
});

// Only start listening if not in serverless environment (Vercel, etc.)
if (require.main === module) {
    console.log(`📡 Attempting to listen on port ${port}...`);
    const server = app.listen(port, () => {
        console.log(`✅ Server is listening on port ${port}`);
    });

    // Set server timeout to 2 minutes
    server.setTimeout(120000);

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('⚠️  SIGTERM received, shutting down gracefully');
        server.close(async () => {
            console.log('🛑 Server closed');
            try {
                await require('mongoose').disconnect();
                console.log('🛑 MongoDB disconnected');
            } catch (e) {
                console.error('Error disconnecting MongoDB:', e.message);
            }
            process.exit(0);
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('💥 Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    });
}
