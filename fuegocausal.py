"""
fuegocausal.py
==============
Estimación del efecto causal del fuego sobre el cambio de uso del suelo en Chile
usando MapBiomas Chile (Cobertura y Uso del Suelo, Colección 2, 1999-2024) y
MapBiomas Fuego (Colección 1, 2013-2025).

Diseño: diferencias en diferencias "apiladas" por cohorte de incendio
(stacked DiD, Cengiz et al. 2019) con emparejamiento de píxeles por puntaje de
propensión dentro de región, y estudio de eventos ATT_k para k años relativos
al incendio. Inferencia con bootstrap por bloques espaciales.

Punto metodológico clave (ver README): el producto Fuego elimina la quema en
píxeles cuya cobertura es infraestructura/agricultura/pastura/agua durante 4
años consecutivos desde el año del incendio (filtro LULC del ATBD). Eso borra
justamente las conversiones inmediatas y estables. Se corrige con una regla de
exclusión simétrica (`mascara_fuego`) y se reportan cotas inferior y superior.

Autor: Cristóbal Martínez Arochas (PUCV) — código abierto (bases, req. 8).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

# --------------------------------------------------------------------------
# 1. Constantes: leyenda MapBiomas Chile Colección 2
# --------------------------------------------------------------------------
LULC_Y0, LULC_Y1 = 1999, 2024          # años de cobertura disponibles (Col. 2)
FIRE_Y0, FIRE_Y1 = 2013, 2025          # años del producto Fuego Col. 1
ANIOS = list(range(LULC_Y0, LULC_Y1 + 1))
COLS_LULC = [f"lulc_{y}" for y in ANIOS]

CLASES = {
    3: "Bosque", 59: "Bosque primario", 60: "Bosque secundario", 67: "Bosque achaparrado",
    11: "Humedal", 12: "Pastizal", 63: "Estepa", 66: "Matorral", 29: "Afloramiento rocoso",
    9: "Silvicultura", 18: "Agricultura", 15: "Pastura",
    24: "Infraestructura", 23: "Arena/playa/duna", 61: "Salar", 25: "Otra área sin vegetación",
    33: "Río, lago u océano", 34: "Hielo y nieve", 27: "No observado",
}

# Grupos de cobertura basal (estado pre-incendio)
GRUPOS = {
    "Bosque": {3, 59, 60, 67},
    "Matorral": {66},
    "Pastizal/estepa": {12, 63},
    "Silvicultura": {9},
}
GRUPO_COD = {g: i + 1 for i, g in enumerate(GRUPOS)}   # 1..4 ; 0 = otro

# Resultados (clase de destino). La función recibe una matriz de clases.
RESULTADOS = {
    "Uso antrópico (agro+pastura+infraestructura)": {18, 15, 24},
    "Infraestructura": {24},
    "Agricultura": {18},
    "Pastura": {15},
    "Silvicultura": {9},
    "Degradación a matorral/pastizal": {66, 12, 63},
}

# Clases que el filtro LULC del producto Fuego considera "no quemables"
FUEGO_MASK_ACUM = {29, 23, 61, 34, 25}      # cualquier año -> se descarta siempre
FUEGO_MASK_DIN = {33, 24, 15, 18}           # si persisten 4 años desde Y
VENTANA_ESTABILIDAD = 4


def usar_coleccion1(anio_ini: int = 2005, anio_fin: int = 2022) -> None:
    """Reconfigura el módulo para MapBiomas Chile Cobertura **Colección 1** (2000-2022).

    En la Colección 1 la agricultura y la pastura se mapean juntas como
    21 = "Mosaico de usos", y el bosque es una sola clase (3).
    """
    global LULC_Y0, LULC_Y1, ANIOS, COLS_LULC, CLASES, GRUPOS, GRUPO_COD
    global RESULTADOS, FUEGO_MASK_ACUM, FUEGO_MASK_DIN, DESTINOS
    LULC_Y0, LULC_Y1 = anio_ini, anio_fin
    ANIOS = list(range(LULC_Y0, LULC_Y1 + 1))
    COLS_LULC = [f"lulc_{y}" for y in ANIOS]
    CLASES = {3: "Bosque", 9: "Silvicultura", 11: "Humedal", 12: "Pastizal", 66: "Matorral",
              21: "Mosaico de usos (agricultura/pastura)", 24: "Infraestructura",
              23: "Arena/playa/duna", 25: "Otra área sin vegetación", 29: "Afloramiento rocoso",
              33: "Río, lago u océano", 34: "Hielo y nieve", 61: "Salar", 27: "No observado",
              0: "Sin dato"}
    GRUPOS = {"Bosque": {3}, "Matorral": {66}, "Pastizal": {12}, "Silvicultura": {9}}
    GRUPO_COD = {g: i + 1 for i, g in enumerate(GRUPOS)}
    RESULTADOS = {
        "Uso antrópico (mosaico agropecuario + infraestructura)": {21, 24},
        "Infraestructura": {24},
        "Mosaico agropecuario": {21},
        "Silvicultura": {9},
        "Degradación a matorral/pastizal": {66, 12},
    }
    FUEGO_MASK_ACUM = {29, 23, 61, 34, 25}
    FUEGO_MASK_DIN = {33, 24, 21}
    DESTINOS = {
        "Mismo grupo basal": None,
        "Bosque": {3},
        "Matorral/pastizal": {66, 12},
        "Silvicultura": {9},
        "Mosaico agropecuario": {21},
        "Infraestructura": {24},
        "Otro": "otro",
    }


# --------------------------------------------------------------------------
# 2. Utilidades sobre la matriz de coberturas
# --------------------------------------------------------------------------
def matriz_lulc(df: pd.DataFrame) -> np.ndarray:
    """Devuelve la matriz (n_pixeles x n_años) de clases como int16."""
    return df[COLS_LULC].to_numpy(dtype=np.int16)


def idx(anio: int) -> int:
    return anio - LULC_Y0


def grupo_de(clases: np.ndarray) -> np.ndarray:
    """Mapea clases a código de grupo basal (0 = fuera de los grupos)."""
    out = np.zeros_like(clases, dtype=np.int8)
    for g, s in GRUPOS.items():
        out[np.isin(clases, list(s))] = GRUPO_COD[g]
    return out


def mascara_fuego(L: np.ndarray, anio: int) -> np.ndarray:
    """Replica el filtro LULC del producto MapBiomas Fuego Col. 1 para el año `anio`.

    True = el producto habría borrado una quema en ese píxel-año.
    - Clases acumuladas (roca, arena, salar, hielo, sin vegetación): en cualquier año.
    - Clases dinámicas (agua, infraestructura, pastura, agricultura): misma clase
      durante 4 años consecutivos desde `anio` (hacia atrás cerca del final de la serie).
    """
    acum = np.isin(L, list(FUEGO_MASK_ACUM)).any(axis=1)
    a0 = min(anio, LULC_Y1 - VENTANA_ESTABILIDAD + 1)
    a0 = max(a0, LULC_Y0)
    win = L[:, idx(a0): idx(a0) + VENTANA_ESTABILIDAD]
    misma = (win == win[:, [0]]).all(axis=1)
    din = misma & np.isin(win[:, 0], list(FUEGO_MASK_DIN))
    return acum | din


def n_cambios(L: np.ndarray, a_ini: int, a_fin: int) -> np.ndarray:
    """Número de cambios de clase entre a_ini y a_fin (inclusive)."""
    a_ini = max(a_ini, LULC_Y0)
    sub = L[:, idx(a_ini): idx(a_fin) + 1]
    return (np.diff(sub, axis=1) != 0).sum(axis=1)


# --------------------------------------------------------------------------
# 3. Covariables
# --------------------------------------------------------------------------
COVARIABLES = [
    "elev", "slope", "northness", "eastness",
    "log_dist_road", "log_dist_urb", "log_dist_agr", "log_dist_silv",
    "lat", "lon", "n_cambios_pre",
]


def preparar_covariables(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    asp = np.deg2rad(df["aspect"].fillna(0))
    df["northness"] = np.cos(asp)
    df["eastness"] = np.sin(asp)
    for c in ["dist_road", "dist_urb", "dist_agr", "dist_silv"]:
        if c in df:
            df[f"log_{c}"] = np.log1p(df[c].clip(lower=0))
        else:
            df[f"log_{c}"] = 0.0
    if "region" not in df:
        df["region"] = "Chile"
    df["region"] = df["region"].fillna("NA").astype(str)
    # bloque espacial ~0.1° (~10 km) para bootstrap
    df["bloque"] = (np.floor(df["lon"] / 0.1).astype(int).astype(str) + "_" +
                    np.floor(df["lat"] / 0.1).astype(int).astype(str))
    return df


# --------------------------------------------------------------------------
# 4. Construcción del panel apilado por cohorte y emparejamiento
# --------------------------------------------------------------------------
def construir_cohorte(df: pd.DataFrame, L: np.ndarray, g: int, grupo: str,
                      regla_control: str = "conservadora") -> tuple[np.ndarray, np.ndarray]:
    """Índices de tratados y controles elegibles para la cohorte g y grupo basal.

    Tratado : primer incendio detectado en g, grupo basal en g-1 y g-2.
    Control : nunca quemado 2013-2025, mismo grupo basal en g-1 y g-2.
    Ambos   : excluye píxeles que el filtro de Fuego habría borrado en g (regla simétrica).
    regla_control:
      'conservadora' -> mantiene controles con conversión estable posterior (cota inferior)
      'estricta'     -> descarta controles que el filtro habría borrado en g+1..g+5,
                        pues pueden ser incendios no detectados (cota superior)
    """
    cod = GRUPO_COD[grupo]
    gb1 = grupo_de(L[:, idx(g - 1)])
    gb2 = grupo_de(L[:, idx(g - 2)])
    base = (gb1 == cod) & (gb2 == cod) & ~mascara_fuego(L, g)

    ff = df["fire_first"].to_numpy()
    fc = df["fire_count"].to_numpy()
    trat = base & (ff == g)
    ctrl = base & (fc == 0)
    if regla_control == "estricta":
        for a in range(g + 1, min(g + 5, LULC_Y1) + 1):
            ctrl &= ~mascara_fuego(L, a)
    return np.flatnonzero(trat), np.flatnonzero(ctrl)


def emparejar(df: pd.DataFrame, it: np.ndarray, ic: np.ndarray,
              k_vecinos: int = 1, caliper_sd: float = 0.2,
              rng: np.random.Generator | None = None,
              max_controles: int = 200_000) -> pd.DataFrame:
    """Emparejamiento por puntaje de propensión (logit) 1:k con reemplazo,
    exacto por región, con caliper de `caliper_sd` desviaciones del logit.

    Devuelve un DataFrame con columnas: i_trat, i_ctrl, peso (1/k).
    """
    rng = rng or np.random.default_rng(0)
    if len(it) == 0 or len(ic) == 0:
        return pd.DataFrame(columns=["i_trat", "i_ctrl", "peso"])
    if len(ic) > max_controles:                        # control de memoria
        ic = rng.choice(ic, max_controles, replace=False)

    X = df[COVARIABLES].to_numpy(dtype=float)
    reg = df["region"].to_numpy()
    idx_all = np.concatenate([it, ic])
    y = np.r_[np.ones(len(it)), np.zeros(len(ic))]
    Xs = StandardScaler().fit_transform(X[idx_all])
    # dummies de región en el modelo de propensión
    R = pd.get_dummies(reg[idx_all], drop_first=True).to_numpy(dtype=float)
    Z = np.hstack([Xs, R]) if R.size else Xs
    lr = LogisticRegression(max_iter=500, C=1.0)
    lr.fit(Z, y, sample_weight=np.where(y == 1, 1.0, len(it) / max(len(ic), 1)))
    p = np.clip(lr.predict_proba(Z)[:, 1], 1e-6, 1 - 1e-6)
    logit = np.log(p / (1 - p))
    caliper = caliper_sd * logit.std()

    lt, lc = logit[: len(it)], logit[len(it):]
    rt, rc = reg[it], reg[ic]
    filas = []
    for r in np.unique(rt):
        mt, mc = rt == r, rc == r
        if mc.sum() == 0:
            continue
        k = min(k_vecinos, mc.sum())
        nn = NearestNeighbors(n_neighbors=k).fit(lc[mc].reshape(-1, 1))
        d, j = nn.kneighbors(lt[mt].reshape(-1, 1))
        ti = it[mt]
        ci = ic[mc][j]
        ok = d <= caliper
        for col in range(k):
            m = ok[:, col]
            filas.append(pd.DataFrame({"i_trat": ti[m], "i_ctrl": ci[m, col]}))
    if not filas:
        return pd.DataFrame(columns=["i_trat", "i_ctrl", "peso"])
    pares = pd.concat(filas, ignore_index=True)
    pares["peso"] = 1.0 / pares.groupby("i_trat")["i_trat"].transform("size")
    return pares


def balance(df: pd.DataFrame, it: np.ndarray, pares: pd.DataFrame,
            ic_pool: np.ndarray) -> pd.DataFrame:
    """Diferencias de medias estandarizadas (SMD) antes y después del emparejamiento."""
    filas = []
    for c in COVARIABLES:
        xt = df[c].to_numpy()[it]
        xc = df[c].to_numpy()[ic_pool]
        sd = np.sqrt((xt.var() + xc.var()) / 2) or 1.0
        antes = (xt.mean() - xc.mean()) / sd
        xtm = df[c].to_numpy()[pares["i_trat"].to_numpy()]
        xcm = df[c].to_numpy()[pares["i_ctrl"].to_numpy()]
        w = pares["peso"].to_numpy()
        despues = (np.average(xtm, weights=w) - np.average(xcm, weights=w)) / sd
        filas.append({"covariable": c, "SMD_antes": antes, "SMD_despues": despues})
    return pd.DataFrame(filas)


def panel_apilado(df: pd.DataFrame, cohortes=range(2014, 2023), grupos=None,
                  regla_control: str = "conservadora", k_vecinos: int = 1,
                  caliper_sd: float = 0.2, semilla: int = 42,
                  verbose: bool = True) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Construye todos los pares emparejados (cohorte x grupo basal).

    Devuelve (pares, balance) donde `pares` trae: cohorte, grupo, i_trat, i_ctrl, peso.
    """
    grupos = grupos or list(GRUPOS)
    rng = np.random.default_rng(semilla)
    L = matriz_lulc(df)
    df = df.copy()
    out, bal = [], []
    for g in cohortes:
        # covariable dependiente de la cohorte: inestabilidad previa (g-8 .. g-2)
        df["n_cambios_pre"] = n_cambios(L, g - 8, g - 2)
        for gr in grupos:
            it, ic = construir_cohorte(df, L, g, gr, regla_control)
            if len(it) < 20 or len(ic) < 20:
                continue
            pares = emparejar(df, it, ic, k_vecinos, caliper_sd, rng)
            if pares.empty:
                continue
            pares["cohorte"], pares["grupo"] = g, gr
            out.append(pares)
            b = balance(df, it, pares, ic)
            b["cohorte"], b["grupo"] = g, gr
            b["n_trat"], b["n_trat_emparejados"] = len(it), pares["i_trat"].nunique()
            bal.append(b)
            if verbose:
                print(f"  cohorte {g} | {gr:16s} | tratados {len(it):6d} | "
                      f"controles {len(ic):7d} | emparejados {pares['i_trat'].nunique():6d}")
    return (pd.concat(out, ignore_index=True) if out else pd.DataFrame(),
            pd.concat(bal, ignore_index=True) if bal else pd.DataFrame())


