const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
// Employee will be required inside the function to ensure it's loaded

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'abc123456');

            // Try User first
            let user = await User.findById(decoded.id).select('-password');

            // If not found, try Employee
            if (!user) {
                const Employee = require('../models/Employee');
                user = await Employee.findById(decoded.id).select('-password');
            }

            // If not found, try Pandit
            if (!user) {
                const Pandit = require('../models/Pandit');
                user = await Pandit.findById(decoded.id).select('-password');
            }

            if (!user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }

            req.user = user;

            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            throw new Error('Not authorized');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as an admin');
    }
};

const employee = (req, res, next) => {
    if (req.user && (req.user.role === 'employee' || req.user.role === 'staff' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(401);
        throw new Error('Not authorized as an employee');
    }
};

const pandit = (req, res, next) => {
    if (req.user && (req.user.role === 'pandit' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as a pandit');
    }
};

// Allows both admin and employee roles (used for shared routes like GET /orders)
const adminOrEmployee = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'employee' || req.user.role === 'staff')) {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized');
    }
};

module.exports = { protect, admin, employee, pandit, adminOrEmployee };
