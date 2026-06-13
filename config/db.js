const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pkk_db';
        console.log('Connecting to MongoDB:', mongoUri.replace(/:[^:@]*@/, ':***@')); // Log URI without password
        
        const conn = await mongoose.connect(mongoUri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10,
            minPoolSize: 2,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        console.error('Full error:', error);
        // Don't exit - let the app retry connection
        throw error;
    }
};

module.exports = connectDB;