# --------------------------------------------------------------------------
# 5. Estudio de eventos: ATT_k
# --------------------------------------------------------------------------
def diferencias_por_tratado(df: pd.DataFrame, pares: pd.DataFrame, resultado: set,
                            k_min: int = -6, k_max: int = 8) -> pd.DataFrame:
    """Para cada tratado i y año relativo k: d_ik = Y_ik - promedio ponderado de sus controles.

    Y_ik = 1 si la cobertura en g+k pertenece a `resultado`. Se normaliza contra k=-1
    (DiD); como el grupo basal es idéntico en g-1, el término base suele ser 0.
    """
    L = matriz_lulc(df)
    res = list(resultado)
    filas = []
    for (g, gr), sub in pares.groupby(["cohorte", "grupo"]):
        ks = [k for k in range(k_min, k_max + 1) if LULC_Y0 <= g + k <= LULC_Y1]
        cols = [idx(g + k) for k in ks]
        it = sub["i_trat"].to_numpy()
        ic = sub["i_ctrl"].to_numpy()
        w = sub["peso"].to_numpy()
        Yt = np.isin(L[it][:, cols], res).astype(float)
        Yc = np.isin(L[ic][:, cols], res).astype(float)
        kb = ks.index(-1)
        Yt = Yt - Yt[:, [kb]]
        Yc = Yc - Yc[:, [kb]]
        # promedio de controles por tratado
        dfc = pd.DataFrame(Yc * w[:, None], columns=ks)
        dfc["i_trat"] = it
        mc = dfc.groupby("i_trat").sum()
        dft = pd.DataFrame(Yt, columns=ks)
        dft["i_trat"] = it
        mt = dft.groupby("i_trat").first()
        d = (mt - mc.loc[mt.index]).reset_index()
        d = d.melt(id_vars="i_trat", var_name="k", value_name="d")
        d["y_t"] = mt.reset_index().melt(id_vars="i_trat")["value"].to_numpy()
        d["cohorte"], d["grupo"] = g, gr
        filas.append(d)
    out = pd.concat(filas, ignore_index=True)
    out["k"] = out["k"].astype(int)
    ii = out["i_trat"].to_numpy()
    out["bloque"] = df["bloque"].to_numpy()[ii]
    # peso muestral (representatividad del área quemada); 1 si no existe
    out["w"] = df["w_muestral"].to_numpy()[ii] if "w_muestral" in df else 1.0
    for extra in ["region", "dist_urb", "scar_size"]:
        if extra in df:
            out[extra] = df[extra].to_numpy()[ii]
    return out


