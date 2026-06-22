const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Configure VAPID once at startup. If keys are absent every function below
// no-ops, so the app runs fine without Web Push configured.
let configured = false;
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@panditkathakalyan.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (e) {
    console.warn('Web Push VAPID setup failed:', e.message);
  }
}

const isConfigured = () => configured;

// Upsert a subscription (idempotent on endpoint).
async function saveSubscription(userId, sub) {
  if (!sub || !sub.endpoint) return;
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { user: userId, endpoint: sub.endpoint, keys: sub.keys || {} },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await PushSubscription.deleteOne({ endpoint });
}

// Fan out a push to every device a user has subscribed. Dead subscriptions
// (404/410) are pruned. Best-effort — never throws.
async function sendPush(userId, payload) {
  if (!configured || !userId) return;
  let subs = [];
  try {
    subs = await PushSubscription.find({ user: userId });
  } catch { return; }
  if (!subs.length) return;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
      }
    }
  }));
}

module.exports = { isConfigured, saveSubscription, removeSubscription, sendPush };
