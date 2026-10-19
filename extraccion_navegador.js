/*
 * extraccion_navegador.js — extracción de la muestra usada en el análisis (corrida del 18-10-2026)
 * ---------------------------------------------------------------------------------------------
 * Alternativa al notebook 01 (Earth Engine) que NO requiere cuenta: lee por ventanas los
 * GeoTIFF optimizados para la nube (COG) públicos de MapBiomas Chile con geotiff.js.
 *
 *  - Cobertura y Uso del Suelo, Colección 1 (2005-2022):
 *      gs://mapbiomas-public/initiatives/chile/coverage/chile_coverage_{AÑO}.tif
 *  - MapBiomas Fuego, Colección 1, área quemada anual (2013-2025):
 *      gs://mapbiomas-public/initiatives/chile/fire/collection1/annual_burned_v1/...
 *  - Elevación: AWS Terrain Tiles (formato terrarium, zoom 11, ~60-75 m)
 *
 * Cómo usarlo: abrir https://storage.googleapis.com/mapbiomas-public/ en Chrome, pegar este
 * script en la consola (F12) y ejecutar `await correr()`. Al final se descargan
 * muestra_mapbiomas_col1.csv, areas_quemadas.csv y extraccion_meta.json.
 *
 * Diseño de la muestra:
 *  - Zona de estudio: lon -73.8 a -70.0, lat -32.0 a -39.6 (Valparaíso a La Araucanía).
 *  - Grilla de ventanas de 1024 x 1024 píxeles (~30 x 28 km) alineada a la grilla de Fuego.
 *  - Se procesan todas las ventanas con área quemada entre 2014 y 2021 (escaneo previo a 1/8).
 *  - En cada ventana, con cobertura 2012 en {3 bosque, 66 matorral, 12 pastizal, 9 silvicultura}:
 *      tratados  = primer incendio entre 2014 y 2021 -> hasta 400 al azar
 *      controles = nunca quemado entre 2013 y 2025   -> hasta 800 al azar
 *    w_muestral = (elegibles en la ventana) / (muestreados): hectáreas-píxel que representa cada uno.
 *  - Covariables: elevación, pendiente, orientación; distancias (transformada chamfer 3-4, dentro de
 *    la ventana) a infraestructura (24), mosaico de usos (21) y silvicultura (9) en 2012.
 */
const G = await import("https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm");
const B = location.origin + "/mapbiomas-public/initiatives/chile/";
const r = 0.0002694945852358564, FX0 = -74.8488871142363, FY0 = -32.01972965021305;
const DX = 14307, DY = 61517;                 // desfase exacto grilla Fuego -> grilla Cobertura
const YL0 = 2005, YL1 = 2022, YF0 = 2013, YF1 = 2025, C0 = 2014, C1 = 2021;
const ELIG = new Set([3, 66, 12, 9]);
const fireURL = (y) => `${B}fire/collection1/annual_burned_v1/mapbiomas_fire_chile_col1_annual_burned_${y}.tif`;
const covURL = (y) => `${B}coverage/chile_coverage_${y}.tif`;

const cache = {};
const tif = (u) => (cache[u] ??= G.fromUrl(u));
async function read(u, win) { const [a] = await (await tif(u)).readRasters({ window: win }); return a; }

// ---------- 1. Escaneo a baja resolución para elegir ventanas ----------
async function escanear() {
  const X0 = Math.floor((-73.8 - FX0) / r / 1024) * 1024, X1 = Math.ceil((-70.0 - FX0) / r / 1024) * 1024;
  const Y0 = 0, Y1 = Math.ceil((39.6 + FY0) / r / 1024) * 1024;
  const nwx = (X1 - X0) / 1024, nwy = (Y1 - Y0) / 1024, f = 8, wpx = 1024 / f;
  const counts = {};
  for (let y = YF0; y <= YF1; y++) {
    const im = await (await tif(fireURL(y))).getImage(3);
    const [a] = await im.readRasters({ window: [X0 / f, Y0 / f, X1 / f, Y1 / f] });
    const W = (X1 - X0) / f, c = new Array(nwx * nwy).fill(0);
    for (let i = 0; i < a.length; i++) if (a[i] > 0) c[(((i / W) | 0) / wpx | 0) * nwx + ((i % W) / wpx | 0)]++;
    counts[y] = c;
  }
  return { X0, X1, Y0, Y1, nwx, nwy, counts };
}