def att_event_study(dif: pd.DataFrame, n_boot: int = 300, semilla: int = 7,
                    alpha: float = 0.05, por: str | None = None,
                    cohortes_balanceadas_hasta: int | None = None) -> pd.DataFrame:
    """ATT_k = promedio de d_ik, con IC por bootstrap de bloques espaciales.

    por: columna para heterogeneidad (p. ej., 'grupo').
    cohortes_balanceadas_hasta: si se da K, usa solo cohortes con k=K observable
    (composición constante entre k).
    """
    rng = np.random.default_rng(semilla)
    d = dif
    if cohortes_balanceadas_hasta is not None:
        d = d[d["cohorte"] + cohortes_balanceadas_hasta <= LULC_Y1]
    grupos_het = [None] if por is None else sorted(d[por].unique())
    filas = []
    for gh in grupos_het:
        dd = d if gh is None else d[d[por] == gh]
        dd = dd.assign(w=dd["w"] if "w" in dd else 1.0)
        dd = dd.assign(wd=dd["w"] * dd["d"])
        # matrices bloque x k de sumas ponderadas -> bootstrap rápido
        g_ = dd.groupby(["bloque", "k"])
        agg = pd.concat({"sum": g_["wd"].sum(), "w": g_["w"].sum(),
                         "count": g_["d"].size()}, axis=1).unstack("k").fillna(0)
        S, W, N = agg["sum"].to_numpy(), agg["w"].to_numpy(), agg["count"].to_numpy()
        ks = agg["sum"].columns.to_numpy()
        est = S.sum(0) / np.maximum(W.sum(0), 1e-12)
        nb = S.shape[0]
        boots = np.empty((n_boot, len(ks)))
        for b in range(n_boot):
            m = rng.integers(0, nb, nb)
            boots[b] = S[m].sum(0) / np.maximum(W[m].sum(0), 1e-12)
        lo, hi = np.quantile(boots, [alpha / 2, 1 - alpha / 2], axis=0)
        se = boots.std(0)
        for j, k in enumerate(ks):
            filas.append({"k": int(k), "ATT": est[j], "EE": se[j], "IC_inf": lo[j],
                          "IC_sup": hi[j], "n_trat": int(N[:, j].sum()),
                          "n_bloques": nb, **({por: gh} if por else {})})
    return pd.DataFrame(filas)


