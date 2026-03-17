# MetaRadar Repository Analysis & React/Tailwind Web-App Proposal

## 1) Quick technical analysis of MetaRadar (Android)

MetaRadar is an Android-first BLE analysis app (Kotlin + Room + Compose), with the core value in **offline BLE scan analytics**, **profile-based detection**, and **location-linked observations**.

### 1.1 Current architecture (high level)
- **Data layer**: Room database with DAOs/repositories for devices, locations, profiles, tags, journal entries.
- **Domain/interactors**: use-case classes for backup/restore, profile checks, filtering, scanning workflows.
- **UI layer**: Jetpack Compose screens + osmdroid map integration.
- **Persistence behavior**: backup/restore of SQLite DB already exists in app logic.

### 1.2 Relevant database model for a web editor/analytics app
The latest Room schema version is **19** and includes these core tables:
- `device`
- `location`
- `device_to_location`
- `radar_profile`
- `profile_detect`
- `tag`
- `journal`
- `apple_contacts`

For your web use-case (“load database, edit data, analyze map/heatmap”), the most important joins are:
- **device ↔ device_to_location ↔ location** for trajectory/heatmap.
- **radar_profile ↔ profile_detect ↔ location** for profile-trigger events on map.
- **device tags / metadata / raw data** for quick data cleanup/enrichment workflows.

### 1.3 Product capabilities you can transfer to web
- Fast list/table analytics (devices, counts, first/last seen, RSSI trends).
- Geospatial exploration of detections (points, clusters, heatmap layers).
- Rule/profile inspection and event timelines.
- Data curation: rename, tag management, metadata corrections, deduplication.
- Import/export workflows around SQLite backup files.

---

## 2) Proposed target: React + Tailwind + embeddable component strategy

Your stated goal has two levels:
1. Build a standalone React web app for analysis/editing.
2. Make it reusable later as an embeddable component/module in other React apps.

The best way is a **monorepo split from day one**:

- `apps/metaradar-web` → full product app (routing, auth optional, shell, pages).
- `packages/metaradar-core` → domain logic + SQLite parsing + query adapters.
- `packages/metaradar-ui` → reusable React components (Tailwind-styled).
- `packages/metaradar-map` → map + heatmap abstractions.

This prevents lock-in to one app and keeps your future “drop into other React apps” path clean.

---

## 3) Recommended stack

### 3.1 Foundation
- **React + TypeScript**
- **Vite** (fast, simple build)
- **TailwindCSS** (+ optional shadcn/ui or headless primitives)
- **TanStack Query** for async data state
- **Zustand** or Redux Toolkit for cross-page UI state

### 3.2 Database in browser
For loading Android SQLite backups directly in browser:
- **sql.js** (SQLite compiled to WASM), or
- **wa-sqlite** (alternative WASM SQLite)

This allows fully local/offline analysis in browser (aligned with MetaRadar’s privacy approach).

### 3.3 Maps + heatmaps
- **MapLibre GL JS** (open-source map rendering) or **Leaflet** (lighter)
- Heatmap options:
  - `maplibre-gl-heatmap-layer` style expressions, or
  - `leaflet.heat` if using Leaflet

For large datasets, add clustering and serverless preprocessing in web worker.

### 3.4 Data table & editing UX
- **TanStack Table** with virtualization
- Inline editing patterns (cell editors + optimistic updates)
- Bulk edit operations (tag add/remove, favorite flags, metadata patch)

---

## 4) Data contract proposal (important for reuse)

Define a stable TypeScript contract in `metaradar-core` independent of UI:

- `DeviceRecord`
- `LocationRecord`
- `DeviceLocationRecord`
- `RadarProfileRecord`
- `ProfileDetectRecord`
- `TagRecord`

Then implement adapters:
- `fromSqliteV19(db) => MetaRadarDataset`
- future: `fromSqliteV20(...)`

This versioned adapter approach protects you against Android schema migrations.

---

## 5) Functional roadmap (incremental)

### Phase 1 — MVP (2–4 weeks)
- Import `.db` / backup SQLite file.
- Parse key tables (`device`, `location`, `device_to_location`, `tag`).
- Device list with search/filter/sort.
- Basic map with points + heatmap.
- Save edited dataset as new SQLite export.

### Phase 2 — Analyst features
- Profile events overlay (`profile_detect`).
- Timeline playback (time slider).
- Device detail drill-down (history, route, metadata/raw payload view).
- Bulk editor for tags/custom names/favorites.

### Phase 3 — Embeddable package quality
- Public component API (`<MetaRadarExplorer />`, `<DeviceTable />`, `<HeatmapPanel />`).
- Theme API + i18n support.
- Host-app callbacks (`onRecordChange`, `onExport`, `onSelectionChange`).
- npm package release + semantic versioning.

---

## 6) Suggested package API for embedding

Example direction:

```tsx
<MetaRadarExplorer
  source={{ type: 'sqlite-file', file }}
  features={{ heatmap: true, editor: true, profiles: true }}
  onExport={(blob) => download(blob, 'metaradar-edited.db')}
  onError={(e) => console.error(e)}
/>
```

And lower-level composables:
- `<MetaRadarProvider />`
- `<DeviceTable />`
- `<MapHeatLayer />`
- `<ProfileDetectTimeline />`

This gives both “all-in-one widget” and “lego blocks” integration modes.

---

## 7) Risks & mitigations

### Risk A: SQLite schema changes in Android app
- Mitigation: versioned adapters + compatibility tests against exported schema snapshots.

### Risk B: Performance with large location logs
- Mitigation: web workers, viewport-based queries, tiling/binning, virtualization.

### Risk C: Sensitive data handling
- Mitigation: default local-only processing; no mandatory backend.

### Risk D: Data corruption on save
- Mitigation: immutable edit session + “export copy” strategy instead of in-place overwrite.

---

## 8) Concrete next implementation step (recommended)

Start with a **technical spike** repository (or branch) that proves these 3 things end-to-end:
1. Load a real MetaRadar SQLite file in browser via WASM SQLite.
2. Execute joins for `device + device_to_location + location`.
3. Render a map heat layer and editable device table.

If those 3 are stable, the rest is mostly productization.

---

## 9) Suggested directory structure for your future monorepo

```txt
metaradar-web-suite/
  apps/
    metaradar-web/
  packages/
    metaradar-core/
      src/adapters/sqlite-v19/
      src/domain/
      src/query/
    metaradar-ui/
      src/components/
      src/theme/
    metaradar-map/
      src/layers/
      src/hooks/
```

---

## 10) Bottom line

Yes — your plan is very feasible.

If you design it as **core data engine + reusable UI packages** from the start, you can:
- deliver a useful analyst web app quickly, and
- later embed the same functionality into any React product with minimal rewrite.
