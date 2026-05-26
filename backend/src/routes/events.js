const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('./auth');
const multer = require('multer');
const xlsx = require('xlsx');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// Update serie real start time and propagate delay (Admin/Colaborador)
router.patch('/series/:id/start', authenticateToken, requireRole(['ADMIN', 'COLABORADOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const { hora_inicio_real } = req.body;
    const realStartTime = new Date(hora_inicio_real);

    const serie = await prisma.serie.findUnique({
      where: { id: parseInt(id) },
      include: { evento: true }
    });

    if (!serie || !serie.hora_inicio_estimada) {
      return res.status(400).json({ error: 'Serie not found or no estimated time' });
    }

    const estimatedTime = new Date(serie.hora_inicio_estimada);
    const delayMs = realStartTime.getTime() - estimatedTime.getTime();

    // Update the real start time of this serie
    const updatedSerie = await prisma.serie.update({
      where: { id: parseInt(id) },
      data: { hora_inicio_real: realStartTime }
    });

    // Find all series of the same championship ON THE SAME DAY that haven't started yet
    // and whose estimated start time is after this serie's estimated start time
    const startOfDay = new Date(estimatedTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(estimatedTime);
    endOfDay.setHours(23, 59, 59, 999);

    const subsequentSeries = await prisma.serie.findMany({
      where: {
        evento: { campeonato_id: serie.evento.campeonato_id },
        hora_inicio_estimada: {
          gt: estimatedTime,
          gte: startOfDay,
          lte: endOfDay
        },
        hora_inicio_real: null
      }
    });

    // Propagate the delay to subsequent series
    for (const subSerie of subsequentSeries) {
      const newEstimatedTime = new Date(new Date(subSerie.hora_inicio_estimada).getTime() + delayMs);
      await prisma.serie.update({
        where: { id: subSerie.id },
        data: { hora_inicio_estimada: newEstimatedTime }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('event_state_changed'); // Trigger refresh on frontend
    }

    res.json({ message: 'Serie started and delay propagated', updatedSerie });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new empty Evento (Admin)
router.post('/', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { campeonato_id, numero_evento, estilo, distancia, genero, edad_min, edad_max } = req.body;
    
    const newEvent = await prisma.evento.create({
      data: {
        campeonato_id: parseInt(campeonato_id),
        numero_evento: parseInt(numero_evento),
        estilo,
        distancia: parseInt(distancia),
        genero,
        edad_min: parseInt(edad_min),
        edad_max: parseInt(edad_max),
        estado: 'PENDIENTE'
      }
    });
    
    res.json(newEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload Excel to populate Evento with Series and Swimmers (Admin)
router.post('/:id/upload', authenticateToken, requireRole(['ADMIN']), upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Expected columns: RUT, Nombres, Apellidos, Sexo, FechaNacimiento, Club, TiempoRegistro, NumeroSerie
    const data = xlsx.utils.sheet_to_json(sheet);

    // Group by NumeroSerie
    const seriesMap = {};
    for (const row of data) {
      const numSerie = parseInt(row['NumeroSerie']);
      if (!numSerie) continue;
      if (!seriesMap[numSerie]) seriesMap[numSerie] = [];
      seriesMap[numSerie].push(row);
    }

    for (const [numSerieStr, rows] of Object.entries(seriesMap)) {
      const numSerie = parseInt(numSerieStr);
      // Create or find serie
      let serie = await prisma.serie.findFirst({
        where: { evento_id: parseInt(id), numero_serie: numSerie }
      });
      
      if (!serie) {
        serie = await prisma.serie.create({
          data: {
            evento_id: parseInt(id),
            numero_serie: numSerie,
            // default estimated start time can be adjusted later
            hora_inicio_estimada: new Date() 
          }
        });
      }

      for (const row of rows) {
        const rut = row['RUT'] ? String(row['RUT']).trim() : null;
        if (!rut) continue;

        // Upsert Nadador
        let fechaNac = new Date();
        if (row['FechaNacimiento']) {
          // Attempt to parse excel date if needed, otherwise use string parse
          fechaNac = new Date(row['FechaNacimiento']);
          if (isNaN(fechaNac.getTime()) && typeof row['FechaNacimiento'] === 'number') {
            // Excel serial date to JS date
            fechaNac = new Date((row['FechaNacimiento'] - (25567 + 2)) * 86400 * 1000);
          }
        }

        const nadador = await prisma.nadador.upsert({
          where: { id: rut },
          update: {},
          create: {
            id: rut,
            nombres: row['Nombres'] || 'Sin Nombre',
            apellido_paterno: row['Apellidos'] || '',
            sexo: row['Sexo'] === 'M' ? 'MASCULINO' : (row['Sexo'] === 'F' ? 'FEMENINO' : 'MIXTO'),
            fecha_nacimiento: isNaN(fechaNac.getTime()) ? new Date('2000-01-01') : fechaNac
          }
        });

        // Add Competidor
        await prisma.competidor.create({
          data: {
            nadador_id: nadador.id,
            club: row['Club'] || 'Sin Club',
            tiempo_registro: row['TiempoRegistro'] ? String(row['TiempoRegistro']) : null,
            serie_id: serie.id
          }
        });
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('event_state_changed');

    res.json({ message: 'File processed successfully' });
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
