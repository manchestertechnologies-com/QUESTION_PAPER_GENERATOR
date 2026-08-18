const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Mock auth middleware BEFORE importing templates route
jest.mock('../middleware/auth', () => (req, res, next) => {
    req.user = { id: '000000000000000000000000', role: 'admin' };
    next();
});

jest.mock('../middleware/role', () => (roles) => (req, res, next) => {
    next();
});

const templateRoutes = require('../routes/templates');
const Template = require('../models/Template');

// Create a small express app for testing
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/templates', templateRoutes);

// Global error handler
const errorHandler = require('../middleware/errorHandler');
app.use(errorHandler);

describe('Templates Route', () => {
    it('should create template without file', async () => {
        const res = await request(app)
            .post('/api/templates')
            .send({
                title: 'Test Template',
                description: 'Test Description',
                templateType: 'FULL_PAPER',
                institutionName: 'Test School'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Test Template');
        expect(res.body.institutionName).toBe('Test School');
    });

    it('should fail or handle file upload', async () => {
        const dummyPath = path.join(__dirname, 'dummy.png');
        fs.writeFileSync(dummyPath, 'fake image data');

        try {
            const res = await request(app)
                .post('/api/templates')
                .attach('template', dummyPath)
                .field('title', 'Test Template with File');
            
            console.log('Template upload response status:', res.status);
            console.log('Template upload response body:', res.body);
        } finally {
            if (fs.existsSync(dummyPath)) {
                fs.unlinkSync(dummyPath);
            }
        }
    });
});
