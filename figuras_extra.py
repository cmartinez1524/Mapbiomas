"""Figuras adicionales para el informe: mapa de focos (Fig. 6) y conversión persistente (Fig. 7)."""
import numpy as np, pandas as pd, matplotlib.pyplot as plt, matplotlib.ticker as mtick
from matplotlib.colors import TwoSlopeNorm
import sys
import fuegocausal as fc
COL2 = len(sys.argv) > 1 and sys.argv[1] == "col2"
if COL2:
    exec(open("prep_col2.py").read()); FIG, RES, COH = "figuras_col2/", "resultados_col2/", (2014, 2023)
else:
    fc.usar_coleccion1(2005, 2022)
    exec(open("prep_real.py").read()); FIG, RES, COH = "figuras/", "resultados/", (2014, 2021)
plt.rcParams.update({"figure.dpi": 110, "savefig.dpi": 200, "font.size": 10, "font.family": "DejaVu Sans",
                     "axes.spines.top": False, "axes.spines.right": False})

het = pd.read_csv(RES + "heterogeneidad_region.csv").set_index("region")
q = df.fire_first.between(*COH)
fig, axs = plt.subplots(1, 2, figsize=(9.2, 7.4), sharey=True)
# (a) dónde se quemó
ax = axs[0]
ax.scatter(df.lon[~q], df.lat[~q], s=0.15, c="#D9D9D9", rasterized=True, lw=0)
sc = ax.scatter(df.lon[q], df.lat[q], s=0.25, c=df.fire_first[q], cmap="inferno_r", vmin=COH[0], vmax=COH[1],
                rasterized=True, lw=0)
cb = fig.colorbar(sc, ax=ax, shrink=0.45, pad=0.02); cb.set_label("Año del primer incendio")
ax.set_title("a) Píxeles quemados muestreados\n(gris: controles nunca quemados)", loc="left", fontsize=10)
# (b) efecto por región, sobre los límites oficiales
def fmt_pp(x):
    """Puntos porcentuales con coma decimal y signo menos tipográfico."""
    v = round(x * 100, 1)
    return "0,0" if v == 0 else f"{v:+.1f}".replace(".", ",").replace("-", "−")


import geopandas as gpd
ax = axs[1]
reg = gpd.read_file("datos/regiones_zona_estudio.geojson")
reg = reg.merge(het[["ATT", "IC_inf", "IC_sup", "n_trat"]], left_on="region", right_index=True, how="left")
ok = reg.n_trat >= 300
norm = TwoSlopeNorm(vmin=-0.02, vcenter=0, vmax=0.02 if COL2 else 0.10)
cmap = plt.get_cmap("RdBu_r")
reg[~ok].plot(ax=ax, color="#EEEEEE", edgecolor="white", lw=0.6)
reg[ok].plot(ax=ax, color=[cmap(norm(v)) for v in reg[ok].ATT], edgecolor="white", lw=0.8)
ax.scatter(df.lon, df.lat, s=0.05, c="k", alpha=0.08, rasterized=True, lw=0)
sm = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
cb2 = fig.colorbar(sm, ax=ax, shrink=0.45, pad=0.02, format=mtick.PercentFormatter(1, decimals=None))
cb2.set_label("Efecto del fuego (pp, k=1–3)")
for _, h in reg[ok].iterrows():
    sig = "" if (h.IC_inf > 0 or h.IC_sup < 0) else " (n.s.)"
    y = h.geometry.representative_point().y
    ax.text(-70.05, y, f"{h.region}\n" + fmt_pp(h.ATT) + f" pp{sig}", fontsize=8, va="center", ha="left")
ax.set_xlim(-74.0, -68.4); ax.set_ylim(df.lat.min() - 0.3, df.lat.max() + 0.3); ax.set_ylabel("")
ax.set_title("b) Efecto causal del fuego sobre el cambio\na uso antrópico, por región (límites oficiales)", loc="left", fontsize=10)
for a in axs:
    a.set_aspect(1 / np.cos(np.deg2rad(-35.5))); a.set_xlabel("Longitud")
axs[0].set_ylabel("Latitud")
fig.tight_layout(); fig.savefig(FIG + "fig6_mapa_focos.png", bbox_inches="tight")

# Fig 7: conversión persistente por cobertura previa
p = pd.read_csv(RES + "robustez_persistente.csv", index_col=0)
p = p[p.desde_k == 2]
orden = ["Todos", "Bosque", "Silvicultura", "Matorral", "Pastizal/estepa" if COL2 else "Pastizal"]
p = p.set_index("grupo").loc[orden].reset_index()
fig, ax = plt.subplots(figsize=(7.2, 3.4))
x = np.arange(len(p)); w = 0.38
ax.bar(x - w/2, p.conv_controles, w, color="#3B6E8F", label="Controles emparejados (sin fuego)")
ax.bar(x + w/2, p.conv_quemados, w, color="#B23A1F", label="Quemados")
for i, r in p.iterrows():
    sig = "*" if (r.IC_inf > 0 or r.IC_sup < 0) else ""
    ax.text(i + w/2, r.conv_quemados + 0.001, fmt_pp(r.ATT_persistente) + f" pp{sig}", ha="center", fontsize=8.5)
ax.set_xticks(x, ["Todas las\ncoberturas", "Bosque\nnativo", "Plantación\nforestal", "Matorral", "Pastizal/\nestepa" if COL2 else "Pastizal"])
ax.yaxis.set_major_formatter(mtick.PercentFormatter(1, decimals=0))
ax.set_ylabel("Uso antrópico 3 años seguidos\n(desde k = 2)")
ax.set_title("Conversión persistente: quemados vs. controles emparejados", loc="left", fontweight="bold")
ax.legend(frameon=False, fontsize=8.5, loc="upper left")
ax.text(1.0, -0.28, "* IC 95 % excluye el cero. Etiqueta = efecto (quemados − controles).", transform=ax.transAxes,
        ha="right", fontsize=7.5, color="0.35")
fig.tight_layout(); fig.savefig(FIG + "fig7_persistencia.png", bbox_inches="tight")
print("ok")
