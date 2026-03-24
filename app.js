const statusEl = document.getElementById('status');
const deviceBody = document.getElementById('deviceBody');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const fileInput = document.getElementById('fileInput');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const dayList = document.getElementById('dayList');
const deviceFilter = document.getElementById('deviceFilter');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const mapMethodSelect = document.getElementById('mapMethod');

const statDevices = document.getElementById('statDevices');
const statLocations = document.getElementById('statLocations');
const statObservations = document.getElementById('statObservations');
const statRssi = document.getElementById('statRssi');
const statDays = document.getElementById('statDays');
const statHotspot = document.getElementById('statHotspot');

const THEME_STORAGE_KEY = 'ble-scanner-theme';

const sampleData = {
  device: [
    { id: 1, mac: 'C6:1A:AF:19:01:00', name: 'Tracker A', tag: 'office', rssi: -58 },
    { id: 2, mac: 'D3:4B:91:AA:99:11', name: 'Phone B', tag: 'visitor', rssi: -73 },
    { id: 3, mac: 'E1:29:44:12:67:FE', name: 'Headset C', tag: 'unknown', rssi: -66 }
  ],
  location: [
    { id: 101, latitude: 52.5208, longitude: 13.4095, observed_at: 1713420210 },
    { id: 102, latitude: 52.5206, longitude: 13.41, observed_at: 1713506710 },
    { id: 103, latitude: 52.521, longitude: 13.4088, observed_at: 1713593210 },
    { id: 104, latitude: 52.5194, longitude: 13.4061, observed_at: 1713679710 },
    { id: 105, latitude: 52.5179, longitude: 13.4011, observed_at: 1713766210 },
    { id: 106, latitude: 52.5304, longitude: 13.3838, observed_at: 1713852710 }
  ],
  device_to_location: [
    { device_id: 1, location_id: 101 },
    { device_id: 1, location_id: 102 },
    { device_id: 1, location_id: 104 },
    { device_id: 2, location_id: 103 },
    { device_id: 2, location_id: 106 },
    { device_id: 3, location_id: 104 },
    { device_id: 3, location_id: 105 }
  ]
};

let dataset = null;

const updateStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#b91c1c' : '';
};

const setThemeLabel = (theme) => {
  themeToggleBtn.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
};

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  setThemeLabel(theme);
};

const getPreferredTheme = () => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const toggleTheme = () => {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
};

const formatDate = (unixSeconds) => {
  if (!unixSeconds) return '-';
  return new Date(unixSeconds * 1000).toLocaleString('de-DE');
};

const toDayKey = (unixSeconds) => {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
};

const formatDistance = (km) => {
  if (!Number.isFinite(km)) return '-';
  return `${km.toFixed(2)} km`;
};

const validateDataset = (data) => {
  const keys = ['device', 'location', 'device_to_location'];
  return keys.every((key) => Array.isArray(data[key]));
};

const getLocationMap = () => new Map(dataset.location.map((l) => [l.id, l]));

const getDeviceSeries = () => {
  const locationMap = getLocationMap();
  const series = new Map();

  for (const link of dataset.device_to_location) {
    const location = locationMap.get(link.location_id);
    if (!location) continue;
    const list = series.get(link.device_id) ?? [];
    list.push(location);
    series.set(link.device_id, list);
  }

  for (const list of series.values()) {
    list.sort((a, b) => (a.observed_at || 0) - (b.observed_at || 0));
  }

  return series;
};

const getSelectedDeviceId = () => {
  const raw = Number(deviceFilter.value);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
};

const getFilteredLocations = () => {
  if (!dataset) return [];

  const selectedDevice = getSelectedDeviceId();
  const fromDay = fromDateInput.value || null;
  const toDay = toDateInput.value || null;
  const deviceSeries = getDeviceSeries();

  const entries = selectedDevice
    ? (deviceSeries.get(selectedDevice) ?? []).map((location) => ({ device_id: selectedDevice, location }))
    : [...deviceSeries.entries()].flatMap(([deviceId, locations]) =>
        locations.map((location) => ({ device_id: deviceId, location }))
      );

  return entries.filter(({ location }) => {
    const day = toDayKey(location.observed_at);
    if (fromDay && day < fromDay) return false;
    if (toDay && day > toDay) return false;
    return true;
  });
};

