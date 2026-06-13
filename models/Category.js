const mongoose = require('mongoose');
const { generateTranslations } = require('../utils/translateUtils');

console.log('Loading Category model...');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a category name'],
        unique: true,
        trim: true,
    },
    image: {
        type: String,
        default: '',
    },
    translations: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
});

categorySchema.pre('save', async function () {
    if ((this.isNew || this.isModified('name')) &&
        (!this.translations || Object.keys(this.translations).length === 0)) {
        try {
            this.translations = await generateTranslations({ name: this.name });
        } catch (e) {}
    }
});

console.log('✓ Category model schema defined');

try {
    module.exports = mongoose.model('Category', categorySchema);
    console.log('✓ Category model exported');
} catch (error) {
    console.error('❌ Error exporting Category model:', error.message);
    throw error;
}
