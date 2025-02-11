const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