const projectPoints = (items) => {
  const lats = items.map((entry) => Number(entry.location.latitude));
  const lngs = items.map((entry) => Number(entry.location.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return items.map((entry) => {
    const lat = Number(entry.location.latitude);
    const lng = Number(entry.location.longitude);
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * (canvas.width - 50) + 25;
    const y = canvas.height - (((lat - minLat) / (maxLat - minLat || 1)) * (canvas.height - 50) + 25);
    return { ...entry, x, y };
  });
};

const drawRouteLines = (projected) => {
  const grouped = new Map();
  for (const entry of projected) {
    const arr = grouped.get(entry.device_id) ?? [];
    arr.push(entry);
    grouped.set(entry.device_id, arr);
  }

  for (const arr of grouped.values()) {
    arr.sort((a, b) => (a.location.observed_at || 0) - (b.location.observed_at || 0));
    if (arr.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 2;
    arr.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }
};

const dayColor = (day) => {
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) {
    hash = day.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 56%)`;
};

const drawMap = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const filtered = getFilteredLocations();

  if (filtered.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Keine Positionsdaten für die gewählten Filter.', 16, 24);
    return;
  }

  const projected = projectPoints(filtered);
  const method = mapMethodSelect.value;

  if (method === 'route') {
    drawRouteLines(projected);
  }

  if (method === 'heat') {
    const bucket = new Map();
    for (const point of projected) {
      const key = `${point.location.latitude.toFixed(4)}:${point.location.longitude.toFixed(4)}`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }

    for (const point of projected) {
      const key = `${point.location.latitude.toFixed(4)}:${point.location.longitude.toFixed(4)}`;
      const count = bucket.get(key) ?? 1;
      const radius = 4 + Math.min(count, 12);
      const alpha = Math.min(0.15 + count * 0.12, 0.95);
      ctx.beginPath();
      ctx.fillStyle = `rgba(15, 118, 110, ${alpha})`;
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  for (const point of projected) {
    const day = toDayKey(point.location.observed_at);
    ctx.beginPath();
    ctx.fillStyle = dayColor(day);
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.stroke();
  }
};

const calcDistanceKm = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(Number(b.latitude) - Number(a.latitude));
  const dLon = toRad(Number(b.longitude) - Number(a.longitude));
  const lat1 = toRad(Number(a.latitude));
  const lat2 = toRad(Number(b.latitude));

  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

const traveledDistanceByDevice = () => {
  const series = getDeviceSeries();
  const result = new Map();

  for (const [deviceId, locations] of series.entries()) {
    let total = 0;
    for (let i = 1; i < locations.length; i += 1) {
      total += calcDistanceKm(locations[i - 1], locations[i]);
    }
    result.set(deviceId, total);
  }

  return result;
};

const dominantHotspot = () => {
  if (!dataset || dataset.location.length === 0) return '-';
  const bucket = new Map();

  for (const point of dataset.location) {
    const key = `${Number(point.latitude).toFixed(4)}, ${Number(point.longitude).toFixed(4)}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  let topKey = '-';
  let topCount = 0;
  for (const [key, count] of bucket.entries()) {
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }

  return `${topKey} (${topCount}x)`;
};

const renderStats = () => {
  const totalRssi = dataset.device.reduce((sum, d) => sum + (Number(d.rssi) || 0), 0);
  const avgRssi = dataset.device.length ? Math.round(totalRssi / dataset.device.length) : null;
  const dayCount = new Set(dataset.location.map((location) => toDayKey(location.observed_at))).size;

  statDevices.textContent = String(dataset.device.length);
  statLocations.textContent = String(dataset.location.length);
  statObservations.textContent = String(dataset.device_to_location.length);
  statRssi.textContent = avgRssi === null ? '-' : `${avgRssi} dBm`;
  statDays.textContent = String(dayCount);
  statHotspot.textContent = dominantHotspot();
};

const observationCountByDevice = () => {
  const map = new Map();
  for (const row of dataset.device_to_location) {
    map.set(row.device_id, (map.get(row.device_id) ?? 0) + 1);
  }
  return map;
};

const latestLocationByDevice = () => {
  const locationMap = getLocationMap();
  const result = new Map();
  for (const link of dataset.device_to_location) {
    const location = locationMap.get(link.location_id);
    if (!location) continue;
    const current = result.get(link.device_id);
    if (!current || (location.observed_at || 0) > (current.observed_at || 0)) {
      result.set(link.device_id, location);
    }
  }
  return result;
};

const renderDayList = () => {
  const filtered = getFilteredLocations();
  const grouped = new Map();

  for (const entry of filtered) {
    const day = toDayKey(entry.location.observed_at);
    grouped.set(day, (grouped.get(day) ?? 0) + 1);
  }

  const rows = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${day}</strong><br/><span>${count} Detektionen</span>`;
      return li;
    });

  if (rows.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Keine Detektionen für den Filterbereich.';
    dayList.replaceChildren(li);
    return;
  }

  dayList.replaceChildren(...rows);
};

const renderDeviceFilter = () => {
  const options = [
    '<option value="0">Alle Geräte</option>',
    ...dataset.device.map((device) => `<option value="${device.id}">${device.name || device.mac || device.id}</option>`)
  ];
  deviceFilter.innerHTML = options.join('');
};

const renderDevices = () => {
  const search = searchInput.value.trim().toLowerCase();
  const counts = observationCountByDevice();
  const latestMap = latestLocationByDevice();
  const distances = traveledDistanceByDevice();

  const rows = dataset.device
    .filter((device) => {
      if (!search) return true;
      return [device.name, device.mac, device.tag].some((v) => String(v ?? '').toLowerCase().includes(search));
    })
    .map((device) => {
      const tr = document.createElement('tr');
      const lastSeen = latestMap.get(device.id)?.observed_at;

      tr.innerHTML = `
        <td>${device.mac ?? '-'}</td>
        <td><input type="text" data-id="${device.id}" data-field="name" value="${device.name ?? ''}" /></td>
        <td><input type="text" data-id="${device.id}" data-field="tag" value="${device.tag ?? ''}" /></td>
        <td>${counts.get(device.id) ?? 0}</td>
        <td>${formatDate(lastSeen)}</td>
        <td>${formatDistance(distances.get(device.id))}</td>
      `;
      return tr;
    });

  deviceBody.replaceChildren(...rows);
};

const renderAll = () => {
  renderStats();
  renderDeviceFilter();
  renderDevices();
  renderDayList();
  drawMap();
  exportBtn.disabled = false;
};

const setDataset = (data, sourceLabel) => {
  if (!validateDataset(data)) {
    updateStatus('Datei ist ungültig: Erwartet Arrays device/location/device_to_location.', true);
    return;
  }

  dataset = structuredClone(data);
  renderAll();
  updateStatus(`Daten geladen (${sourceLabel}): ${dataset.device.length} Geräte, ${dataset.location.length} Positionen.`);
};

const rerenderMapOnly = () => {
  if (!dataset) return;
  renderDayList();
  drawMap();
};

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    setDataset(data, file.name);
  } catch {
    updateStatus('Datei konnte nicht gelesen werden. Bitte valides JSON verwenden.', true);
  }
});

loadSampleBtn.addEventListener('click', () => setDataset(sampleData, 'Beispieldaten'));

searchInput.addEventListener('input', () => {
  if (dataset) renderDevices();
});

deviceBody.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !dataset) return;

  const id = Number(input.dataset.id);
  const field = input.dataset.field;
  const device = dataset.device.find((d) => d.id === id);
  if (!device || !field) return;
  device[field] = input.value;
  renderDeviceFilter();
});

[deviceFilter, fromDateInput, toDateInput, mapMethodSelect].forEach((element) => {
  element.addEventListener('input', rerenderMapOnly);
});

exportBtn.addEventListener('click', () => {
  if (!dataset) return;
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ble-scanner-companion-export.json';
  link.click();
  URL.revokeObjectURL(url);
  updateStatus('Export erstellt.');
});

themeToggleBtn.addEventListener('click', toggleTheme);

applyTheme(getPreferredTheme());
updateStatus('Noch keine Daten geladen. Nutze die Beispieldaten oder importiere JSON.');
drawMap();
