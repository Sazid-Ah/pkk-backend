const asyncHandler = require('express-async-handler');
const DeletionRequest = require('../models/DeletionRequest');
const User = require('../models/User');
const DeletedUser = require('../models/DeletedUser');
const { logActivity } = require('./activityLogController');

const getDeletionRequests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;
    const query = {};

    if (status) query.status = status;
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { email: searchRegex },
            { reason: searchRegex },
        ];
    }

    const [requests, total] = await Promise.all([
        DeletionRequest.find(query)
            .sort({ requestedAt: -1 })
            .skip(parseInt(skip, 10))
            .limit(parseInt(limit, 10))
            .populate('user', 'username email role phoneNumber'),
        DeletionRequest.countDocuments(query),
    ]);

    res.status(200).json({
        success: true,
        data: requests,
        total,
        pages: Math.ceil(total / limit),
        page: parseInt(page, 10),
    });
});

const approveDeletionRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await DeletionRequest.findById(id);

    if (!request) {
        res.status(404);
        throw new Error('Deletion request not found');
    }

    if (request.status !== 'pending') {
        res.status(400);
        throw new Error('Only pending requests can be approved');
    }

    const user = await User.findById(request.user);

    if (user) {
        await DeletedUser.create({
            originalUser: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phoneNumber: user.phoneNumber,
            avatar: user.avatar,
            userSnapshot: user.toObject(),
            deletedAt: new Date(),
            deletedBy: req.user._id,
            reason: request.reason || 'Approved deletion request',
        });

        await User.deleteOne({ _id: user._id });
    }

    request.status = 'completed';
    request.completedAt = new Date();
    request.handledBy = req.user._id;
    await request.save();

    await logActivity(
        req.user._id,
        req.user.role === 'admin' ? 'Administrator' : 'Employee',
        req.user.username,
        req.user.email || '',
        req.user.role || 'staff',
        'deletion_request_approved',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        request._id,
        `Deletion request for ${request.email} approved`
    );

    res.status(200).json({ success: true, data: request });
});

const cancelDeletionRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await DeletionRequest.findById(id);

    if (!request) {
        res.status(404);
        throw new Error('Deletion request not found');
    }

    if (request.status !== 'pending') {
        res.status(400);
        throw new Error('Only pending requests can be cancelled');
    }

    const user = await User.findById(request.user);
    if (user) {
        user.isDeletionPending = false;
        user.deletionRequestedAt = undefined;
        await user.save();
    }

    request.status = 'cancelled';
    request.completedAt = new Date();
    request.handledBy = req.user._id;
    await request.save();

    await logActivity(
        req.user._id,
        req.user.role === 'admin' ? 'Administrator' : 'Employee',
        req.user.username,
        req.user.email || '',
        req.user.role || 'staff',
        'deletion_request_cancelled',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        request._id,
        `Deletion request for ${request.email} cancelled`
    );

    res.status(200).json({ success: true, data: request });
});

module.exports = {
    getDeletionRequests,
    approveDeletionRequest,
    cancelDeletionRequest,
};
