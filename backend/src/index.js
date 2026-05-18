const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const prisma = require('./lib/prisma');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

// Routes
const { router: authRouter } = require('./routes/auth');
const eventsRouter = require('./routes/events');
const favoritesRouter = require('./routes/favorites');

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/favorites', favoritesRouter);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_event', (eventId) => {
    socket.join(`event_${eventId}`);
    console.log(`Socket ${socket.id} joined event_${eventId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);

// Notification Cron Job (Runs every minute)
setInterval(async () => {
  try {
    const now = new Date();
    // Fetch all series that are pending and have an estimated start time
    const series = await prisma.serie.findMany({
      where: {
        hora_inicio_estimada: { not: null },
        evento: { estado: 'PENDIENTE' }
      },
      include: {
        evento: true,
        nadadores: {
          include: {
            favoritos: true
          }
        }
      }
    });

    series.forEach(serie => {
      const startTime = new Date(serie.hora_inicio_estimada);
      const diffMinutes = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));

      // Check if it's exactly 30, 15, or 5 minutes away
      if ([30, 15, 5].includes(diffMinutes)) {
        // Find users who favorited swimmers in this series
        const usersToNotify = new Set();
        serie.nadadores.forEach(nadador => {
          nadador.favoritos.forEach(fav => {
            usersToNotify.add(fav.usuario_id);
          });
        });

        // Broadcast to all connected clients (the frontend will filter by user ID)
        // Alternatively, we could emit to specific user rooms if they joined one.
        // For simplicity, emit globally and let frontend filter, or better, emit to a 'user_room'
        io.emit('upcoming_event_notification', {
          serie_id: serie.id,
          evento: serie.evento.numero_evento,
          estilo: serie.evento.estilo,
          minutosFaltantes: diffMinutes,
          userIds: Array.from(usersToNotify) // Send the array of user IDs that should see this
        });
      }
    });

  } catch (error) {
    console.error("Cron job error:", error);
  }
}, 60000);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
