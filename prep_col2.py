# Preparación de los datos de la Colección 2 (Earth Engine), análoga a prep_real.py
import glob
df = pd.concat([pd.read_csv(f) for f in sorted(glob.glob("datos/col2/col2_muestra_*.csv"))], ignore_index=True)
df = df.drop(columns=[c for c in ["system:index", ".geo"] if c in df])
df = df.drop_duplicates(subset=["lon", "lat"]).reset_index(drop=True)   # bordes compartidos entre estratos
# distancias: sin referencia dentro de la vecindad (256 px de 120 m) -> se acota al máximo medible
for c in ["dist_road", "dist_urb", "dist_agr", "dist_silv"]:
    df[c] = df[c].clip(upper=256 * 120)
areas = pd.read_csv("datos/col2/col2_areas_quemadas.csv").rename(columns={"sum": "ha"})
# pesos muestrales por estrato geográfico x cohorte (diseño del muestreo en Earth Engine)
df["region"] = df["estrato_geo"]
df = fc.pesos_muestrales(df, areas)
# región oficial (límites MapBiomas, nivel político 2) para emparejamiento y heterogeneidad
from asignar_regiones import asignar
df["region"] = asignar(df.lon.to_numpy(), df.lat.to_numpy())
df = fc.preparar_covariables(df)
