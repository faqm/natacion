const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await prisma.evento.findMany({
      include: {
        series: {
          include: {
            nadadores: true
          }
        }
      },
      orderBy: { numero_evento: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event status (Admin/Colaborador)
router.patch('/:id/estado', authenticateToken, requireRole(['ADMIN', 'COLABORADOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const event = await prisma.evento.update({
      where: { id: parseInt(id) },
      data: { estado },
      include: {
        series: {
          include: {
            nadadores: true
          }
        }
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('event_state_changed', event);
    }

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Seed data route (for testing/development)
router.post('/seed', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    // Create dummy event
    const event = await prisma.evento.create({
      data: {
        numero_evento: 1,
        estilo: 'CROL',
        distancia: 50,
        genero: 'MASCULINO',
        edad_min: 15,
        edad_max: 18,
        estado: 'PENDIENTE',
        series: {
          create: [
            {
              numero_serie: 1,
              hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 35), // 35 minutes from now
              nadadores: {
                create: [
                  { nombre: 'Juan', apellido: 'Perez', club: 'Club A', tiempo_registro: '00:25.00' },
                  { nombre: 'Carlos', apellido: 'Gomez', club: 'Club B', tiempo_registro: '00:26.50' }
                ]
              }
            },
            {
              numero_serie: 2,
              hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 40), // 40 minutes from now
              nadadores: {
                create: [
                  { nombre: 'Pedro', apellido: 'Lopez', club: 'Club C', tiempo_registro: '00:24.00' }
                ]
              }
            }
          ]
        }
      }
    });
    res.json({ message: 'Seed successful', event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
