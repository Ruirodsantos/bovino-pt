"""Extrai a dispersão de criadores dos mapas das fichas DGAV (GRGA) de cada raça bovina.

Entrada: PDFs das fichas (página 1 tem o mapa de Portugal com bolhas = locais de criadores).
Saída: JSON por raça com pontos aproximados (lat, lon, peso relativo ao raio da bolha).
Método: renderiza a página, isola a silhueta azul de Portugal continental, calibra a caixa
para as coordenadas reais do continente e converte o centro de cada bolha. A precisão é de
alguns quilómetros: os pontos são DISPERSÃO APROXIMADA, não moradas.
"""
import sys, json, glob, os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# Caixa do continente (graus): sul, norte, oeste, este
S, N, W, E_ = 36.96, 42.154, -9.50, -6.19
CROP = (2150, 120, 2914, 1120)  # região do mapa na página 1 a 200 dpi

def render(pdf, out, dpi=200):
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", "1", "-l", "1", pdf, out], check=True)
    return out + "-1.png"

def analyse(png):
    full = np.array(Image.open(png).convert("RGB")).astype(int)
    x0, y0, x1, y1 = CROP
    im = full[y0:y1, x0:x1]
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    blue = (abs(r - 170) < 16) & (abs(g - 195) < 16) & (abs(b - 228) < 16)
    blue = ndi.binary_closing(blue, iterations=2)
    lb, n = ndi.label(blue)
    sizes = ndi.sum(blue, lb, range(1, n + 1))
    main = lb == (np.argmax(sizes) + 1)
    ys, xs = np.where(main)
    bbox = (xs.min(), xs.max(), ys.min(), ys.max())
    # bolhas: pixels saturados (verde/azul/vermelho) dentro da silhueta dilatada
    mx = max(r.max(), 1)
    sat = (im.max(axis=2) - im.min(axis=2)) > 70
    green = (g > r + 35) & (g > b + 5)
    other = sat & ~green & ~blue
    dots = ((green & sat) | other)
    zone = ndi.binary_dilation(main, iterations=10)
    # silhueta preenchida (buracos internos) para apanhar bolhas sobre as fronteiras
    zone = ndi.binary_fill_holes(zone)
    dots &= zone
    dots = ndi.binary_opening(dots, iterations=1)
    return im, main, bbox, dots

def circles(dots):
    """Separa bolhas sobrepostas com transformada de distância + máximos locais."""
    dist = ndi.distance_transform_edt(dots)
    mx = ndi.maximum_filter(dist, size=7)
    peaks = (dist == mx) & (dist >= 2.0)
    lp, n = ndi.label(peaks)
    out = []
    for i in range(1, n + 1):
        yy, xx = np.where(lp == i)
        out.append((xx.mean(), yy.mean(), dist[yy[0], xx[0]]))
    return out

def align(main, tmpl, win):
    """Melhor deslocamento (dx, dy) dentro da janela `win` ((dxmin,dxmax),(dymin,dymax)) e a sua pontuação."""
    from scipy.signal import fftconvolve
    a = main.astype(float); t = tmpl.astype(float)
    corr = fftconvolve(a, t[::-1, ::-1], mode="full")
    best = (-1, 0, 0)
    for dy in range(win[1][0], win[1][1] + 1):
        for dx in range(win[0][0], win[0][1] + 1):
            iy, ix = dy + t.shape[0] - 1, dx + t.shape[1] - 1
            if 0 <= iy < corr.shape[0] and 0 <= ix < corr.shape[1] and corr[iy, ix] > best[0]:
                best = (corr[iy, ix], dx, dy)
    return best[1], best[2], best[0] / t.sum()

def to_geo(x, y, bbox):
    xmin, xmax, ymin, ymax = bbox
    lon = W + (x - xmin) / (xmax - xmin) * (E_ - W)
    lat = N - (y - ymin) / (ymax - ymin) * (N - S)
    return round(float(lat), 3), round(float(lon), 3)

if __name__ == "__main__":
    pdf_dir, out_dir, work = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out_dir, exist_ok=True); os.makedirs(work, exist_ok=True)
    # Existem duas versões do mapa nas fichas (A: Alentejana; B: Mirandesa); alinha-se pela melhor.
    tmpl = {}
    for key, ref in (("A", "Alentejana_GRGA"), ("B", "Mirandesa_GRGA")):
        _, tm, tb, _ = analyse(render(os.path.join(pdf_dir, ref + ".pdf"), os.path.join(work, ref)))
        tmpl[key] = (tm, tb)
    for pdf in sorted(glob.glob(os.path.join(pdf_dir, "*.pdf"))):
        name = os.path.basename(pdf)
        png = render(pdf, os.path.join(work, name[:-4]))
        im, main, bbox, dots = analyse(png)
        raw_bbox = bbox
        if name.startswith(("Catrina", "Ramo-Grande")):
            bbox = None
        else:
            win = ((-14, 14), (-80, -50)) if name.startswith("Mertolenga") else ((-14, 14), (-14, 14))
            cands = []
            for key, (tm, tb) in tmpl.items():
                dx, dy, sc = align(main, tm, win)
                cands.append((sc, key, dx, dy, tb))
            sc, key, dx, dy, tb = max(cands)
            bbox = (tb[0] + dx, tb[1] + dx, tb[2] + dy, tb[3] + dy)
            if name.startswith("Barrosa"):
                bbox = raw_bbox  # a ficha da Barrosa usa o mapa numa escala maior (validado à vista)
            print("   modelo", key, "desloc", dx, dy, "pontuação", round(sc, 3))
        if bbox is None:
            continue
        pts = circles(dots)
        # fundir picos a menos de 4 px
        merged = []
        for x, y, rad in sorted(pts, key=lambda p: -p[2]):
            if all((x - a) ** 2 + (y - b_) ** 2 > 16 for a, b_, _ in merged):
                merged.append((x, y, rad))
        def cor(x, y):
            r_, g_, b_ = im[int(round(y)), int(round(x))]
            if b_ > r_ + 40 and b_ > g_ + 20: return "azul"
            if r_ > g_ + 50 and r_ > b_ + 50: return "vermelho"
            return "verde-claro" if g_ > 140 else "verde"
        res = []
        for x, y, rad in merged:
            lat, lon = to_geo(x, y, bbox)
            d = {"lat": lat, "lon": lon, "r": round(float(rad), 1)}
            if name.startswith("Mertolenga"): d["variedade_cor"] = cor(x, y)
            res.append(d)
        json.dump({"file": name, "bbox_px": [int(v) for v in bbox], "n": len(res), "points": res},
                  open(os.path.join(out_dir, name[:-4] + ".json"), "w"), ensure_ascii=False)
        print(name, "bbox", [int(v) for v in bbox], "pontos", len(res))
