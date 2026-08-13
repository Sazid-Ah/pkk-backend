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
        
        connectionPromise = mongoose.connect(mongoUri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10,
            minPoolSize: 2,
        }).then((conn) => {
            connectionPromise = null;
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            return conn.connection;
        }).catch((error) => {
            connectionPromise = null;
            throw error;
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return await connectionPromise;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        console.error('Full error:', error);
        // Don't exit - let the app retry connection
        throw error;
    }
};

module.exports = connectDB;
