-- seed_data.sql
-- Sample data for Neon PostgreSQL database based on Prisma schema.
-- Adjust values as needed.

-- Users
INSERT INTO "Usuario" (email, password, verificado, rol) VALUES
('alice@example.com', crypt('password1', gen_salt('bf')), true, 'ADMIN'),
('bob@example.com', crypt('password2', gen_salt('bf')), false, 'GENERAL'),
('carol@example.com', crypt('password3', gen_salt('bf')), true, 'COLABORADOR');

-- Campeonatos
INSERT INTO "Campeonato" (nombre, fecha_inicio, fecha_fin) VALUES
('Campeonato Verano 2026', '2026-06-01', '2026-06-30'),
('Campeonato Invierno 2026', '2026-12-01', NULL);

-- Eventos (assume campeonato ids 1 and 2)
INSERT INTO "Evento" (numero_evento, campeonato_id, estilo, distancia, genero, edad_min, edad_max, estado) VALUES
(1, 1, 'CROL', 100, 'MASCULINO', 12, 18, 'PENDIENTE'),
(2, 1, 'MARIPOSA', 200, 'FEMENINO', 15, 20, 'PENDIENTE'),
(3, 2, 'PECHO', 50, 'MIXTO', 10, 15, 'PENDIENTE');

-- Series (assume evento ids 1,2,3)
INSERT INTO "Serie" (numero_serie, hora_inicio_estimada, evento_id) VALUES
(1, '2026-06-01 09:00:00', 1),
(2, '2026-06-01 09:15:00', 1),
(3, '2026-06-01 10:00:00', 2);

-- Nadadores
INSERT INTO "Nadador" (id, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, sexo) VALUES
('11111111-1', 'Juan', 'Perez', 'Lopez', '2005-04-10', 'MASCULINO'),
('22222222-2', 'Maria', 'Gomez', NULL, '2004-08-22', 'FEMENINO'),
('33333333-3', 'Luis', 'Ramirez', 'Martinez', '2006-01-15', 'MASCULINO');

-- Competidores (link nadadores to series)
INSERT INTO "Competidor" (nadador_id, club, tiempo_registro, serie_id) VALUES
('11111111-1', 'Club A', '00:55.23', 1),
('22222222-2', 'Club B', '01:12.45', 2),
('33333333-3', 'Club C', NULL, 3);

-- Favoritos (link usuarios a competidores)
INSERT INTO "Favoritos" (usuario_id, competidor_id) VALUES
(1, 1),
(2, 2),
(3, 3);