def att_promedio_post(dif: pd.DataFrame, k_desde: int = 1, k_hasta: int = 5,
                      por: str | None = None, n_boot: int = 300, semilla: int = 11):
    """ATT promedio en la ventana post (k_desde..k_hasta), con IC bootstrap por bloques."""
    d = dif[(dif["k"] >= k_desde) & (dif["k"] <= k_hasta)]
    d = d.groupby(["i_trat", "cohorte", "bloque"] + ([por] if por else []),
                  as_index=False).agg(d=("d", "mean"), w=("w", "first"))
    d["k"] = 0
    r = att_event_study(d, n_boot=n_boot, semilla=semilla, por=por)
    return r.drop(columns="k")


# --------------------------------------------------------------------------
# 6. Estimador ingenuo (para contraste)
# --------------------------------------------------------------------------
def ingenuo(df: pd.DataFrame, resultado: set, cohortes=range(2014, 2023),
            grupos=None, k: int = 3) -> float:
    """Diferencia simple quemados vs todos los no quemados del mismo grupo basal,
    sin emparejamiento ni regla simétrica: lo que suele citarse en el debate."""
    grupos = grupos or list(GRUPOS)
    L = matriz_lulc(df)
    ff, fc = df["fire_first"].to_numpy(), df["fire_count"].to_numpy()
    num_t = num_c = 0.0
    n_t = n_c = 0
    for g in cohortes:
        if g + k > LULC_Y1:
            continue
        gb = grupo_de(L[:, idx(g - 1)])
        y = np.isin(L[:, idx(g + k)], list(resultado))
        for gr in grupos:
            base = gb == GRUPO_COD[gr]
            t, c = base & (ff == g), base & (fc == 0)
            num_t += y[t].sum(); n_t += t.sum()
            num_c += y[c].sum(); n_c += c.sum()
    return num_t / max(n_t, 1) - num_c / max(n_c, 1)


