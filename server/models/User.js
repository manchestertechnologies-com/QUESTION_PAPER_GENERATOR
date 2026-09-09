const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher'], required: true },
    subject: { type: String }, // For teachers
    classes: [{ type: String }],
    institutionName: { type: String, default: 'Manchester College' },
    institutionEmail: { type: String },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    isTrial: { type: Boolean, default: true },
    omrAccess: { type: Boolean, default: true },
    quotas: {
        assessment: {
            used: { type: Number, default: 0 },
            max: { type: Number, default: 2 },
            maxQuestions: { type: Number, default: 60 }
        },
        jee: {
            used: { type: Number, default: 0 },
            max: { type: Number, default: 2 },
            maxQuestions: { type: Number, default: 240 }
        },
        neet: {
            used: { type: Number, default: 0 },
            max: { type: Number, default: 2 },
            maxQuestions: { type: Number, default: 240 }
        },
        cet: {
            used: { type: Number, default: 0 },
            max: { type: Number, default: 2 },
            maxQuestions: { type: Number, default: 240 }
        }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
