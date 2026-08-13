# GHY 417/517 — Course Data Repository

Public data files used by course lab notebooks. Stage under `mapossum/gsqm` on GitHub (or update the URLs in each lab notebook to point wherever you host these files).

## Layout

```
W2/  — Week 2, Lab 1 (Data Audit — EJScreen MS coastal counties)
```

## Week 2 files

### Required for Lab 1

- **`W2/ejscreen_ms_coastal_2024.csv`** (~640 KB) — EPA EJScreen 2024 (release v2.32, August "UseMe" version). Filtered to the 357 census block groups in Hancock (28045), Harrison (28047), and Jackson (28059) counties, Mississippi. All 231 columns preserved. `ID` column is the 12-character block-group FIPS code (join key to the geometry file).

- **`W2/tl_2023_28_bg_coastal.geojson`** (~2.8 MB) — US Census Bureau TIGER/Line 2023 block-group boundaries for the same three counties. CRS: NAD83 (EPSG:4269). Join key: `GEOID` column (matches `ID` in the EJScreen CSV).

### Optional reference files (can be deleted if you want to keep the repo minimal)

- **`W2/EJScreen_2024_BG_Percentiles_Columns.xlsx`** (~22 KB) — EPA's official column-definitions spreadsheet. Useful as a data dictionary for the 231 columns in the EJScreen CSV.

- **`W2/EJScreen_2024_BG_State_Lookup.csv`** (~5 MB) — EPA's state-level percentile-to-value lookup table. National reference table (not filtered). Not strictly needed for Lab 1; kept in case students want to explore percentile calculations.

- **`W2/EJScreen_2024_BG_National_Lookup.csv`** (~98 KB) — EPA's national percentile-to-value lookup table. Not strictly needed for Lab 1.

## Source & provenance

Downloaded from the Zenodo mirror of the EPA EJScreen archive (DOI [10.5281/zenodo.14767363](https://doi.org/10.5281/zenodo.14767363)). The original EPA distribution site (`gaftp.epa.gov/EJScreen/`) was taken offline in early 2025; the Zenodo mirror by Fitzgerald & Gehrke (Environmental Data & Governance Initiative) is the current authoritative archive.

EJScreen release used: **2024 v2.32 (August, "UseMe" version)** — the latest official EPA release before archival.

## License

- EJScreen data: **public domain** (17 U.S.C. § 105, US federal government work). Attribution to EPA is expected.
- TIGER/Line block-group boundaries: **public domain** (US Census Bureau).
- The Zenodo mirror is redistributed under CC-BY-4.0.

Citation for EJScreen:
> US Environmental Protection Agency (2024). *EJScreen: Environmental Justice Screening and Mapping Tool*, version 2.32. Archived at Zenodo, DOI 10.5281/zenodo.14767363.

## How the lab notebook references these files

Inside `Week2/W2_Lab1_Data_Audit.ipynb`, the two URLs used are:

```python
EJSCREEN_URL   = "https://raw.githubusercontent.com/mapossum/gsqm/main/W2/ejscreen_ms_coastal_2024.csv"
BLOCKGROUPS_URL = "https://raw.githubusercontent.com/mapossum/gsqm/main/W2/tl_2023_28_bg_coastal.geojson"
```

Update the org/repo path if your GitHub layout differs.

## How this data was produced (reproducibility)

The full workflow is captured in `regenerate_data.py` (also in this folder). Broad outline:

1. Downloaded the 2024 EPA EJScreen block-group CSV via a range-request from the Zenodo `2024.zip` archive (the whole zip is 5.2 GB; only the block-group CSV inside is needed).
2. Filtered to rows where `ID` starts with `28045`, `28047`, or `28059`.
3. Downloaded MS statewide TIGER/Line 2023 block-group shapefile from `https://www2.census.gov/geo/tiger/TIGER2023/BG/tl_2023_28_bg.zip`.
4. Filtered to `COUNTYFP` in `045`, `047`, `059` and converted to GeoJSON.

Rebuilding these files takes about 5 minutes on a normal laptop.