# --------------------------------------------------------------------------
# 7. Composición de trayectorias (¿a dónde van los píxeles quemados?)
# --------------------------------------------------------------------------
DESTINOS = {
    "Mismo grupo basal": None,
    "Bosque": {3, 59, 60, 67},
    "Matorral/pastizal/estepa": {66, 12, 63},
    "Silvicultura": {9},
    "Agricultura": {18},
    "Pastura": {15},
    "Infraestructura": {24},
    "Otro": "otro",
}


def composicion(df: pd.DataFrame, pares: pd.DataFrame, k_max: int = 8) -> pd.DataFrame:
    """Proporción de píxeles en cada destino por k, tratados vs controles emparejados."""
    L = matriz_lulc(df)
    filas = []
    for (g, gr), sub in pares.groupby(["cohorte", "grupo"]):
        cod_set = GRUPOS[gr]
        for lado, col, w in [("Quemados", "i_trat", None), ("Controles emparejados", "i_ctrl", "peso")]:
            ii = sub[col].to_numpy() if lado != "Quemados" else sub["i_trat"].drop_duplicates().to_numpy()
            ww = sub[w].to_numpy() if w else np.ones(len(ii))
            for k in range(-1, k_max + 1):
                if g + k > LULC_Y1:
                    break
                c = L[ii, idx(g + k)]
                asignado = np.zeros(len(c), bool)
                for dest, s in DESTINOS.items():
                    if dest == "Mismo grupo basal":
                        m = np.isin(c, list(cod_set))
                    elif s == "otro":
                        m = ~asignado
                    else:
                        m = np.isin(c, list(s)) & ~asignado
                    asignado |= m
                    filas.append({"lado": lado, "k": k, "destino": dest,
                                  "peso": float((ww * m).sum()), "total": float(ww.sum())})
    t = pd.DataFrame(filas).groupby(["lado", "k", "destino"], as_index=False)[["peso", "total"]].sum()
    t["proporcion"] = t["peso"] / t["total"]
    return t


