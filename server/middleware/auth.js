const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'auth_token';

const auth = (req, res, next) => {
    // 1. Try HttpOnly cookie first (new secure method)
    let token = req.cookies?.[COOKIE_NAME];

    // 2. Fall back to Authorization: Bearer header (for backward compatibility + API clients)
    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    // 3. Fall back to x-auth-token header (legacy)
    if (!token) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Token has expired. Please log in again.' });
        }
        return res.status(401).json({ msg: 'Token is not valid.' });
    }
};

module.exports = auth;
