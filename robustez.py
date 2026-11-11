"""Análisis de robustez sobre los datos reales.

Uso:  python robustez.py        -> Colección 1 (cohortes 2014-2021)
      python robustez.py col2   -> Colección 2 (cohortes 2014-2021; 2022-2023 se analizan aparte)

Todas las estimaciones ponderan cada píxel quemado por w_muestral (hectáreas que representa)
y los resúmenes usan cohortes balanceadas (todas observables en la ventana completa).
"""
import sys, os
import numpy as np, pandas as pd
import fuegocausal as fc

COL2 = len(sys.argv) > 1 and sys.argv[1] == "col2"
if COL2:
    exec(open("prep_col2.py").read()); RES = "resultados_col2/"
else:
    fc.usar_coleccion1(2005, 2022)
    exec(open("prep_real.py").read()); RES = "resultados/"
COH = range(2014, 2022)                 # cohortes con censura consistente del filtro de Fuego
Y0, Y1 = fc.LULC_Y0, fc.LULC_Y1
KV = 3                                  # ventana principal: k = 1..3
os.makedirs(RES, exist_ok=True)

pares, bal = fc.panel_apilado(df, cohortes=COH, verbose=False)
L = fc.matriz_lulc(df)
R = list(fc.RESULTADOS[list(fc.RESULTADOS)[0]])
W = df["w_muestral"].to_numpy()


def boot_ponderado(m, col="d", n=300, semilla=1):
    """Media ponderada por w con IC bootstrap por bloques espaciales."""
    g = m.assign(wd=m.w * m[col]).groupby("b")[["wd", "w"]].sum()
    S, Wb = g.wd.to_numpy(), g.w.to_numpy()
    rng = np.random.default_rng(semilla)
    bs = [S[ix].sum() / Wb[ix].sum() for ix in (rng.integers(0, len(S), len(S)) for _ in range(n))]
    return S.sum() / Wb.sum(), np.quantile(bs, .025), np.quantile(bs, .975)


out = {}
# 1) Conversión persistente: uso antrópico 3 años seguidos desde k0 (cohortes con g+k0+2 <= Y1)
filas = []
for k0 in [1, 2, 3]:
    sel = pares[pares.cohorte + k0 + 2 <= Y1]
    it, ic, w, g = sel.i_trat.to_numpy(), sel.i_ctrl.to_numpy(), sel.peso.to_numpy(), sel.cohorte.to_numpy()
    def Y(ii):
        return np.all([np.isin(L[ii, g + k0 + j - Y0], R) for j in range(3)], axis=0).astype(float)
    yt, yc = Y(it), Y(ic)
    d = pd.DataFrame({"i": it, "yt": yt, "ycw": yc * w, "b": df.bloque.to_numpy()[it], "grupo": sel.grupo.to_numpy()})
    m = d.groupby(["i", "b", "grupo"]).agg(yt=("yt", "first"), yc=("ycw", "sum")).reset_index()
    m["d"], m["w"] = m.yt - m.yc, W[m.i.to_numpy()]
    for gr, mm in [("Todos", m)] + list(m.groupby("grupo")):
        att, lo, hi = boot_ponderado(mm)
        filas.append({"desde_k": k0, "grupo": gr, "ATT_persistente": att, "IC_inf": lo, "IC_sup": hi,
                      "conv_quemados": np.average(mm.yt, weights=mm.w), "conv_controles": np.average(mm.yc, weights=mm.w),
                      "n": len(mm)})
out["persistente"] = pers = pd.DataFrame(filas)
print("== Conversión persistente (uso antrópico 3 años seguidos, ponderado)\n", pers.round(4).to_string())

# 2) ¿Dónde están en k=4 los quemados que eran uso antrópico en k=1?
tr = pares[["i_trat", "cohorte", "grupo"]].drop_duplicates()
tr = tr[tr.cohorte + 4 <= Y1]
ii, g = tr.i_trat.to_numpy(), tr.cohorte.to_numpy()
en1 = np.isin(L[ii, g + 1 - Y0], R)
dest = pd.Series(L[ii[en1], g[en1] + 4 - Y0]).map(fc.CLASES)
out["destino_k4"] = dest = dest.groupby(dest).size().div(len(dest)).sort_values(ascending=False).rename("proporcion")
print("\n== Quemados en uso antrópico en k=1: clase en k=4\n", dest.round(3).to_string())

# 3) Resúmenes balanceados y sensibilidad del emparejamiento
dif = fc.diferencias_por_tratado(df, pares, set(R), k_min=-6, k_max=8)
res = []
for kv in [3, 5]:
    r = fc.att_promedio_post(dif, 1, kv, n_boot=300).iloc[0]
    res.append({"ventana": f"k=1-{kv}", "cohortes": f"2014-{Y1 - kv}", **r[["ATT", "IC_inf", "IC_sup", "n_trat"]].to_dict()})
