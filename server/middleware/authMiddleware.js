import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // THE FIX: Smart extraction handles both 'id' and 'userId' token payloads
      req.user = { id: decoded.id || decoded.userId };

      return next(); 
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' }); 
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' }); 
  }
};