const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0;
    const skip = (page - 1) * limit;

    const products = await Product.find({})
        .skip(skip)
        .limit(limit);

    res.json(products);
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    const { name, category, price, image, description, weight, type, includedItems } = req.body;

    let finalPrice = price;
    if (type === 'package' && includedItems && includedItems.length > 0) {
        finalPrice = includedItems.reduce((acc, item) => acc + Number(item.price), 0);
    }

    const product = await Product.create({
        name,
        category,
        price: finalPrice,
        image,
        description,
        weight,
        type: type || 'individual',
        includedItems: type === 'package' ? includedItems : [],
    });

    res.status(201).json(product);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        product.name = req.body.name || product.name;
        product.category = req.body.category || product.category;
        product.image = req.body.image || product.image;
        product.description = req.body.description || product.description;
        product.weight = req.body.weight || product.weight;

        if (req.body.type) {
            product.type = req.body.type;
        }

        if (product.type === 'package') {
            product.includedItems = req.body.includedItems || product.includedItems;
            if (product.includedItems && product.includedItems.length > 0) {
                product.price = product.includedItems.reduce((acc, item) => acc + Number(item.price), 0);
            } else {
                product.price = req.body.price || product.price;
            }
        } else {
            product.price = req.body.price || product.price;
            product.includedItems = [];
        }

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
};
