const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionNumber: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['debt', 'owes', 'credit'] },
    amount: { type: Number, required: true },
    amounttx: { type: Number },
    dueDate: { type: Date, required: true },
    paid: { type: Boolean, default: false },
    paypaid: { type: Boolean, default: false },
    paidDate: { type: Date },
    paidAmount: { type: Number },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
    status: { type: String, enum: ['not set' ,'waiting', 'confirmed', 'rejected'], default: 'not set' },
    notes: [{ type: String }], // Array of notes
    fileLinks: [{ type: String }], // Array of file links
    createdAt: { type: Date, default: Date.now }
});

// Pre-save middleware to generate and increment the transactionNumber
// Pre-save middleware to generate and increment the transactionNumber
transactionSchema.pre('save', async function (next) {
    try {
        if (!this.transactionNumber) {
            const latestTransaction = await this.constructor.findOne({}, 'transactionNumber', { sort: { 'transactionNumber': -1 } });
            let nextTransactionNumber = '0001';

            if (latestTransaction && latestTransaction.transactionNumber) {
                const lastNumber = parseInt(latestTransaction.transactionNumber.slice(1), 10);
                nextTransactionNumber = ('000' + (lastNumber + 1)).slice(-4);
            }

            // Add prefix 'D' for debt or 'C' for credit
            const prefix = (this.type === 'debt') ? 'D' : 'C';
            this.transactionNumber = prefix + nextTransactionNumber;
        }

        next();
    } catch (error) {
        next(error);
    }
});


module.exports = mongoose.model('Transaction', transactionSchema);
