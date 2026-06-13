const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            let user = await User.findById(decoded.id).select('-password');

            if (!user) {
                const Employee = require('../models/Employee');
                user = await Employee.findById(decoded.id).select('-password');
            }

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
        res.status(401);
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
        res.status(401);
        throw new Error('Not authorized as a pandit');
    }
};

module.exports = { protect, admin, employee, pandit };
