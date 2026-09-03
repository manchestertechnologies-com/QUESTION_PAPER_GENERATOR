const dns = require('dns');
// Set DNS servers to resolve MongoDB SRV records reliably
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
    console.warn('⚠️ Warning: Failed to set custom DNS servers:', err.message);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

// ── Security Middleware
const helmet = require('helmet');
const mongoSanitize = require('./middleware/mongoSanitize');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// ── Routes
const authRoutes = require('./routes/auth.js');
const adminRoutes = require('./routes/admin.js');
const questionRoutes = require('./routes/questions.js');
const paperRoutes = require('./routes/papers.js');
const templateRoutes = require('./routes/templates.js');
const examRoutes = require('./routes/exams.js');
const labRoutes = require('./routes/lab.js');
const grandTestRoutes = require('./routes/grandTests.js');
const previousYearPaperRoutes = require('./routes/previousYearPapers.js');
const examBlueprintRoutes = require('./routes/examBlueprints.js');
const notificationRoutes = require('./routes/notifications.js');
const testModuleRoutes = require('./routes/testModule.js');

dotenv.config();

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Helmet — HTTP security headers
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Permit all origins (Vercel deployments, custom domains, localhost)
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Always allow origin so Vercel preview/production URLs and custom domains connect smoothly
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Origin', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsing — Strict size limits
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: NoSQL Injection Protection
// Strips $ and . from req.body, req.query, req.params
// ─────────────────────────────────────────────────────────────────────────────
app.use(mongoSanitize);

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING — Global API limiter
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Static Files
// ─────────────────────────────────────────────────────────────────────────────
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory at:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        message: 'QPG System API is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/api/health', (req, res) => {
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        status: 'ok',
        db: dbState[mongoose.connection.readyState] || 'unknown',
        uptime: Math.floor(process.uptime()),
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/grand-tests', grandTestRoutes);
app.use('/api/previous-year-papers', previousYearPaperRoutes);
app.use('/api/exam-blueprints', examBlueprintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/test-module', testModuleRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ msg: `Route not found: ${req.method} ${req.path}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler (no stack traces to client)
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Database + Server Start (Skipped in test environment)
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ MongoDB Connected');
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`✅ Server running on port ${PORT}`);
            });
        })
        .catch(err => {
            console.error('❌ MongoDB connection failed:', err.message);
            process.exit(1);
        });
}

module.exports = app; // Exported for supertest
