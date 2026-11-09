/**
 * Socket.io setup - real-time notifications for the admin panel.
 *
 * Admin clients connect with their JWT:
 *   io(API_URL, { auth: { token } })
 * After the token is verified they join the "admin" room and receive:
 *   newOrder      - a customer placed an order
 *   orderUpdated  - status / payment / cancel changed
 *   orderDeleted  - an order was deleted
 *   lowStock      - an order pushed items to or below their low stock limit
 */
const { Server } = require('socket.io');
const { verifyToken } = require('../middleware/auth');

const ADMIN_ROOM = 'admin';
let io = null;

/** Attach Socket.io to the HTTP server. */
const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  // JWT check during the handshake - unauthenticated sockets are rejected
  io.use(async (socket, next) => {
    try {
      const { auth = {}, query = {}, headers = {} } = socket.handshake;
      const bearer = (headers.authorization || '').replace(/^Bearer\s+/i, '');
      const token = auth.token || query.token || bearer;
      const admin = await verifyToken(token);
      socket.data.admin = { id: admin._id.toString(), username: admin.username, name: admin.name };
      return next();
    } catch (err) {
      return next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(ADMIN_ROOM);
    socket.emit('connected', { message: 'Connected to live order updates', admin: socket.data.admin });
    console.log(`[socket] admin "${socket.data.admin.username}" connected (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] admin "${socket.data.admin.username}" disconnected (${reason})`);
    });
  });

  return io;
};

/** The Socket.io server instance (null before initSocket). */
const getIO = () => io;

/** Send an event to every connected admin. Safe to call before init. */
const emitToAdmins = (event, payload) => {
  if (io) io.to(ADMIN_ROOM).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToAdmins };
