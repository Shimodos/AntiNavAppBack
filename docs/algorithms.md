# Алгоритмы маршрутизации

## 1. Генерация "случайного" маршрута

### Входные параметры:
- `origin` - точка старта [lat, lng]
- `destination` - точка финиша [lat, lng]
- `maxDistance` - максимальная допустимая длина маршрута (км)
- `adventureLevel` - уровень "приключения" от 0 до 1
  - 0 = кратчайший маршрут
  - 1 = максимум интересных мест
- `poiCategories` - категории интересных мест для поиска
- `avoidHighways` - избегать магистралей (опционально)

### Алгоритм:

```
1. Получить базовый (кратчайший) маршрут через Valhalla
   baseRoute = valhalla.route(origin, destination)
   baseDistance = baseRoute.distance

2. Вычислить допустимое отклонение
   maxDetour = maxDistance - baseDistance
   если maxDetour <= 0, вернуть baseRoute

3. Создать коридор поиска POI
   - Построить буферную зону вокруг прямой линии origin → destination
   - Ширина буфера зависит от adventureLevel и maxDetour
   - corridorWidth = baseDistance * adventureLevel * 0.3 (примерно)

4. Найти POI в коридоре
   pois = poiService.findInPolygon(corridor, poiCategories)
   
5. Оценить POI
   Для каждого POI вычислить score на основе:
   - Рейтинг/популярность места
   - Уникальность (редкая категория = выше)
   - Расстояние от прямой линии маршрута
   - Кластеризация (бонус если рядом несколько POI)

6. Выбрать waypoints
   - Отсортировать POI по score
   - Жадно добавлять POI как waypoints, проверяя что:
     a) Новый маршрут не превышает maxDistance
     b) POI не слишком близко к уже выбранным (минимум 2км между waypoints)
   - Остановиться когда достигнут лимит или нет подходящих POI

7. Построить финальный маршрут
   finalRoute = valhalla.route(origin, waypoints..., destination)
   
8. Вернуть маршрут с метаданными POI
```

### Оптимизация порядка waypoints:

Когда выбрано N waypoints, нужно определить оптимальный порядок посещения.
Это вариация задачи коммивояжёра, но для малого N (обычно < 10) можно:
- Использовать Valhalla optimized_route API
- Или простой greedy по расстоянию от текущей точки

## 2. Рекомендации в пути (Live Recommendations)

### Входные параметры:
- `currentLocation` - текущая позиция пользователя
- `currentRoute` - активный маршрут
- `deviationRadius` - максимальный радиус отклонения (метры)
- `userPreferences` - предпочтения пользователя

### Алгоритм:

```
1. Определить "окно интереса"
   - Взять сегмент маршрута: от текущей позиции + 5-10 км вперёд
   - Построить буфер шириной deviationRadius вокруг сегмента

2. Найти POI в окне
   pois = poiService.findInPolygon(window, userPreferences.categories)
   
3. Отфильтровать уже показанные
   pois = pois.filter(poi => !shownPois.includes(poi.id))

4. Для каждого POI вычислить:
   - detourDistance: насколько увеличится маршрут если заехать
   - detourTime: дополнительное время
   - relevanceScore: соответствие предпочтениям
   
5. Отфильтровать по ограничениям
   pois = pois.filter(poi => 
     poi.detourDistance <= deviationRadius * 2 &&
     poi.detourTime <= maxDetourTime
   )

6. Ранжировать и выбрать топ-N для показа
   Факторы ранжирования:
   - relevanceScore (вес 0.4)
   - 1 / detourDistance (вес 0.3) - ближе = лучше
   - poi.rating (вес 0.2)
   - временной фактор (вес 0.1) - кафе в обед, музеи днём

7. Отправить уведомление с лучшим POI
   Cooldown между уведомлениями: минимум 10-15 минут
```

## 3. Геофенсинг для уведомлений

Вместо постоянного polling можно использовать геофенсы:

```
1. При построении маршрута:
   - Определить потенциальные точки интереса вдоль маршрута
   - Создать геофенсы радиусом ~500м перед каждой точкой

2. Когда пользователь входит в геофенс:
   - Проверить актуальность POI
   - Показать уведомление если релевантно

3. Преимущества:
   - Меньше нагрузка на батарею
   - Не нужен постоянный GPS polling
   - Работает в фоне на iOS/Android
```

## 4. Коридор поиска (детали)

### Построение буферного полигона:

```typescript
function buildSearchCorridor(
  origin: [number, number],
  destination: [number, number],
  width: number // в метрах
): GeoJSON.Polygon {
  // 1. Создать LineString от origin до destination
  const line = turf.lineString([origin, destination]);
  
  // 2. Построить буфер
  const corridor = turf.buffer(line, width, { units: 'meters' });
  
  // 3. Опционально: расширить буфер в начале и конце
  // (чтобы захватить POI рядом со стартом/финишем)
  
  return corridor;
}
```

### Адаптивная ширина коридора:

Ширина может зависеть от:
- Длины маршрута (длиннее = шире коридор в абсолютных значениях)
- Плотности POI в регионе (меньше POI = шире коридор)
- adventureLevel пользователя

```typescript
function calculateCorridorWidth(
  baseDistance: number,    // км
  adventureLevel: number,  // 0-1
  poiDensity: number      // POI на км²
): number {
  const baseWidth = Math.min(baseDistance * 0.1, 20); // км, макс 20км
  const adventureFactor = 0.5 + adventureLevel * 0.5; // 0.5 - 1.0
  const densityFactor = poiDensity < 1 ? 1.5 : 1.0;   // расширить если мало POI
  
  return baseWidth * adventureFactor * densityFactor * 1000; // в метрах
}
```

## 5. Кэширование и производительность

### POI кэш:
- Разбить мир на тайлы (например, geohash precision 5)
- Кэшировать POI по тайлам в Redis
- TTL: 24 часа для статичных данных (музеи), 1 час для динамичных (кафе)

### Маршруты:
- Кэшировать базовые маршруты между популярными точками
- Не кэшировать кастомизированные маршруты (слишком много вариаций)

### Предзагрузка:
- При старте навигации предзагрузить POI для первых 20км маршрута
- Подгружать следующие сегменты по мере движения
