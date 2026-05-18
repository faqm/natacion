import { useEffect, useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LiveEvents() {
  const [campeonatos, setCampeonatos] = useState([]);
  const [favorites, setFavorites] = useState([]);
  
  const [selectedCampId, setSelectedCampId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const socket = useContext(SocketContext);
  const { user, token } = useContext(AuthContext);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampeonatos = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${apiUrl}/api/events`);
      setCampeonatos(res.data);
      if (res.data.length > 0 && !selectedCampId) {
        setSelectedCampId(res.data[0].id.toString());
      }
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
    fetchCampeonatos();
    fetchFavorites();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    socket.on('event_state_changed', () => {
      fetchCampeonatos(); // Re-fetch to get nested updates easily
      toast('Un evento ha cambiado de estado', { icon: '📣' });
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

  const selectedCampeonato = campeonatos.find(c => c.id.toString() === selectedCampId);

  // Extract unique days for the selected campeonato
  const days = useMemo(() => {
    if (!selectedCampeonato) return [];
    const uniqueDays = new Set();
    selectedCampeonato.eventos.forEach(ev => {
      ev.series.forEach(serie => {
        if (serie.hora_inicio_estimada) {
          const dayStr = format(new Date(serie.hora_inicio_estimada), 'yyyy-MM-dd');
          uniqueDays.add(dayStr);
        }
      });
    });
    const sortedDays = Array.from(uniqueDays).sort();
    if (sortedDays.length > 0 && !selectedDay && !sortedDays.includes(selectedDay)) {
       setSelectedDay(sortedDays[0]);
    }
    return sortedDays;
  }, [selectedCampeonato]);

  // Filter events based on day and search query
  const filteredEvents = useMemo(() => {
    if (!selectedCampeonato) return [];
    
    return selectedCampeonato.eventos.map(evento => {
      // Filter series by day
      const filteredSeries = evento.series.filter(serie => {
        if (!selectedDay) return true;
        if (!serie.hora_inicio_estimada) return false;
        const dayStr = format(new Date(serie.hora_inicio_estimada), 'yyyy-MM-dd');
        return dayStr === selectedDay;
      }).map(serie => {
        // Filter swimmers by search query
        const q = searchQuery.toLowerCase();
        const filteredNadadores = serie.nadadores.filter(n => 
          n.nombre.toLowerCase().includes(q) || 
          n.apellido.toLowerCase().includes(q) || 
          n.club.toLowerCase().includes(q)
        );
        return { ...serie, nadadores: filteredNadadores };
      }).filter(serie => serie.nadadores.length > 0 || searchQuery === ''); // Only keep series with matching swimmers if searching

      return { ...evento, series: filteredSeries };
    }).filter(evento => evento.series.length > 0); // Only keep events with matching series
  }, [selectedCampeonato, selectedDay, searchQuery]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-8 text-center drop-shadow-sm">
        Competiciones en Vivo
      </h1>
      
      {/* SECCION 1: FAVORITOS */}
      {user && favorites.length > 0 && (
        <div className="mb-12 p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-xl border border-indigo-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
            ⭐ Próximas Competencias de tus Favoritos
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.filter(f => f.evento.estado !== 'FINALIZADO').map((fav, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                <p className="font-bold text-gray-900 dark:text-white text-lg truncate">
                  {fav.nadador.nombre} {fav.nadador.apellido}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Evento #{fav.evento.numero_evento}</span> - Serie #{fav.serie.numero_serie}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate" title={fav.campeonato?.nombre}>
                    {fav.campeonato?.nombre}
                  </p>
                </div>
                <div className="mt-4 inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-bold w-full text-center">
                  ⏳ {renderCountdown(fav.serie.hora_inicio_estimada)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCION 2: TODOS LOS EVENTOS */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        
        {/* Filtros */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <select 
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium"
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
            >
              {campeonatos.length === 0 && <option value="">No hay campeonatos</option>}
              {campeonatos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            {days.length > 0 && (
              <select 
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <option value="">Todos los días</option>
                {days.map(d => (
                  <option key={d} value={d}>{format(parseISO(d), 'EEEE dd MMMM', { locale: es })}</option>
                ))}
              </select>
            )}
          </div>

          <div className="w-full md:w-auto flex-1 max-w-md">
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre de nadador o club..." 
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Eventos */}
        <div className="p-6 space-y-8">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No se encontraron eventos o nadadores con esos filtros.
            </div>
          ) : (
            filteredEvents.map((evento) => {
              const isEventFinished = evento.estado === 'FINALIZADO';
              const isEventOngoing = evento.estado === 'EN_CURSO';

              return (
                <div key={evento.id} className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
                  isEventFinished ? 'opacity-60 grayscale border-gray-200 dark:border-gray-700' :
                  isEventOngoing ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)] dark:border-green-500' :
                  'border-indigo-100 dark:border-gray-700 shadow-sm'
                }`}>
                  <div className={`p-4 flex justify-between items-center ${
                    isEventFinished ? 'bg-gray-100 dark:bg-gray-800' :
                    isEventOngoing ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : 
                    'bg-indigo-50 dark:bg-gray-800/80 text-indigo-900 dark:text-indigo-100'
                  }`}>
                    <h2 className="text-xl md:text-2xl font-bold">
                      Evento #{evento.numero_evento}: {evento.estilo} {evento.distancia}m ({evento.genero})
                    </h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isEventOngoing ? 'bg-white text-green-600' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {evento.estado}
                    </span>
                  </div>
                  
                  <div className="p-4 md:p-6 bg-white dark:bg-gray-900 grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                    {evento.series.map(serie => {
                      const serieTime = serie.hora_inicio_estimada ? new Date(serie.hora_inicio_estimada) : null;
                      const isSeriePast = serieTime && isPast(serieTime) && !isEventOngoing;
                      
                      return (
                        <div key={serie.id} className={`border rounded-xl p-4 transition-all ${
                          isSeriePast ? 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 opacity-70' :
                          isEventOngoing ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                          'bg-white border-gray-200 hover:shadow-md dark:bg-gray-800 dark:border-gray-600'
                        }`}>
                          <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-3">
                            <p className="font-bold text-lg text-gray-900 dark:text-white">Serie #{serie.numero_serie}</p>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              isSeriePast ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                              isEventOngoing ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 animate-pulse' :
                              'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                            }`}>
                              {serieTime ? format(serieTime, 'HH:mm', { locale: es }) : 'N/A'}
                            </span>
                          </div>
                          
                          <ul className="space-y-2">
                            {serie.nadadores.map(nadador => (
                              <li key={nadador.id} className="flex justify-between items-center group bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {nadador.nombre} {nadador.apellido}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <span className="truncate max-w-[100px]" title={nadador.club}>🏢 {nadador.club}</span>
                                    <span>⏱️ {nadador.tiempo_registro || 'S/T'}</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => toggleFavorite(nadador.id)}
                                  className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                                    isFavorite(nadador.id) 
                                      ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' 
                                      : 'text-gray-300 hover:text-yellow-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                  }`}
                                  title={isFavorite(nadador.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                                >
                                  <svg className="w-6 h-6" fill={isFavorite(nadador.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
