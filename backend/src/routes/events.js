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
                competidores: {
                  include: { nadador: true }
                }
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
            competidores: {
              include: { nadador: true }
            }
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
router.get('/seed-public', async (req, res) => {
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
                    hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 35),
                    competidores: {
                      create: [
                        { 
                          club: 'Club A', tiempo_registro: '00:25.00',
                          nadador: { create: { id: '11111111-1', nombres: 'Juan', apellido_paterno: 'Perez', apellido_materno: 'Gomez', fecha_nacimiento: new Date('2005-01-01'), sexo: 'MASCULINO' } }
                        },
                        { 
                          club: 'Club B', tiempo_registro: '00:26.50',
                          nadador: { create: { id: '22222222-2', nombres: 'Carlos', apellido_paterno: 'Gomez', apellido_materno: 'Diaz', fecha_nacimiento: new Date('2004-05-10'), sexo: 'MASCULINO' } }
                        }
                      ]
                    }
                  },
                  {
                    numero_serie: 2,
                    hora_inicio_estimada: new Date(Date.now() - 1000 * 60 * 60),
                    competidores: {
                      create: [
                        { 
                          club: 'Club C', tiempo_registro: '00:24.00',
                          nadador: { create: { id: '33333333-3', nombres: 'Pedro', apellido_paterno: 'Lopez', apellido_materno: 'Ruiz', fecha_nacimiento: new Date('2005-11-20'), sexo: 'MASCULINO' } }
                        }
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
                    hora_inicio_estimada: new Date(Date.now() + 1000 * 60 * 60 * 24),
                    competidores: {
                      create: [
                        { 
                          club: 'Club A', tiempo_registro: '01:10.00',
                          nadador: { create: { id: '44444444-4', nombres: 'Ana', apellido_paterno: 'Martinez', apellido_materno: 'Soto', fecha_nacimiento: new Date('2006-02-15'), sexo: 'FEMENINO' } }
                        },
                        { 
                          club: 'Club D', tiempo_registro: '01:12.50',
                          nadador: { create: { id: '55555555-5', nombres: 'Laura', apellido_paterno: 'Diaz', apellido_materno: 'Vera', fecha_nacimiento: new Date('2006-08-30'), sexo: 'FEMENINO' } }
                        }
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
    res.json({ message: 'Seed successful (public)', campeonato });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
