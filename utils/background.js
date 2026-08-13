// Deferred side effects (emails, push, notification writes) under serverless.
//
// On a long-lived server, `doThing().catch(...)` before res.json() finishes on its
// own — the process is still running. A Vercel lambda is frozen the instant the
// response is flushed, so the same call is simply abandoned mid-flight: the order
// saves and returns 201, but the confirmation email and the in-app notification
// never happen, with nothing in the logs to say so.
//
// waitUntil() asks the platform to keep the invocation alive until the promise
// settles, without holding up the response.

let waitUntil = null;
try {
    ({ waitUntil } = require('@vercel/functions'));
} catch (e) {
    // Not installed (trimmed install, or running outside Vercel) — the plain
    // fire-and-forget path below is correct for a long-lived process.
}

/**
 * Run best-effort work that must not block the response but must still complete.
 * @param {Promise|Function} work  A promise, or a function returning one.
 * @param {string} label           Shown in logs if the work throws.
 */
const runInBackground = (work, label = 'background task') => {
    const promise = Promise.resolve()
        .then(() => (typeof work === 'function' ? work() : work))
        .catch((err) => {
            // These were previously swallowed by `.catch(() => {})`, so a failing
            // email or push left no trace at all. Always leave a breadcrumb.
            console.error(`[background] ${label} failed:`, err?.message || err);
        });

    if (waitUntil && process.env.VERCEL) {
        try {
            waitUntil(promise);
        } catch (err) {
            // waitUntil throws if called outside a request context (e.g. cron boot).
            console.warn(`[background] waitUntil unavailable for ${label}:`, err?.message || err);
        }
    }

    return promise;
};

module.exports = { runInBackground };
