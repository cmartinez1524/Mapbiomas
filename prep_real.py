# Preparación común de los datos reales (Colección 1), idéntica al notebook 02
df = pd.read_csv("datos/muestra_mapbiomas_col1.csv")
for c in ["dist_urb", "dist_agr", "dist_silv"]:
    df[c] = df[c].clip(upper=43_000)
from asignar_regiones import asignar
df["region"] = asignar(df.lon.to_numpy(), df.lat.to_numpy())   # límites oficiales MapBiomas (nivel político 2)
df = fc.preparar_covariables(df)
fc.COVARIABLES = [c for c in fc.COVARIABLES if c != "log_dist_road"]
