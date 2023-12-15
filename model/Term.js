const mongoose = require('mongoose');

const termSchema = new mongoose.Schema({
    title: String,
    content: String
});

module.exports = mongoose.model('Term', termSchema);