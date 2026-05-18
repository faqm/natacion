import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const [campeonatos, setCampeonatos] = useState([]);
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

  const generateSeedData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await axios.post(`${apiUrl}/api/events/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
        <button onClick={generateSeedData} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500">
          Generar Datos de Prueba
        </button>
      </div>

      <div className="space-y-8">
        {campeonatos.map(camp => (
          <div key={camp.id} className="border border-indigo-200 dark:border-indigo-900 rounded-xl p-6 bg-white dark:bg-gray-900">
            <h2 className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mb-4">{camp.nombre}</h2>
            <div className="space-y-6">
              {camp.eventos.map((evento) => (
                <div key={evento.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Evento #{evento.numero_evento}: {evento.estilo} {evento.distancia}m ({evento.genero})</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Edades: {evento.edad_min} - {evento.edad_max} años | Estado: <span className="font-semibold">{evento.estado}</span></p>
                    </div>
                    <div className="flex gap-2">
                      {evento.estado === 'PENDIENTE' && (
                        <button onClick={() => handleStateChange(evento.id, 'EN_CURSO')} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm">Iniciar</button>
                      )}
                      {evento.estado === 'EN_CURSO' && (
                        <button onClick={() => handleStateChange(evento.id, 'FINALIZADO')} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 text-sm">Finalizar</button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {evento.series.map(serie => (
                        <div key={serie.id} className="bg-white dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600">
                          <p className="font-medium text-gray-900 dark:text-gray-100">Serie #{serie.numero_serie}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Inicio: {serie.hora_inicio_estimada ? new Date(serie.hora_inicio_estimada).toLocaleTimeString() : 'N/A'}</p>
                          <ul className="space-y-1">
                            {serie.nadadores.map(nadador => (
                              <li key={nadador.id} className="text-xs text-gray-700 dark:text-gray-300">
                                {nadador.nombre} {nadador.apellido} ({nadador.club}) - {nadador.tiempo_registro || 'S/T'}
                              </li>
                            ))}
                          </ul>
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
