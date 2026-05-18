import { useEffect, useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LiveEvents() {
  const [events, setEvents] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const socket = useContext(SocketContext);
  const { user, token } = useContext(AuthContext);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update "now" every minute to refresh countdowns
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvents = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${apiUrl}/api/events`);
      setEvents(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFavorites = async () => {
    if (!token) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${apiUrl}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchFavorites();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    socket.on('event_state_changed', (updatedEvent) => {
      setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      toast(`El evento #${updatedEvent.numero_evento} ha cambiado a ${updatedEvent.estado}`, {
        icon: '📣',
      });
    });

    socket.on('upcoming_event_notification', (data) => {
      if (user && data.userIds.includes(user.id)) {
        toast.success(`Faltan ${data.minutosFaltantes} minutos para el evento #${data.evento} (${data.estilo}) de uno de tus favoritos!`, {
          duration: 6000,
          position: 'top-right',
        });
      }
    });

    return () => {
      socket.off('event_state_changed');
      socket.off('upcoming_event_notification');
    };
  }, [socket, user]);

  const toggleFavorite = async (nadadorId) => {
    if (!token) {
      toast.error('Debes iniciar sesión para guardar favoritos');
      return;
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const isFav = isFavorite(nadadorId);
      if (isFav) {
        await axios.delete(`${apiUrl}/api/favorites/${nadadorId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Eliminado de favoritos');
      } else {
        await axios.post(`${apiUrl}/api/favorites`, { nadador_id: nadadorId }, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Añadido a favoritos');
      }
      fetchFavorites();
    } catch (e) {
      toast.error('Error al actualizar favorito');
    }
  };

  const isFavorite = (nadadorId) => {
    return favorites.some(f => f.nadador.id === nadadorId);
  };

  const renderCountdown = (timeStr) => {
    if (!timeStr) return 'Hora por definir';
    const time = new Date(timeStr);
    if (isPast(time)) return 'En curso / Pasado';
    return `En ${formatDistanceToNow(time, { locale: es })}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-8 text-center drop-shadow-md">
        Eventos en Vivo
      </h1>
      
      {/* Favorites Countdown Section */}
      {user && favorites.length > 0 && (
        <div className="mb-10 p-6 bg-indigo-50 dark:bg-gray-800 rounded-2xl shadow-lg border border-indigo-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-indigo-900 dark:text-indigo-300">Próximos Eventos de tus Favoritos</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites.filter(f => f.evento.estado !== 'FINALIZADO').map((fav, i) => (
              <div key={i} className="bg-white dark:bg-gray-700 p-4 rounded-xl shadow-sm border-l-4 border-pink-500 hover:shadow-md transition-shadow">
                <p className="font-bold text-gray-900 dark:text-white text-lg">{fav.nadador.nombre} {fav.nadador.apellido}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Evento #{fav.evento.numero_evento} - {fav.evento.estilo}</p>
                <div className="mt-3 inline-block bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 px-3 py-1 rounded-full text-sm font-semibold">
                  ⏳ {renderCountdown(fav.serie.hora_inicio_estimada)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Events */}
      <div className="space-y-8">
        {events.map((evento) => (
          <div key={evento.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className={`p-4 ${evento.estado === 'EN_CURSO' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-900'}`}>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Evento #{evento.numero_evento}: {evento.estilo}</h2>
                <span className={`px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${evento.estado === 'EN_CURSO' ? 'bg-white text-green-600' : 'bg-indigo-100 text-indigo-800'}`}>
                  {evento.estado}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {evento.series.map(serie => (
                  <div key={serie.id} className="border dark:border-gray-600 rounded-xl p-5 hover:shadow-lg transition-shadow bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex justify-between items-center border-b dark:border-gray-600 pb-3 mb-3">
                      <p className="font-bold text-lg text-gray-900 dark:text-white">Serie #{serie.numero_serie}</p>
                      <span className="text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                        {renderCountdown(serie.hora_inicio_estimada)}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {serie.nadadores.map(nadador => (
                        <li key={nadador.id} className="flex justify-between items-center group">
                          <span className="text-gray-800 dark:text-gray-200">{nadador.nombre} {nadador.apellido}</span>
                          <button 
                            onClick={() => toggleFavorite(nadador.id)}
                            className={`p-2 rounded-full transition-colors ${isFavorite(nadador.id) ? 'text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20' : 'text-gray-400 hover:text-pink-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            title={isFavorite(nadador.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                          >
                            <svg className="w-6 h-6" fill={isFavorite(nadador.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                          </button>
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
  );
}