sens = []
for kn, cal in [(1, 0.2), (3, 0.2), (5, 0.1), (1, 0.05)]:
    p2, _ = fc.panel_apilado(df, cohortes=COH, k_vecinos=kn, caliper_sd=cal, verbose=False)
    d2 = fc.diferencias_por_tratado(df, p2, set(R))
    r = fc.att_promedio_post(d2, 1, KV, n_boot=200).iloc[0]
    sens.append({"k_vecinos": kn, "caliper_sd": cal, "ATT": r.ATT, "IC_inf": r.IC_inf, "IC_sup": r.IC_sup})
out["resumenes"] = pd.DataFrame(res)
out["sensibilidad"] = pd.DataFrame(sens)
print("\n== Resúmenes balanceados\n", out["resumenes"].round(4).to_string())
print("\n== Sensibilidad (k=1-3)\n", out["sensibilidad"].round(4).to_string())

# 4) Tendencias previas
pre = dif[dif.k.between(-6, -3)]
print(f"\n== Tendencias previas (k=-6..-3): media ponderada = {np.average(pre.d, weights=pre.w):.4f}")

# 5) Región x cobertura previa (k=1-3, cohortes balanceadas)
dif["region"] = df.region.to_numpy()[dif.i_trat.to_numpy()]
rg = fc.att_promedio_post(dif.assign(rg=dif.region + " | " + dif.grupo), 1, KV, por="rg", n_boot=200)
out["region_grupo"] = rg = rg[rg.n_trat >= 800].sort_values("ATT", ascending=False)
print("\n== Región x cobertura previa (k=1-3, n>=800)\n", rg[["rg", "ATT", "IC_inf", "IC_sup", "n_trat"]].round(4).to_string())

# 6) Colección 2: cohortes 2022-2023, que el filtro de Fuego no alcanza a censurar
if COL2:
    p3, _ = fc.panel_apilado(df, cohortes=range(2022, 2024), verbose=False)
    d3 = fc.diferencias_por_tratado(df, p3, set(R), k_min=-3, k_max=2)
    filas = []
    for (c, k), x in d3[d3.k.between(0, 2)].groupby(["cohorte", "k"]):
        att, lo, hi = boot_ponderado(x.rename(columns={"bloque": "b"}))
        filas.append({"cohorte": c, "k": k, "ATT": att, "IC_inf": lo, "IC_sup": hi, "n": len(x)})
    for gr, x in d3[d3.k == 1].groupby("grupo"):
        att, lo, hi = boot_ponderado(x.rename(columns={"bloque": "b"}))
        filas.append({"cohorte": "2022-2023", "k": 1, "grupo": gr, "ATT": att, "IC_inf": lo, "IC_sup": hi, "n": len(x)})
    out["cohortes_recientes"] = pd.DataFrame(filas)
    print("\n== Cohortes 2022-2023 (sin censura del filtro)\n", out["cohortes_recientes"].round(4).to_string())

# 7) Placebo espacial: píxeles NUNCA quemados a menos de 1 km de un píxel quemado de la cohorte g
#    hacen de "tratados"; los controles son píxeles nunca quemados a más de 5 km de cualquier
#    quema muestreada. Se repite todo el procedimiento. Si los lugares propensos al fuego se
#    convirtieran más por razones ajenas al fuego (confusión espacial no observada), el placebo
#    sería positivo. (Un placebo temporal no es informativo aquí: adelantar la fecha condiciona
#    en que el píxel siga con vegetación hasta quemarse; para eso están las tendencias previas.)
from scipy.spatial import cKDTree
CERCA_KM, LEJOS_KM = 1.0, 5.0
lat0 = np.deg2rad(df.lat.mean())
xy = np.c_[df.lon * 111.32 * np.cos(lat0), df.lat * 110.57]
ff, nq = df.fire_first.to_numpy(), df.fire_count.to_numpy() == 0
d_cualq, _ = cKDTree(xy[~nq]).query(xy)
enc = np.flatnonzero(np.isin(ff, list(COH)) & ~nq)
d_coh, j_coh = cKDTree(xy[enc]).query(xy)
dfp = df.copy()
dfp["fire_first"], dfp["fire_count"], dfp["w_muestral"] = -1, 1, 1.0
pseudo = nq & (d_coh < CERCA_KM)
dfp.loc[pseudo, "fire_first"] = ff[enc][j_coh[pseudo]]
dfp.loc[nq & (d_cualq > LEJOS_KM), "fire_count"] = 0
pp, _ = fc.panel_apilado(dfp, cohortes=COH, verbose=False)
dp = fc.diferencias_por_tratado(dfp, pp, set(R), k_min=-3, k_max=3)
filas = []
for etq, por in [("Todos", None), (None, "grupo")]:
    r = fc.att_promedio_post(dp, 1, KV, por=por, n_boot=300)
    for _, x in r.iterrows():
        filas.append({"grupo": etq or x["grupo"], "ATT_placebo": x.ATT, "IC_inf": x.IC_inf,
                      "IC_sup": x.IC_sup, "n_pseudo_tratados": int(x.n_trat)})
out["placebo"] = pd.DataFrame(filas)
print(f"\n== Placebo espacial (no quemados a <{CERCA_KM:g} km de una quema vs. a >{LEJOS_KM:g} km, k=1-3)\n",
      out["placebo"].round(4).to_string())

for k, v in out.items():
    v.to_csv(f"{RES}robustez_{k}.csv")
