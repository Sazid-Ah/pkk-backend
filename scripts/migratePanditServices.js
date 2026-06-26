// One-off, idempotent migration: backfill the per-occasion `services` array for
// pandits created before per-service pricing existed. Each existing occasion gets
// a service row priced at the pandit's current single price (priceMin, falling
// back to the first number parsed from the `price` string), carrying over `mrp`.
//
// Usage: node scripts/migratePanditServices.js
require('dotenv').config();
const mongoose = require('mongoose');
const Pandit = require('../models/Pandit');

// Parse the first positive number out of a price string like "₹2000-5000".
function parseFirstPrice(priceStr) {
    if (!priceStr) return null;
    const digits = String(priceStr).replace(/[^\d\-]/g, '');
    const parts = digits.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
    return parts.length ? parts[0] : null;
}

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const pandits = await Pandit.find({});
        let migrated = 0;
        let skipped = 0;

        for (const p of pandits) {
            // Already has per-service pricing — leave it alone.
            if (Array.isArray(p.services) && p.services.length > 0) {
                skipped++;
                continue;
            }

            const basePrice = p.priceMin || parseFirstPrice(p.price);
            const occasions = Array.isArray(p.occasions) ? p.occasions : [];

            if (!basePrice || occasions.length === 0) {
                // Nothing reliable to migrate (no price or no occasions). Skip;
                // the legacy single-price + free-text-occasion flow still works.
                skipped++;
                continue;
            }

            p.services = occasions.map((occ) => ({
                occasion: occ,
                price: basePrice,
                mrp: p.mrp && p.mrp > basePrice ? p.mrp : null,
            }));
            // Re-derive the display fields from the new services.
            const prices = p.services.map((s) => s.price);
            p.priceMin = Math.min(...prices);
            p.priceMax = Math.max(...prices);
            p.price = `₹${p.priceMin}`;
            p.mrp = null; // discounts now live per service

            await p.save();
            migrated++;
            console.log(`  ✓ ${p.name} — ${p.services.length} service(s) @ ₹${basePrice}`);
        }

        console.log(`\nMigration complete. Migrated: ${migrated}, skipped: ${skipped}.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
