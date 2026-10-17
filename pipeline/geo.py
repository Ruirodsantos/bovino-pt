"""Keep only Portuguese and Spanish NUTS 2 regions from the GISCO GeoJSON and round coordinates."""
import json, sys

def rnd(c):
    return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]

src, dst = sys.argv[1], sys.argv[2]
g = json.load(open(src, encoding="utf-8"))
feats = []
for f in g["features"]:
    p = f["properties"]
    nid = p.get("NUTS_ID") or p.get("id")
    if not nid or nid[:2] not in ("PT", "ES"):
        continue
    f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
    feats.append({"type": "Feature", "properties": {"name": nid, "label": p.get("NAME_LATN") or p.get("NUTS_NAME")},
                  "geometry": f["geometry"]})
json.dump({"type": "FeatureCollection", "features": feats,
           "attribution": "© EuroGeographics para as fronteiras administrativas (Eurostat GISCO)"},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(feats), "regiões")
