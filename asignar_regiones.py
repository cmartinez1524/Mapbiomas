"""Asigna la región oficial (MapBiomas Chile, nivel político 2) a cada píxel de la muestra."""
import os
import geopandas as gpd, pandas as pd, numpy as np

CORTO = {"Valparaíso": "Valparaíso", "Metropolitana de Santiago": "Metropolitana",
         "Libertador General Bernardo O'Higgins": "O'Higgins", "Maule": "Maule", "Ñuble": "Ñuble",
         "Biobío": "Biobío", "La Araucanía": "Araucanía", "Los Ríos": "Los Ríos", "Coquimbo": "Coquimbo"}

def regiones():
    if os.path.exists("datos/regiones_zona_estudio.geojson"):
        return gpd.read_file("datos/regiones_zona_estudio.geojson")
    g = gpd.read_file("zip://datos/mapbiomas_chile_regiones_nivel2.zip", encoding="latin1")
    g["region"] = g.NAME.map(CORTO)
    g = g[g.region.notna()].to_crs(4326)[["region", "geometry"]]
    g["geometry"] = g.geometry.simplify(0.001, preserve_topology=True)   # ~100 m
    g.to_file("datos/regiones_zona_estudio.geojson", driver="GeoJSON")
    return g

def asignar(lon, lat):
    g = regiones()
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(lon, lat), crs=4326)
    j = gpd.sjoin(pts, g, how="left", predicate="within")
    j = j[~j.index.duplicated()]
    reg = j.region.to_numpy(dtype=object)
    # píxeles costeros que caen fuera por la simplificación -> región más cercana
    falt = pd.isna(reg)
    if falt.any():
        nn = gpd.sjoin_nearest(pts[falt].to_crs(32719), g.to_crs(32719), how="left")
        nn = nn[~nn.index.duplicated()]
        reg[falt] = nn.region.to_numpy()
    return reg

if __name__ == "__main__":
    df = pd.read_csv("datos/muestra_mapbiomas_col1.csv", usecols=["lon", "lat"])
    r = asignar(df.lon.to_numpy(), df.lat.to_numpy())
    print(pd.Series(r).value_counts(dropna=False).to_dict())
    print("MB geojson:", round(os.path.getsize("datos/regiones_zona_estudio.geojson") / 1e6, 2))
