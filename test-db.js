require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Pandit = require('./models/Pandit');

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const product = await Product.findOne();
        console.log("Product translations:", JSON.stringify(product?.translations, null, 2));

        const pandit = await Pandit.findOne();
        console.log("Pandit translations:", JSON.stringify(pandit?.translations, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
