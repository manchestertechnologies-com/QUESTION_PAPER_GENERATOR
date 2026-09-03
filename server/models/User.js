const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher'], required: true },
    subject: { type: String }, // For teachers
    classes: [{ type: String }], // Optional depending on how assignment works
    omrAccess: { type: Boolean, default: true }, // Granular permission for OMR module
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
