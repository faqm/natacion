import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const [campeonatos, setCampeonatos] = useState([]);
  const [isCreatingCamp, setIsCreatingCamp] = useState(false);
  const [newCampData, setNewCampData] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '' });
  const [newEventCampId, setNewEventCampId] = useState(null);
  const [newEventData, setNewEventData] = useState({ numero_evento: '', estilo: 'CROL', distancia: '50', genero: 'MASCULINO', edad_min: '15', edad_max: '18' });
  const { token } = useContext(AuthContext);

  useEffect(() => {
    fetchCampeonatos();
  }, []);

  const fetchCampeonatos = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${apiUrl}/api/events`);
      setCampeonatos(res.data);
    } catch (error) {
      toast.error('Error fetching campeonatos');
    }
  };

  const handleStateChange = async (eventId, newState) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.patch(`${apiUrl}/api/events/${eventId}/estado`, { estado: newState }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Event state changed to ${newState}`);
      fetchCampeonatos();
    } catch (error) {
      toast.error('Failed to change event state');
    }
  };

  const handleSerieStart = async (serieId) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.patch(`${apiUrl}/api/events/series/${serieId}/start`, { 
        hora_inicio_real: new Date().toISOString() 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Hora real registrada y propagada');
      fetchCampeonatos();
    } catch (error) {
      toast.error('Error al registrar la hora');
    }
  };

  const handleCreateCampeonato = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.post(`${apiUrl}/api/events/campeonato`, newCampData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Campeonato creado');
      setIsCreatingCamp(false);
      setNewCampData({ nombre: '', fecha_inicio: '', fecha_fin: '' });
      fetchCampeonatos();
    } catch (error) {
      toast.error('Error al crear campeonato');
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.post(`${apiUrl}/api/events`, { ...newEventData, campeonato_id: newEventCampId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Evento creado');
      setNewEventCampId(null);
      fetchCampeonatos();
    } catch (error) {
      toast.error('Error al crear evento');
    }
  };

  const handleFileUpload = async (eventId, file) => {
    if (!file) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${apiUrl}/api/events/${eventId}/upload`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Archivo cargado exitosamente');
      fetchCampeonatos();
    } catch (error) {
      toast.error('Error al cargar el archivo');
    }
  };

  const generateSeedData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.get(`${apiUrl}/api/events/seed-public`);
      toast.success('Seed data created');
      fetchCampeonatos();
    } catch (error) {
      toast.error('Failed to create seed data');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Control (Admin)</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsCreatingCamp(!isCreatingCamp)} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 font-bold">
            + Nuevo Campeonato
          </button>
          <button onClick={generateSeedData} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500">
            Generar Datos de Prueba
          </button>
        </div>
      </div>

      {isCreatingCamp && (
        <form onSubmit={handleCreateCampeonato} className="mb-8 p-6 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Crear Nuevo Campeonato</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Nombre del Campeonato</label>
              <input type="text" required className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ej: Nacional de Verano" value={newCampData.nombre} onChange={e => setNewCampData({...newCampData, nombre: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Fecha de Inicio</label>
              <input type="date" required className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newCampData.fecha_inicio} onChange={e => setNewCampData({...newCampData, fecha_inicio: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Fecha de Fin (Opcional)</label>
              <input type="date" className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newCampData.fecha_fin} onChange={e => setNewCampData({...newCampData, fecha_fin: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-500">Guardar Campeonato</button>
            <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500" onClick={() => setIsCreatingCamp(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-8">
        {campeonatos.map(camp => (
          <div key={camp.id} className="border border-indigo-200 dark:border-indigo-900 rounded-xl p-6 bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{camp.nombre}</h2>
              <button 
                onClick={() => setNewEventCampId(camp.id)} 
                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
              >
                + Añadir Evento
              </button>
            </div>

            {newEventCampId === camp.id && (
              <form onSubmit={handleCreateEvent} className="mb-6 p-4 bg-gray-50 border rounded-lg flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold mb-1 text-gray-700">Número</label>
                  <input type="number" required className="border p-1 w-20 rounded" value={newEventData.numero_evento} onChange={e => setNewEventData({...newEventData, numero_evento: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-gray-700">Estilo</label>
                  <select className="border p-1 rounded" value={newEventData.estilo} onChange={e => setNewEventData({...newEventData, estilo: e.target.value})}>
                    <option>CROL</option><option>MARIPOSA</option><option>PECHO</option><option>ESPALDA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-gray-700">Distancia</label>
                  <input type="number" required className="border p-1 w-20 rounded" value={newEventData.distancia} onChange={e => setNewEventData({...newEventData, distancia: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-gray-700">Género</label>
                  <select className="border p-1 rounded" value={newEventData.genero} onChange={e => setNewEventData({...newEventData, genero: e.target.value})}>
                    <option>MASCULINO</option><option>FEMENINO</option><option>MIXTO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-gray-700">Edades</label>
                  <div className="flex gap-1">
                    <input type="number" placeholder="Min" required className="border p-1 w-16 rounded" value={newEventData.edad_min} onChange={e => setNewEventData({...newEventData, edad_min: e.target.value})} />
                    <input type="number" placeholder="Max" required className="border p-1 w-16 rounded" value={newEventData.edad_max} onChange={e => setNewEventData({...newEventData, edad_max: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Guardar</button>
                  <button type="button" className="bg-gray-400 text-white px-3 py-1 rounded" onClick={() => setNewEventCampId(null)}>Cancelar</button>
                </div>
              </form>
            )}

            <div className="space-y-6">
              {camp.eventos.map((evento) => (
                <div key={evento.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Evento #{evento.numero_evento}: {evento.estilo} {evento.distancia}m ({evento.genero})</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Edades: {evento.edad_min} - {evento.edad_max} años | Estado: <span className="font-semibold">{evento.estado}</span></p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {evento.estado === 'PENDIENTE' && (
                        <>
                          <label className="bg-green-50 text-green-700 px-2 py-1 text-xs rounded border border-green-200 cursor-pointer hover:bg-green-100">
                            Cargar Excel
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFileUpload(evento.id, e.target.files[0])} />
                          </label>
                          <button onClick={() => handleStateChange(evento.id, 'EN_CURSO')} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm">Iniciar</button>
                        </>
                      )}
                      {evento.estado === 'EN_CURSO' && (
                        <button onClick={() => handleStateChange(evento.id, 'FINALIZADO')} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 text-sm">Finalizar</button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {evento.series.map(serie => (
                        <div key={serie.id} className="bg-white dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600 flex flex-col justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">Serie #{serie.numero_serie}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                              Programada: {serie.hora_inicio_programada ? new Date(serie.hora_inicio_programada).toLocaleTimeString() : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Estimada: {serie.hora_inicio_estimada ? new Date(serie.hora_inicio_estimada).toLocaleTimeString() : 'N/A'}
                            </p>
                            {serie.hora_inicio_real && (
                              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-2">
                                Real: {new Date(serie.hora_inicio_real).toLocaleTimeString()}
                              </p>
                            )}
                            <ul className="space-y-1 mb-2">
                              {serie.competidores.map(competidor => (
                                <li key={competidor.id} className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                  {competidor.nadador.nombres} {competidor.nadador.apellido_paterno} ({competidor.club}) - {competidor.tiempo_registro || 'S/T'}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {!serie.hora_inicio_real && evento.estado !== 'FINALIZADO' && (
                            <button 
                              onClick={() => handleSerieStart(serie.id)}
                              className="w-full text-xs bg-indigo-100 text-indigo-700 py-1 rounded hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300"
                            >
                              Registrar Hora Real
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {campeonatos.length === 0 && <p className="text-gray-500">No hay campeonatos disponibles.</p>}
      </div>
    </div>
  );
}
