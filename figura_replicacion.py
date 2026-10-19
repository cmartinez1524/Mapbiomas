"""Figura de replicación: estimaciones clave con Colección 1 vs Colección 2."""
import pandas as pd, numpy as np, matplotlib.pyplot as plt, matplotlib.ticker as mtick
plt.rcParams.update({"figure.dpi": 110, "savefig.dpi": 200, "font.size": 9.5, "font.family": "DejaVu Sans",
                     "axes.spines.top": False, "axes.spines.right": False})
def fila(res, col1, col2):
    return dict(nombre=res, c1=col1, c2=col2)
def resumen(d, est):
    r = pd.read_csv(d + "resumen_att.csv").set_index("Estimador").loc[est]; return (r.ATT, r["IC 95% inf"], r["IC 95% sup"])
def het(d, f, col, val):
    h = pd.read_csv(d + f"heterogeneidad_{f}.csv"); r = h[h[col] == val].iloc[0]; return (r.ATT, r.IC_inf, r.IC_sup)
def es(d, res, k):
    t = pd.read_csv(d + "event_study_todos.csv"); r = t[(t.resultado.str.startswith(res)) & (t.k == k)].iloc[0]; return (r.ATT, r.IC_inf, r.IC_sup)
def rg(d, key):
    t = pd.read_csv(d + "robustez_region_grupo.csv"); r = t[t.rg == key].iloc[0]; return (r.ATT, r.IC_inf, r.IC_sup)
D1, D2 = "resultados/", "resultados_col2/"
filas = [
  ("Uso antrópico · cota inferior", resumen(D1, "Emparejado, regla conservadora"), resumen(D2, "Emparejado, regla conservadora")),
  ("Uso antrópico · cota superior", resumen(D1, "Emparejado, regla estricta"), resumen(D2, "Emparejado, regla estricta")),
  ("Desde bosque nativo", het(D1, "grupo", "grupo", "Bosque"), het(D2, "grupo", "grupo", "Bosque")),
  ("Desde plantación", het(D1, "grupo", "grupo", "Silvicultura"), het(D2, "grupo", "grupo", "Silvicultura")),
  ("Desde matorral", het(D1, "grupo", "grupo", "Matorral"), het(D2, "grupo", "grupo", "Matorral")),
  ("Región de La Araucanía", het(D1, "region", "region", "Araucanía"), het(D2, "region", "region", "Araucanía")),
  ("Región del Biobío", het(D1, "region", "region", "Biobío"), het(D2, "region", "region", "Biobío")),
  ("Araucanía · bosque nativo", rg(D1, "Araucanía | Bosque"), rg(D2, "Araucanía | Bosque")),
  ("Infraestructura (k = 5)", es(D1, "Infraestructura", 5), es(D2, "Infraestructura", 5)),
]
fig, (ax, ax2) = plt.subplots(1, 2, figsize=(9.6, 4.6), gridspec_kw={"width_ratios": [3, 1.2]}, sharey=True)
y = np.arange(len(filas))[::-1]
for (n, a, b), yy in zip(filas, y):
    for v, off, col, lab in [(a, 0.17, "#9AA5B1", "Colección 1 (2000–2022)"), (b, -0.17, "#B23A1F", "Colección 2 (1999–2024)")]:
        ax.errorbar(v[0], yy + off, xerr=[[v[0] - v[1]], [v[2] - v[0]]], fmt="o", color=col, ms=5, capsize=2, lw=1.2,
                    label=lab if yy == y[0] else None)
ax.axvline(0, color="0.3", lw=0.8)
ax.set_yticks(y, [f[0] for f in filas]); ax.xaxis.set_major_formatter(mtick.PercentFormatter(1, decimals=0))
ax.set_xlabel("Efecto del fuego sobre el uso antrópico (pp, k = 1–5)")
ax.legend(frameon=False, loc="lower right", fontsize=8.5)
# degradación del bosque (k = 2) en panel aparte (otra escala)
d1, d2 = es(D1, "Degradación", 2), es(D2, "Degradación", 2)
for v, off, col in [(d1, 0.17, "#9AA5B1"), (d2, -0.17, "#B23A1F")]:
    ax2.errorbar(v[0], y[0] + off, xerr=[[v[0] - v[1]], [v[2] - v[0]]], fmt="o", color=col, ms=5, capsize=2)
ax2.set_xlim(0, 0.35); ax2.xaxis.set_major_formatter(mtick.PercentFormatter(1, decimals=0))
ax2.set_title("Degradación del bosque\nnativo (k = 2)", fontsize=9, loc="left")
ax2.tick_params(left=False)
fig.suptitle("Replicación con dos colecciones de MapBiomas Chile", x=0.01, ha="left", fontweight="bold")
fig.tight_layout(); fig.savefig("figuras_col2/fig8_replicacion.png", bbox_inches="tight")
pd.DataFrame([(n,)+a+b for n,a,b in filas], columns=["estimacion","c1","c1_inf","c1_sup","c2","c2_inf","c2_sup"]).to_csv("resultados_col2/replicacion.csv", index=False)
print("ok")