# --------------------------------------------------------------------------
# 8. Escalamiento a hectáreas
# --------------------------------------------------------------------------
HA_PIXEL = 0.09  # 30 m x 30 m


def pesos_muestrales(df: pd.DataFrame, areas: pd.DataFrame | None) -> pd.DataFrame:
    """Agrega `w_muestral` a los píxeles quemados: hectáreas quemadas que representa
    cada píxel muestreado, según región x cohorte (tabla `areas` exportada en el notebook 01:
    columnas region, cohorte, ha). Sin tabla, w = 1 (muestra autoponderada)."""
    df = df.copy()
    df["w_muestral"] = 1.0
    if areas is None or areas.empty:
        return df
    q = df["fire_first"] > 0
    n = df[q].groupby(["region", "fire_first"]).size().rename("n").reset_index()
    a = areas.rename(columns={"cohorte": "fire_first"}).merge(n, on=["region", "fire_first"])
    a["w"] = a["ha"] / a["n"]
    df = df.merge(a[["region", "fire_first", "w"]], on=["region", "fire_first"], how="left")
    df.loc[q & df["w"].notna(), "w_muestral"] = df.loc[q & df["w"].notna(), "w"]
    return df.drop(columns="w")


def hectareas_atribuibles(att: float, ha_quemadas_elegibles: float) -> float:
    """Hectáreas de conversión atribuibles al fuego = ATT x área quemada elegible."""
    return att * ha_quemadas_elegibles
