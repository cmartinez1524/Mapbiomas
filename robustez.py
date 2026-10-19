"""Análisis de robustez sobre los datos reales (Colección 1)."""
import numpy as np, pandas as pd
import sys, os
import fuegocausal as fc
COL2 = len(sys.argv) > 1 and sys.argv[1] == "col2"
if COL2:
    exec(open("prep_col2.py").read()); COH = range(2014, 2024); RES = "resultados_col2/"
else:
    fc.usar_coleccion1(2005, 2022)
    exec(open("prep_real.py").read()); COH = range(2014, 2022); RES = "resultados/"
os.makedirs(RES, exist_ok=True)
Y0, Y1 = fc.LULC_Y0, fc.LULC_Y1
pares, bal = fc.panel_apilado(df, cohortes=COH, verbose=False)
L = fc.matriz_lulc(df)

def persistente(clases, k, dur=3):
    """1 si el píxel está en `clases` en g+k, g+k+1, ..., g+k+dur-1 (todos observables)."""
    pass

out = {}
# 1) Conversión persistente: uso antrópico 3 años seguidos desde k (solo cohortes con g+k+2 <= 2022)
R = list(fc.RESULTADOS[list(fc.RESULTADOS)[0]])
filas = []
for k0 in [1, 2, 3]:
    sel = pares[pares.cohorte + k0 + 2 <= Y1]
    it, ic, w, g = sel.i_trat.to_numpy(), sel.i_ctrl.to_numpy(), sel.peso.to_numpy(), sel.cohorte.to_numpy()
    def Y(ii):
        return np.all([np.isin(L[ii, g + k0 + j - Y0], R) for j in range(3)], axis=0).astype(float)
    yt, yc = Y(it), Y(ic)
    d = pd.DataFrame({"i": it, "yt": yt, "ycw": yc * w, "b": df.bloque.to_numpy()[it], "grupo": sel.grupo.to_numpy()})
    m = d.groupby(["i", "b", "grupo"]).agg(yt=("yt", "first"), yc=("ycw", "sum")).reset_index()
    m["d"] = m.yt - m.yc
    for gr, mm in [("Todos", m)] + list(m.groupby("grupo")):
        # bootstrap por bloque
        bs = mm.groupby("b")["d"].agg(["sum", "count"])
        rng = np.random.default_rng(1); S, N = bs["sum"].to_numpy(), bs["count"].to_numpy()
        boots = [S[ix].sum() / N[ix].sum() for ix in (rng.integers(0, len(S), len(S)) for _ in range(300))]
        filas.append({"desde_k": k0, "grupo": gr, "ATT_persistente": mm.d.mean(),
                      "IC_inf": np.quantile(boots, .025), "IC_sup": np.quantile(boots, .975),
                      "conv_quemados": mm.yt.mean(), "conv_controles": mm.yc.mean(), "n": len(mm)})
pers = pd.DataFrame(filas); out["persistente"] = pers
print("== Conversión persistente (uso antrópico 3 años seguidos)\n", pers.round(4).to_string())

# 2) ¿A dónde vuelven los píxeles quemados que pasan a mosaico en k=1?
tr = pares[["i_trat", "cohorte", "grupo"]].drop_duplicates()
tr = tr[tr.cohorte + 4 <= Y1]
ii, g = tr.i_trat.to_numpy(), tr.cohorte.to_numpy()
en1 = np.isin(L[ii, g + 1 - Y0], R)
k4 = L[ii[en1], g[en1] + 4 - Y0]
dest = pd.Series(k4).map(fc.CLASES).value_counts(normalize=True)
print("\n== Quemados en uso antrópico en k=1: clase en k=4\n", dest.round(3).to_string())
print("   grupo previo:", tr.grupo[en1].value_counts(normalize=True).round(3).to_dict())
out["destino_k4"] = dest

# 3) Sensibilidad del emparejamiento (efecto principal k=1..5, regla conservadora)
sens = []
for kv, cal in [(1, 0.2), (3, 0.2), (5, 0.1), (1, 0.05)]:
    p2, _ = fc.panel_apilado(df, cohortes=COH, k_vecinos=kv, caliper_sd=cal, verbose=False)
    d2 = fc.diferencias_por_tratado(df, p2, set(R))
    r = fc.att_promedio_post(d2, 1, 5, n_boot=200).iloc[0]
    sens.append({"k_vecinos": kv, "caliper_sd": cal, "ATT": r.ATT, "IC_inf": r.IC_inf, "IC_sup": r.IC_sup})
sens = pd.DataFrame(sens); out["sensibilidad"] = sens
print("\n== Sensibilidad\n", sens.round(4).to_string())

# 4) Placebo: "incendio" asignado 4 años antes del real (g' = g-4) sobre píxeles estables
#    -> se espera ATT ~ 0 en k'=1..3 (antes del incendio real)
dif = fc.diferencias_por_tratado(df, pares, set(R), k_min=-6, k_max=8)
pl = dif[dif.k.between(-5, -3)].d.mean()
print(f"\n== Placebo pre-incendio (k=-5..-3): ATT medio = {pl:.4f}")

# 5) Regiones x grupo (dónde se concentra)
dif["region"] = df.region.to_numpy()[dif.i_trat.to_numpy()]
rg = fc.att_promedio_post(dif.assign(rg=dif.region + " | " + dif.grupo), 1, 5, por="rg", n_boot=150)
rg = rg[rg.n_trat >= 800].sort_values("ATT", ascending=False)
print("\n== Región x cobertura previa (n>=800)\n", rg[["rg", "ATT", "IC_inf", "IC_sup", "n_trat"]].round(4).to_string())
out["region_grupo"] = rg
for k, v in out.items():
    v.to_csv(f"{RES}robustez_{k}.csv")
