const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// Keep `mrp` only when it's a genuine markdown above the charged price.
// Returns null otherwise so the item simply shows a single clean price.
function normalizeMrp(mrp, price) {
    if (mrp === undefined || mrp === null || mrp === '') return null;
    const m = Number(mrp);
    if (isNaN(m) || m <= Number(price)) return null;
    return m;
}

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { occasionId, categoryId, search } = req.query;
    let query = {};
    if (occasionId) query.occasions = occasionId;
    if (categoryId) query.category = categoryId;
    if (search) query.name = { $regex: search, $options: 'i' };

    const [products, total] = await Promise.all([
        Product.find(query).populate('occasions').skip(skip).limit(limit),
        Product.countDocuments(query),
    ]);

    res.json({ products, total, page, pages: Math.ceil(total / limit) });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('occasions');
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }
    res.json(product);
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    const { name, category, price, image, description, weight, type, includedItems, gstPercentage, mrp } = req.body;

    let finalPrice = price;
    if (type === 'package' && includedItems && includedItems.length > 0) {
        finalPrice = includedItems.reduce((acc, item) => acc + Number(item.price), 0);
    }

    const product = await Product.create({
        name,
        category,
        price: finalPrice,
        mrp: normalizeMrp(mrp, finalPrice),
        image,
        description,
        weight,
        type: type || 'individual',
        includedItems: type === 'package' ? includedItems : [],
        occasions: req.body.occasions || [],
        gstPercentage: gstPercentage || 0,
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
        product.gstPercentage = req.body.gstPercentage !== undefined ? req.body.gstPercentage : product.gstPercentage;

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

        if (req.body.occasions) {
            product.occasions = req.body.occasions;
        }

        // Recompute compare-at price against the (possibly updated) charged price.
        if (req.body.mrp !== undefined) {
            product.mrp = normalizeMrp(req.body.mrp, product.price);
        } else if (product.mrp != null && product.mrp <= product.price) {
            // Price was raised at/above an old mrp — the discount no longer holds.
            product.mrp = null;
        }

        const updatedProduct = await (await product.save()).populate('occasions');
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
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};
