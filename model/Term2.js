const mongoose = require('mongoose');

const termSchema2 = new mongoose.Schema({
    title: String,
    content: String
});

module.exports = mongoose.model('Term2', termSchema2);