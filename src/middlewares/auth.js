const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('Auth middleware: No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    console.log('Auth middleware: Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware: Token decoded, userId:', decoded.userId);

    const user = await User.findById(decoded.userId).select('username email displayName avatar bio createdAt role'); // Explicitly include fields and role
    console.log('Auth middleware: User lookup result:', user ? 'User found' : 'User not found');

    if (!user) {
      console.log('Auth middleware: User not found for ID:', decoded.userId);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('Auth middleware: User authenticated successfully:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;


