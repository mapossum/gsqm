"""
regenerate_data.py — rebuild the course data files under W2/

Prerequisites:
    pip install pandas geopandas remotezip pyogrio

Run:
    python regenerate_data.py

Produces:
    W2/ejscreen_ms_coastal_2024.csv
    W2/tl_2023_28_bg_coastal.geojson
    W2/EJScreen_2024_BG_Percentiles_Columns.xlsx  (data-dictionary reference)

Takes 3-8 minutes depending on your connection to Zenodo and census.gov.
"""

import os
import zipfile
from pathlib import Path

import pandas as pd
import geopandas as gpd
import requests
from remotezip import RemoteZip

OUT_DIR = Path(__file__).parent / "W2"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TMP = Path("/tmp/ghy417_regen")
TMP.mkdir(parents=True, exist_ok=True)

# The three MS coastal counties
COUNTY_FIPS = ("28045", "28047", "28059")  # Hancock, Harrison, Jackson
STATE_FIPS = "28"

# --- 1. TIGER/Line block groups for MS ------------------------------------

print("[1/2] Downloading MS block-group boundaries from Census Bureau ...")
tiger_zip = TMP / "tl_2023_28_bg.zip"
tiger_dir = TMP / "tl_ms_bg"
if not tiger_zip.exists():
    r = requests.get(
        "https://www2.census.gov/geo/tiger/TIGER2023/BG/tl_2023_28_bg.zip",
        timeout=180,
    )
    r.raise_for_status()
    tiger_zip.write_bytes(r.content)

with zipfile.ZipFile(tiger_zip) as z:
    z.extractall(tiger_dir)

gdf = gpd.read_file(tiger_dir / "tl_2023_28_bg.shp")
coastal_geom = gdf[gdf["COUNTYFP"].isin([c[2:] for c in COUNTY_FIPS])].copy()
out_geo = OUT_DIR / "tl_2023_28_bg_coastal.geojson"
if out_geo.exists():
    out_geo.unlink()
coastal_geom.to_file(out_geo, driver="GeoJSON")
print(f"      wrote {out_geo} ({len(coastal_geom)} block groups)")

# --- 2. EPA EJScreen 2024 block-group CSV via Zenodo archive ---------------

print("[2/2] Streaming EJScreen 2024 v2.32 block-group CSV from Zenodo ...")
ZENODO_URL = "https://zenodo.org/records/14767363/files/2024.zip?download=1"
INNER = "2024/2.32_August_UseMe/EJSCREEN_2024_BG_with_AS_CNMI_GU_VI.csv.zip"
COLS_XLSX = "2024/2.32_August_UseMe/EJScreen_2024_BG_Percentiles_Columns.xlsx"

with RemoteZip(ZENODO_URL) as z:
    z.extract(INNER, path=TMP)
    z.extract(COLS_XLSX, path=TMP)

inner_zip = TMP / INNER
with zipfile.ZipFile(inner_zip) as zi:
    zi.extractall(inner_zip.parent)

csv_path = inner_zip.parent / "EJSCREEN_2024_BG_with_AS_CNMI_GU_VI.csv"

print(f"      filtering {csv_path.name} to MS coastal counties ...")
chunks = []
for chunk in pd.read_csv(csv_path, dtype={"ID": str}, chunksize=100_000, low_memory=False):
    chunks.append(chunk[chunk["ID"].str.startswith(COUNTY_FIPS)])
ej = pd.concat(chunks, ignore_index=True)
out_ej = OUT_DIR / "ejscreen_ms_coastal_2024.csv"
ej.to_csv(out_ej, index=False)
print(f"      wrote {out_ej} ({len(ej)} block groups)")

# Copy data-dictionary xlsx too
import shutil
shutil.copy(TMP / COLS_XLSX, OUT_DIR / "EJScreen_2024_BG_Percentiles_Columns.xlsx")
print(f"      wrote {OUT_DIR}/EJScreen_2024_BG_Percentiles_Columns.xlsx")

# --- Verify the join works -------------------------------------------------

print("\nVerification:")
merged = coastal_geom.merge(ej, left_on="GEOID", right_on="ID", how="inner")
print(f"  Block groups (geometry): {len(coastal_geom)}")
print(f"  Block groups (EJScreen): {len(ej)}")
print(f"  Successful joins:        {len(merged)}  (should match both)")
if len(merged) == len(coastal_geom) == len(ej):
    print("  ✓ All block groups match. Data is ready.")
else:
    print("  ⚠ Mismatch — check filtering logic.")
