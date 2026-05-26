const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get user's favorite swimmers and their upcoming series
router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await prisma.favoritos.findMany({
      where: { usuario_id: req.user.id },
      include: {
        competidor: {
          include: {
            nadador: true,
            serie: {
              include: {
                evento: {
                  include: {
                    campeonato: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Map to a cleaner format and calculate time to event
    const upcomingEvents = favorites.map(f => {
      return {
        competidor: f.competidor,
        nadador: f.competidor.nadador,
        serie: f.competidor.serie,
        evento: f.competidor.serie.evento,
        campeonato: f.competidor.serie.evento.campeonato
      };
    }).sort((a, b) => {
      // Sort by estimated start time
      const timeA = a.serie.hora_inicio_estimada ? new Date(a.serie.hora_inicio_estimada).getTime() : Infinity;
      const timeB = b.serie.hora_inicio_estimada ? new Date(b.serie.hora_inicio_estimada).getTime() : Infinity;
      return timeA - timeB;
    });

    res.json(upcomingEvents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add favorite
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { competidor_id } = req.body;
    
    const favorite = await prisma.favoritos.create({
      data: {
        usuario_id: req.user.id,
        competidor_id: parseInt(competidor_id)
      }
    });
    res.json(favorite);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Could not add favorite' });
  }
});

// Remove favorite
router.delete('/:competidor_id', authenticateToken, async (req, res) => {
  try {
    const { competidor_id } = req.params;
    
    await prisma.favoritos.deleteMany({
      where: {
        usuario_id: req.user.id,
        competidor_id: parseInt(competidor_id)
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Could not remove favorite' });
  }
});

module.exports = router;
