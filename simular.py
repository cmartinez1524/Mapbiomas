"""
simular.py
==========
Genera un paisaje sintético con la MISMA estructura de columnas que exporta el
notebook 01 (Earth Engine), con efecto causal del fuego CONOCIDO.

Sirve para dos cosas:
1. Probar el pipeline completo antes de tener los datos reales.
2. Validar el estimador: mostrar que (a) el contraste ingenuo está sesgado por
   confusión (el fuego cae cerca de caminos y ciudades, donde de todas formas
   hay más conversión) y (b) el emparejamiento + regla simétrica recupera el
   efecto verdadero aun con el filtro LULC del producto Fuego.

El fuego depende SOLO de covariables estáticas + cobertura 2012 + shocks anuales,
y los cambios de cobertura usan números aleatorios compartidos entre el mundo
con fuego y el contrafactual sin efecto del fuego -> ATT verdadero exacto.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from fuegocausal import (ANIOS, COLS_LULC, FIRE_Y0, FIRE_Y1, LULC_Y0, LULC_Y1,
                         idx, mascara_fuego)

REGIONES = ["Valparaíso", "O'Higgins", "Maule", "Ñuble", "Biobío", "Araucanía"]


def _covariables(n, rng):
    reg_i = rng.integers(0, len(REGIONES), n)
    lat = -32.5 - reg_i * 1.1 + rng.uniform(-0.5, 0.5, n)
    lon = -72.6 + rng.uniform(-0.8, 1.2, n)
    dist_urb = rng.lognormal(np.log(6000), 1.0, n)            # m
    dist_road = rng.lognormal(np.log(800), 1.1, n)
    dist_agr = rng.lognormal(np.log(1500), 1.0, n)
    dist_silv = rng.lognormal(np.log(2000), 1.2, n)
    elev = np.clip(rng.normal(450, 300, n) + 0.05 * dist_urb ** 0.5, 0, 2500)
    slope = np.clip(rng.gamma(2.0, 6.0, n), 0, 60)
    aspect = rng.uniform(0, 360, n)
    return pd.DataFrame(dict(region=np.array(REGIONES)[reg_i], lat=lat, lon=lon,
                             dist_urb=dist_urb, dist_road=dist_road, dist_agr=dist_agr,
                             dist_silv=dist_silv, elev=elev, slope=slope, aspect=aspect))


def _paso(c, u, cov, efecto_fuego, rng_u2):
    """Una transición anual. c: clases actuales; u: uniformes compartidas (n,)."""
    durb = cov["dist_urb"].to_numpy()
    dagr = cov["dist_agr"].to_numpy()
    dsilv = cov["dist_silv"].to_numpy()
    natural = np.isin(c, [3, 66, 12])
    # presión basal de conversión antrópica: mayor cerca de ciudades y agricultura
    p_antro = 0.004 + 0.035 * np.exp(-durb / 4000) + 0.01 * np.exp(-dagr / 1500)
    # efecto causal del fuego: multiplica la presión, más fuerte cerca de ciudades
    p_antro = p_antro * (1 + efecto_fuego * (1.5 + 4.0 * np.exp(-durb / 3000)))
    p_silv = 0.006 * np.exp(-dsilv / 3000) * (1 + 0.8 * efecto_fuego)
    p_degr = np.where(c == 3, 0.004 + 0.12 * efecto_fuego, 0.0)
    p_regen = np.where(c == 66, 0.006, 0.0)

    nuevo = c.copy()
    s1 = p_antro
    s2 = s1 + p_silv
    s3 = s2 + p_degr
    s4 = s3 + p_regen
    m = natural & (u < s1)
    # destino antrópico: infraestructura si cerca de ciudad, si no agro/pastura
    infra = rng_u2 < np.exp(-durb / 2500)
    nuevo[m & infra] = 24
    nuevo[m & ~infra & (rng_u2 < 0.6)] = 18
    nuevo[m & ~infra & (rng_u2 >= 0.6)] = 15
    nuevo[natural & (u >= s1) & (u < s2)] = 9
    nuevo[natural & (u >= s2) & (u < s3)] = 66
    nuevo[natural & (u >= s3) & (u < s4)] = 3
    # silvicultura: cosecha/conversión ocasional
    silv = c == 9
    ps_antro = 0.003 + 0.01 * np.exp(-durb / 4000)
    ps_antro = ps_antro * (1 + efecto_fuego * 2.0)
    nuevo[silv & (u < ps_antro)] = 18
    nuevo[silv & (u >= ps_antro) & (u < ps_antro + 0.02 * efecto_fuego)] = 66
    # agricultura <-> pastura (ruido de uso, no cuenta como regreso a natural)
    ag = np.isin(c, [18, 15])
    flip = ag & (u > 0.985)
    nuevo[flip & (c == 18)] = 15
    nuevo[flip & (c == 15)] = 18
    return nuevo


def simular(n: int = 150_000, semilla: int = 2026,
            devolver_verdad: bool = True) -> tuple[pd.DataFrame, pd.DataFrame | None]:
    rng = np.random.default_rng(semilla)
    cov = _covariables(n, rng)

    # cobertura inicial 1999
    c0 = rng.choice([3, 66, 12, 9], size=n, p=[0.35, 0.30, 0.15, 0.20])

    # -------- incendios: dependen de covariables estáticas (confusión) --------
    shocks = {y: 1.0 for y in range(FIRE_Y0, FIRE_Y1 + 1)}
    shocks.update({2017: 6.0, 2023: 4.0, 2015: 2.0, 2019: 1.8})
    lin = (-6.3 + 1.1 * np.exp(-cov["dist_road"] / 1500) + 1.4 * np.exp(-cov["dist_urb"] / 5000)
           + 0.02 * cov["slope"])
    base_ign = 1 / (1 + np.exp(-lin.to_numpy()))
    quema_real = np.zeros((n, len(range(FIRE_Y0, FIRE_Y1 + 1))), bool)

    U = rng.uniform(size=(n, len(ANIOS)))          # uniformes compartidas
    U2 = rng.uniform(size=(n, len(ANIOS)))
    UF = rng.uniform(size=(n, quema_real.shape[1]))

    L1 = np.zeros((n, len(ANIOS)), np.int16)   # mundo observado (con efecto)
    L0 = np.zeros((n, len(ANIOS)), np.int16)   # contrafactual (sin efecto del fuego)
    L1[:, 0] = L0[:, 0] = c0
    ef1 = np.zeros(n)                            # efecto activo
    for t, y in enumerate(ANIOS[1:], start=1):
        if FIRE_Y0 <= y <= FIRE_Y1:
            j = y - FIRE_Y0
            # inflamabilidad según cobertura 2012 (estática para no crear retroalimentación)
            c2012 = L1[:, idx(2012)]
            infl = np.select([c2012 == 9, c2012 == 66, c2012 == 12, c2012 == 3],
                             [1.6, 1.4, 1.1, 0.7], 0.2)
            pq = np.clip(base_ign * shocks[y] * infl, 0, 0.5)
            quema_real[:, j] = UF[:, j] < pq
            # el fuego en y activa efecto en las transiciones hacia y, y+1, y+2
        efecto = np.zeros(n)
        for j in range(quema_real.shape[1]):
            yq = FIRE_Y0 + j
            if yq <= y <= yq + 2:
                efecto = np.maximum(efecto, quema_real[:, j].astype(float))
        L1[:, t] = _paso(L1[:, t - 1], U[:, t], cov, efecto, U2[:, t])
        L0[:, t] = _paso(L0[:, t - 1], U[:, t], cov, np.zeros(n), U2[:, t])

    # -------- filtro LULC del producto Fuego (borra quemas) --------
    quema_det = quema_real.copy()
    for j in range(quema_real.shape[1]):
        y = FIRE_Y0 + j
        quema_det[:, j] &= ~mascara_fuego(L1, min(y, LULC_Y1))
    anios_f = np.arange(FIRE_Y0, FIRE_Y1 + 1)
    fire_count = quema_det.sum(1)
    fire_first = np.where(fire_count > 0, anios_f[np.argmax(quema_det, axis=1)], 0)

    df = cov.copy()
    df[COLS_LULC] = L1
    df["fire_first"] = fire_first
    df["fire_count"] = fire_count
    df["scar_size"] = np.where(fire_first > 0, rng.integers(1, 8, n), 0)
    df.insert(0, "pid", np.arange(n))

    verdad = None
    if devolver_verdad:
        verdad = pd.DataFrame(L0, columns=COLS_LULC)
        verdad.insert(0, "pid", np.arange(n))
    return df, verdad


def att_verdadero(df: pd.DataFrame, verdad: pd.DataFrame, pares: pd.DataFrame,
                  resultado: set, k_max: int = 8) -> pd.DataFrame:
    """ATT verdadero sobre los MISMOS tratados emparejados: Y(1) - Y(0) con el contrafactual simulado."""
    L1 = df[COLS_LULC].to_numpy()
    L0 = verdad[COLS_LULC].to_numpy()
    tr = pares[["i_trat", "cohorte"]].drop_duplicates()
    filas = []
    for k in range(-1, k_max + 1):
        t = tr[tr["cohorte"] + k <= LULC_Y1]
        if t.empty:
            continue
        cols = (t["cohorte"] + k - LULC_Y0).to_numpy()
        ii = t["i_trat"].to_numpy()
        y1 = np.isin(L1[ii, cols], list(resultado))
        y0 = np.isin(L0[ii, cols], list(resultado))
        filas.append({"k": k, "ATT_verdadero": (y1.astype(float) - y0).mean()})
    return pd.DataFrame(filas)


if __name__ == "__main__":
    df, v = simular(30_000)
    print(df.head())
    print("quemados detectados:", (df.fire_first > 0).sum())
