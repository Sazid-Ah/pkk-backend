const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const { saveSubscription, removeSubscription } = require('../utils/pushService');

const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ notifications, unreadCount });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  notification.read = true;
  await notification.save();
  res.json({ success: true });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});

// @desc    Save a Web Push subscription for the logged-in user
// @route   POST /api/notifications/push/subscribe
const subscribePush = asyncHandler(async (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    res.status(400);
    throw new Error('Invalid push subscription');
  }
  await saveSubscription(req.user._id, sub);
  res.status(201).json({ success: true });
});

// @desc    Remove a Web Push subscription
// @route   POST /api/notifications/push/unsubscribe
const unsubscribePush = asyncHandler(async (req, res) => {
  await removeSubscription(req.body && req.body.endpoint);
  res.json({ success: true });
});

module.exports = { getNotifications, markRead, markAllRead, subscribePush, unsubscribePush };
