const mongoose = require('mongoose');

const occasionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add an occasion name'],
        trim: true,
    },
    englishName: {
        type: String,
        required: [true, 'Please add an English name'],
        trim: true,
    },
    icon: {
        type: String,
        default: '📅', // Default emoji
    },
    image: {
        type: String,
        default: '',
    },
    gradient: {
        type: [String],
        default: ['#FF6B6B', '#C92A2A'], // Default gradient colors
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Occasion', occasionSchema);