// ---------- utilidades ----------
function dist(mask, W, H) {                    // chamfer 3-4; resultado*10 = metros (píxel 30 m)
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let v = d[i]; if (!v) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - W] + 3); if (x > 0) v = Math.min(v, d[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
    d[i] = v; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let v = d[i]; if (!v) continue;
    if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (x > 0) v = Math.min(v, d[i + W - 1] + 4); }
    d[i] = v; }
  return d;
}
const demCache = {};
function demTile(z, x, y) {
  const k = `${z}/${x}/${y}`;
  return (demCache[k] ??= (async () => {
    const bm = await createImageBitmap(await (await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`)).blob());
    const c = new OffscreenCanvas(256, 256), g = c.getContext("2d"); g.drawImage(bm, 0, 0);
    const d = g.getImageData(0, 0, 256, 256).data, e = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) e[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    return e; })());
}
async function elev(lon, lat) {
  const z = 11, n = 2 ** z, fx = (lon + 180) / 360 * n;
  const fy = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const px = Math.min(255, Math.max(0, Math.floor((fx - tx) * 256))), py = Math.min(255, Math.max(0, Math.floor((fy - ty) * 256)));
  return (await demTile(z, tx, ty))[py * 256 + px];
}
async function terreno(lon, lat) {
  const h = 0.0007;
  const [c, e, w, nn, s] = await Promise.all([elev(lon, lat), elev(lon + h, lat), elev(lon - h, lat), elev(lon, lat + h), elev(lon, lat - h)]);
  const mx = h * 111320 * Math.cos(lat * Math.PI / 180), my = h * 110574;
  const dzdx = (e - w) / (2 * mx), dzdy = (nn - s) / (2 * my);
  const slope = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
  let asp = Math.atan2(-dzdx, -dzdy) * 180 / Math.PI; if (asp < 0) asp += 360;
  return [Math.round(c), +slope.toFixed(2), Math.round(asp)];
}
function rnd(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- 2. Extracción de una ventana ----------
async function ventana(S, wi, NT = 400, NC = 800) {
  const wx = wi % S.nwx, wy = (wi / S.nwx) | 0, fx = S.X0 + wx * 1024, fy = S.Y0 + wy * 1024, W = 1024, N = W * W;
  const fwin = [fx, fy, fx + W, fy + W], cwin = [fx + DX, fy + DY, fx + DX + W, fy + DY + W];
  const ff = new Uint16Array(N), fc = new Uint8Array(N);
  const fires = await Promise.all(Array.from({ length: YF1 - YF0 + 1 }, (_, j) => read(fireURL(YF0 + j), fwin)));
  fires.forEach((a, j) => { for (let i = 0; i < N; i++) if (a[i] > 0) { fc[i]++; if (!ff[i]) ff[i] = YF0 + j; } });
  const lulc = await Promise.all(Array.from({ length: YL1 - YL0 + 1 }, (_, j) => read(covURL(YL0 + j), cwin)));
  const l12 = lulc[2012 - YL0];
  const dU = dist(l12.map(v => v === 24 ? 1 : 0), W, W), dA = dist(l12.map(v => v === 21 ? 1 : 0), W, W), dS = dist(l12.map(v => v === 9 ? 1 : 0), W, W);
  const trat = [], ctrl = [], nT = {};
  for (let i = 0; i < N; i++) { if (!ELIG.has(l12[i])) continue;
    if (ff[i] >= C0 && ff[i] <= C1) { trat.push(i); nT[ff[i]] = (nT[ff[i]] || 0) + 1; } else if (fc[i] === 0) ctrl.push(i); }
  const R = rnd(1000 + wi);
  const pick = (arr, k) => { if (arr.length <= k) return arr.slice(); const a = arr.slice();
    for (let i = 0; i < k; i++) { const j = i + Math.floor(R() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };
  const sT = pick(trat, NT), sC = pick(ctrl, NC);
  const wT = trat.length / Math.max(sT.length, 1), wC = ctrl.length / Math.max(sC.length, 1);
  const rows = [];
  for (const [arr, w] of [[sT, wT], [sC, wC]]) for (const i of arr) {
    const px = i % W, py = (i / W) | 0, lon = FX0 + (fx + px + 0.5) * r, lat = FY0 - (fy + py + 0.5) * r;
    rows.push([wi, "NA", +lon.toFixed(5), +lat.toFixed(5), ...lulc.map(a => a[i]), ff[i], fc[i], ...(await terreno(lon, lat)),
      Math.round(dU[i] * 10), Math.round(dA[i] * 10), Math.round(dS[i] * 10), +w.toFixed(3)]);
  }
  return { rows, nT };
}

// ---------- 3. Corrida completa ----------
async function correr() {
  const S = await escanear();
  const cum = new Array(S.nwx * S.nwy).fill(0);
  for (let y = C0; y <= C1; y++) S.counts[y].forEach((v, i) => cum[i] += v);
  const todo = cum.map((v, i) => [v, i]).filter(x => x[0] > 0).map(x => x[1]);
  const done = {}, err = {}; let k = 0;
  const worker = async () => { while (k < todo.length) { const wi = todo[k++];
    try { done[wi] = await ventana(S, wi); } catch (e) { err[wi] = String(e); } console.log(Object.keys(done).length, "/", todo.length); } };
  await Promise.all([worker(), worker(), worker()]);
  const yrs = Array.from({ length: YL1 - YL0 + 1 }, (_, j) => "lulc_" + (YL0 + j));
  const lines = [["win", "region", "lon", "lat", ...yrs, "fire_first", "fire_count", "elev", "slope", "aspect", "dist_urb", "dist_agr", "dist_silv", "w_muestral"].join(",")];
  const ag = {};
  for (const d of Object.values(done)) { d.rows.forEach(rw => lines.push(rw.join(","))); for (const [c, v] of Object.entries(d.nT)) ag[c] = (ag[c] || 0) + v; }
  const areas = ["region,cohorte,ha", ...Object.entries(ag).map(([c, v]) => `Total,${c},${(v * 0.09).toFixed(1)}`)];
  const dl = (name, text) => { const a = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
    a.href = URL.createObjectURL(new Blob([text])); a.download = name; document.documentElement.appendChild(a); a.click(); a.remove(); };
  dl("muestra_mapbiomas_col1.csv", lines.join("\n"));
  dl("areas_quemadas.csv", areas.join("\n"));
  dl("extraccion_meta.json", JSON.stringify({ fecha: new Date().toISOString(), ventanas_ok: Object.keys(done).length, errores: err }, null, 1));
}
// La región administrativa se asigna después, en Python (prep_real.py / notebook 02).
