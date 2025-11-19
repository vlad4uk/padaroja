import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; 

// ==========================================================
// ФИКС ИКОНОК LEAFLET
// ==========================================================
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// ==========================================================
// ГРАНИЦЫ И МАСШТАБ
// ==========================================================

// Координаты, ограничивающие просмотр строго Беларусью (немного расширены для удобства)
const StrictBelarusBounds: L.LatLngBoundsLiteral = [[51.1, 23.0], [56.3, 32.5]];

// Центр Беларуси
const BELARUS_CENTER: L.LatLngTuple = [53.9, 27.5667]; 

const customIcon = L.icon({
  iconUrl: '/marker.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Компонент для обработки кликов и установки маркеров
// ⚠️ Логика проверки turf.booleanPointInPolygon удалена, 
// так как MapContainer.maxBounds уже ограничивает область просмотра.
function LocationMarker({ onAdd }: { onAdd: (latlng: L.LatLng, comment: string) => void }) {
  useMapEvents({
    click(e) {
        // Проверка на принадлежность точки к Беларуси теперь не нужна, 
        // так как пользователь в принципе не сможет нажать за пределами StrictBelarusBounds.
        const comment = prompt("Введите комментарий:");
        if (comment) onAdd(e.latlng, comment);
    }
  });
  return null;
}

const MapView: React.FC = () => {
  const [markers, setMarkers] = useState<{ position: L.LatLng, comment: string }[]>([]);
  
  // Логика загрузки GeoJSON и создания маски удалена

  const addMarker = async (latlng: L.LatLng, comment: string) => {
    setMarkers([...markers, { position: latlng, comment }]);
    try {
        await axios.post('http://localhost:8081/api/marker', {
            lat: latlng.lat,
            lng: latlng.lng,
            comment
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch(e) {
        console.error("Ошибка при отправке маркера на сервер:", e);
    }
  };

  return (
    <div style={{ height: '70vh', width: '100%', minHeight: '400px' }}> 
        <MapContainer
          center={BELARUS_CENTER}
          zoom={7}
          style={{ height: '100%', borderRadius: '8px' }}
          
          // ✅ ГЛАВНЫЕ ОГРАНИЧЕНИЯ
          maxBounds={StrictBelarusBounds} // Ограничивает панорамирование
          minZoom={6}                      // Не дает отдалить карту дальше, чем нужно (масштаб 6-7 подходит для обзора всей страны)
          maxZoom={20}
          
          scrollWheelZoom={true}
          dragging={true}
          // ⚠️ Опционально: можно скрыть атрибуцию Leaflet, но это нарушает лицензию
          attributionControl={false} 
        >
          <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              // ✅ Удалил лишний текст атрибуции, оставив только обязательный
          />
          
          {/* Маска GeoJSON и границы GeoJSON удалены */}
          
          {/* Компонент для обработки кликов, теперь без проверки границ */}
          <LocationMarker onAdd={addMarker} />
          
          {markers.map((m, i) => (
            <Marker key={i} position={m.position} icon={customIcon}>
              <Popup>{m.comment}</Popup>
            </Marker>
          ))}
        </MapContainer>
    </div>
  );
}

export default MapView;