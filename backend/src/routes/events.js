const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

// Get all campeonatos with events, series, and swimmers
router.get('/', async (req, res) => {
  try {
    const campeonatos = await prisma.campeonato.findMany({
      include: {
        eventos: {
          include: {
            series: {
              include: {
                nadadores: true
              }
            }
          },
          orderBy: { numero_evento: 'asc' }
        }
      },
      orderBy: { fecha_inicio: 'desc' }
    });
    res.json(campeonatos);
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

// Seed data route
router.post('/seed', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const campeonato = await prisma.campeonato.create({
      data: {
        nombre: 'Campeonato Nacional de Verano 2026',
        fecha_inicio: today,
        fecha_fin: tomorrow,
        eventos: {
          create: [
            {
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
                    hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 35), // today
                    nadadores: {
                      create: [
                        { nombre: 'Juan', apellido: 'Perez', club: 'Club A', tiempo_registro: '00:25.00' },
                        { nombre: 'Carlos', apellido: 'Gomez', club: 'Club B', tiempo_registro: '00:26.50' }
                      ]
                    }
                  },
                  {
                    numero_serie: 2,
                    hora_inicio_estimada: new Date(Date.now() - 1000 * 60 * 60), // past (1 hour ago)
                    nadadores: {
                      create: [
                        { nombre: 'Pedro', apellido: 'Lopez', club: 'Club C', tiempo_registro: '00:24.00' }
                      ]
                    }
                  }
                ]
              }
            },
            {
              numero_evento: 2,
              estilo: 'MARIPOSA',
              distancia: 100,
              genero: 'FEMENINO',
              edad_min: 15,
              edad_max: 18,
              estado: 'PENDIENTE',
              series: {
                create: [
                  {
                    numero_serie: 1,
                    hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
                    nadadores: {
                      create: [
                        { nombre: 'Ana', apellido: 'Martinez', club: 'Club A', tiempo_registro: '01:10.00' },
                        { nombre: 'Laura', apellido: 'Diaz', club: 'Club D', tiempo_registro: '01:12.50' }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });
    res.json({ message: 'Seed successful', campeonato });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
