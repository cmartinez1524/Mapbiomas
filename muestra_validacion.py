"""Genera la muestra para validar visualmente las conversiones de bosque nativo quemado.

Uso:  python muestra_validacion.py
Toma píxeles de bosque nativo quemados (Colección 2, cohortes 2014-2021, emparejados) que el
mapa clasifica como uso antrópico tres años después del incendio (k = 3), más un grupo de
comparación de bosque quemado que NO aparece convertido, y escribe:
  validacion_visual/muestra_validacion.csv   planilla para completar
  validacion_visual/muestra_validacion.kml   puntos para Google Earth Pro (imágenes históricas)
"""
import numpy as np, pandas as pd
import fuegocausal as fc

exec(open("prep_col2.py").read())
N_CONV, N_COMP, SEMILLA = 100, 40, 2026   # con el mínimo de 5 por región resultan 102 y 44
pares, _ = fc.panel_apilado(df, cohortes=range(2014, 2022), grupos=["Bosque"], verbose=False)
L = fc.matriz_lulc(df)
R = list(fc.RESULTADOS[list(fc.RESULTADOS)[0]])
t = pares[["i_trat", "cohorte"]].drop_duplicates()
i, g = t.i_trat.to_numpy(), t.cohorte.to_numpy()
conv = np.isin(L[i, g + 3 - fc.LULC_Y0], R)

rng = np.random.default_rng(SEMILLA)
def tomar(mask, n, tipo):
    m = pd.DataFrame({"i": i[mask], "anio_incendio": g[mask]})
    m["region"] = df.region.to_numpy()[m.i]
    # reparto proporcional por región, con al menos 5 puntos donde los haya
    cuota = (m.region.value_counts(normalize=True) * n).round().clip(lower=5).astype(int)
    s = pd.concat([x.sample(min(len(x), cuota[r]), random_state=int(rng.integers(1e9)))
                   for r, x in m.groupby("region")])
    return s.assign(tipo=tipo)

s = pd.concat([tomar(conv, N_CONV, "convertido"), tomar(~conv, N_COMP, "no convertido")])
s = s.sample(frac=1, random_state=SEMILLA).reset_index(drop=True)     # orden aleatorio (revisión a ciegas)
s.insert(0, "id", [f"V{n:03d}" for n in range(1, len(s) + 1)])
s["lon"], s["lat"] = df.lon.to_numpy()[s.i].round(6), df.lat.to_numpy()[s.i].round(6)
clase = lambda a: pd.Series(L[s.i.to_numpy(), a - fc.LULC_Y0]).map(fc.CLASES).fillna("otra").to_numpy()
s["clase_antes"] = clase(s.anio_incendio.to_numpy() - 1)
for k in (1, 3):
    s[f"clase_k{k}"] = clase(s.anio_incendio.to_numpy() + k)
s["clase_2024"] = clase(np.full(len(s), 2024))
s["google_maps"] = [f"https://www.google.com/maps/@{la},{lo},300m/data=!3m1!1e3" for la, lo in zip(s.lat, s.lon)]
for c in ["bosque_antes (si/no/dudoso)", "uso_observado_despues", "conversion_real (si/no/dudoso)", "fecha_imagen", "nota"]:
    s[c] = ""

# la planilla de revisión no muestra el tipo ni las clases posteriores (revisión a ciegas)
s.drop(columns="i").to_csv("validacion_visual/clave_muestra.csv", index=False)
s.drop(columns=["i", "tipo", "clase_k1", "clase_k3", "clase_2024"]).to_csv(
    "validacion_visual/muestra_validacion.csv", index=False, encoding="utf-8-sig")
kml = ['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
       "<name>Validación visual: bosque nativo quemado</name>"]
for r in s.itertuples():
    kml.append(f"<Placemark><name>{r.id}</name><description>Incendio {r.anio_incendio} · {r.region}. "
               f"Comparar imágenes de {r.anio_incendio - 1} y de {r.anio_incendio + 3} en adelante.</description>"
               f"<Point><coordinates>{r.lon},{r.lat},0</coordinates></Point></Placemark>")
kml.append("</Document></kml>")
open("validacion_visual/muestra_validacion.kml", "w", encoding="utf-8").write("\n".join(kml))
print(f"bosque quemado emparejado: {len(i)} | convertido en k=3: {conv.sum()} ({conv.mean():.1%})")
print(s.groupby(["tipo", "region"]).size().unstack(fill_value=0))
print(pd.crosstab(s.tipo, s.clase_k3))
