const statusEl = document.getElementById('status');
const deviceBody = document.getElementById('deviceBody');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const fileInput = document.getElementById('fileInput');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

const statDevices = document.getElementById('statDevices');
const statLocations = document.getElementById('statLocations');
const statObservations = document.getElementById('statObservations');
const statRssi = document.getElementById('statRssi');

const THEME_STORAGE_KEY = 'ble-scanner-theme';

const sampleData = {
  device: [
    { id: 1, mac: 'C6:1A:AF:19:01:00', name: 'Tracker A', tag: 'office', rssi: -58 },
    { id: 2, mac: 'D3:4B:91:AA:99:11', name: 'Phone B', tag: 'visitor', rssi: -73 },
    { id: 3, mac: 'E1:29:44:12:67:FE', name: 'Headset C', tag: 'unknown', rssi: -66 }
  ],
  location: [
    { id: 101, latitude: 52.5208, longitude: 13.4095, observed_at: 1713420210 },
    { id: 102, latitude: 52.5206, longitude: 13.41, observed_at: 1713420310 },
    { id: 103, latitude: 52.521, longitude: 13.4088, observed_at: 1713420410 },
    { id: 104, latitude: 52.5209, longitude: 13.4097, observed_at: 1713420510 }
  ],
  device_to_location: [
    { device_id: 1, location_id: 101 },
    { device_id: 1, location_id: 102 },
    { device_id: 2, location_id: 103 },
    { device_id: 2, location_id: 104 },
    { device_id: 3, location_id: 104 }
  ]
};

let dataset = null;

const updateStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#b91c1c' : '';
};

const setThemeLabel = (theme) => {
  if (!themeToggleBtn) return;
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

const validateDataset = (data) => {
  const keys = ['device', 'location', 'device_to_location'];
  return keys.every((key) => Array.isArray(data[key]));
};

const drawHeatmap = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!dataset || dataset.location.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Keine Positionsdaten vorhanden.', 16, 24);
    return;
  }

  const lats = dataset.location.map((l) => Number(l.latitude));
  const lngs = dataset.location.map((l) => Number(l.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const bucket = new Map();
  for (const point of dataset.location) {
    const key = `${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  for (const [key, count] of bucket.entries()) {
    const [lat, lng] = key.split(':').map(Number);
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - (((lat - minLat) / (maxLat - minLat || 1)) * (canvas.height - 40) + 20);
    const radius = 4 + Math.min(count, 12);
    const alpha = Math.min(0.15 + count * 0.15, 0.95);

    ctx.beginPath();
    ctx.fillStyle = `rgba(15, 118, 110, ${alpha})`;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

const renderStats = () => {
  const totalRssi = dataset.device.reduce((sum, d) => sum + (Number(d.rssi) || 0), 0);
  const avgRssi = dataset.device.length ? Math.round(totalRssi / dataset.device.length) : null;

  statDevices.textContent = String(dataset.device.length);
  statLocations.textContent = String(dataset.location.length);
  statObservations.textContent = String(dataset.device_to_location.length);
  statRssi.textContent = avgRssi === null ? '-' : `${avgRssi} dBm`;
};

const observationCountByDevice = () => {
  const map = new Map();
  for (const row of dataset.device_to_location) {
    map.set(row.device_id, (map.get(row.device_id) ?? 0) + 1);
  }
  return map;
};

const latestLocationByDevice = () => {
  const locationMap = new Map(dataset.location.map((l) => [l.id, l]));
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

const renderDevices = () => {
  const search = searchInput.value.trim().toLowerCase();
  const counts = observationCountByDevice();
  const latestMap = latestLocationByDevice();

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
      `;
      return tr;
    });

  deviceBody.replaceChildren(...rows);
};

const renderAll = () => {
  renderStats();
  renderDevices();
  drawHeatmap();
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

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

applyTheme(getPreferredTheme());
updateStatus('Noch keine Daten geladen. Nutze die Beispieldaten oder importiere JSON.');
drawHeatmap();
