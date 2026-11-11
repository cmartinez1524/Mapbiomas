"""Ejemplos visuales de la muestra de validación: trayectoria anual de cobertura (Colección 2)
de 16 píxeles de bosque nativo quemado, con el año del incendio marcado.

Uso:  python figura_ejemplos.py        (requiere validacion_visual/clave_muestra.csv)
Salida: validacion_visual/ejemplos_trayectorias.png y figuras_col2/fig9_ejemplos_trayectorias.png
"""
import numpy as np, pandas as pd, matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch
import fuegocausal as fc

exec(open("prep_col2.py").read())
L = fc.matriz_lulc(df)
clave = pd.read_csv("validacion_visual/clave_muestra.csv")
pos = pd.Series(np.arange(len(df)), index=pd.MultiIndex.from_arrays([df.lon.round(6), df.lat.round(6)]))
clave["i"] = pos.reindex(pd.MultiIndex.from_arrays([clave.lon, clave.lat])).to_numpy()

# leyenda simplificada
LEY = [("Bosque nativo", {3, 59, 60, 67}, "#1f7a3a"), ("Matorral", {66}, "#b5c77a"),
       ("Pastizal o estepa", {12, 63}, "#ecdf9a"), ("Plantación forestal", {9}, "#7a5230"),
       ("Agricultura", {18}, "#d1478c"), ("Pastura", {15}, "#f0a23c"),
       ("Infraestructura", {24}, "#555555"), ("Otra", set(), "#d9d9d9")]
cod = np.full(L.shape, len(LEY) - 1, dtype=int)
for n, (_, cl, _) in enumerate(LEY[:-1]):
    cod[np.isin(L, list(cl))] = n
antro, bosque = ["Agricultura", "Pastura", "Infraestructura"], ["Bosque", "Bosque primario", "Bosque secundario", "Bosque achaparrado"]
PANELES = [
    ("a) Conversión que persiste: uso antrópico a los 3 años y en 2024", clave.clase_k3.isin(antro) & clave.clase_2024.isin(antro)),
    ("b) Conversión transitoria: uso antrópico a los 3 años, bosque en 2024", clave.clase_k3.isin(antro) & clave.clase_2024.isin(bosque)),
    ("c) Degradación: matorral a los 3 años", clave.clase_k3.eq("Matorral")),
    ("d) Sin cambio de clase: bosque a los 3 años", clave.clase_k3.isin(bosque)),
]
anios = np.array(fc.ANIOS)
fig, axs = plt.subplots(4, 1, figsize=(9.2, 8.6), sharex=True)
cmap = ListedColormap([c for _, _, c in LEY])
for ax, (tit, m) in zip(axs, PANELES):
    s = clave[m].drop_duplicates("region").head(4)                 # una por región, las 4 primeras
    if len(s) < 4:
        s = pd.concat([s, clave[m & ~clave.id.isin(s.id)].head(4 - len(s))])
    ax.imshow(cod[s.i.to_numpy()], cmap=cmap, vmin=-.5, vmax=len(LEY) - .5, aspect="auto",
              extent=(anios[0] - .5, anios[-1] + .5, len(s) - .5, -.5), interpolation="nearest")
    for y in range(len(s) + 1):
        ax.axhline(y - .5, color="white", lw=2.5)
    for x in anios[:-1]:
        ax.axvline(x + .5, color="white", lw=.6)
    for y, g in enumerate(s.anio_incendio):
        ax.plot([g - .5, g - .5], [y - .5, y + .5], color="black", lw=2.2)
        ax.plot(g - .5, y - .5, marker="v", color="black", ms=7, clip_on=False)
    ax.set_yticks(range(len(s)), [f"{r.id} · {r.region} · {r.anio_incendio}" for r in s.itertuples()], fontsize=8.5)
    ax.set_title(tit, loc="left", fontsize=10, fontweight="bold")
    ax.tick_params(length=0)
    for sp in ax.spines.values():
        sp.set_visible(False)
axs[-1].set_xticks(anios[::2] + 1 if anios[0] % 2 else anios[::2])
axs[-1].set_xlabel("Año de la cobertura (MapBiomas Chile, Colección 2)")
fig.legend(handles=[Patch(color=c, label=n) for n, _, c in LEY] +
           [plt.Line2D([], [], color="black", marker="v", lw=2, label="Año del incendio")],
           loc="lower center", ncol=5, frameon=False, fontsize=8.5, bbox_to_anchor=(.5, -.005))
fig.tight_layout(rect=(0, .06, 1, 1))
for f in ["validacion_visual/ejemplos_trayectorias.png", "figuras_col2/fig9_ejemplos_trayectorias.png"]:
    fig.savefig(f, dpi=200)
print(pd.concat([clave[m].assign(panel=t[:1]) for t, m in PANELES]).panel.value_counts().sort_index().to_string())
