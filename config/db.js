const mongoose = require('mongoose');

let connectionPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pkk_db';
        console.log('Connecting to MongoDB:', mongoUri.replace(/:[^:@]*@/, ':***@')); // Log URI without password
        
        // Serverless: every cold lambda opens its own pool, so keep it small and
        // let it drain to zero rather than holding idle sockets against the Atlas cap.
        connectionPromise = mongoose.connect(mongoUri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 0,
        }).then((conn) => {
            connectionPromise = null;
            console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
            return conn.connection;
        }).catch((error) => {
            connectionPromise = null;
            throw error;
        });

        return await connectionPromise;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        console.error('Full error:', error);
        // Don't exit - let the app retry connection
        throw error;
    }
};

module.exports = connectDB;
