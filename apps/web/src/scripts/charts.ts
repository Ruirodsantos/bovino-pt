import * as echarts from "echarts/core";
import { LineChart, BarChart, MapChart, ScatterChart, EffectScatterChart, LinesChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, GeoComponent, AriaComponent, GraphicComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, MapChart, ScatterChart, EffectScatterChart, LinesChart, GraphicComponent, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, GeoComponent, AriaComponent, CanvasRenderer]);

const BASE = (import.meta as any).env.BASE_URL as string;
type Row = { geo: string; geo_label: string; partner_geo: string | null; flow: string; product_code: string | null; product_label: string | null; series: string; period: string; value: number; unit: string };
type DS = { meta: Record<string, any>; rows: Row[] };

const cache = new Map<string, Promise<DS | null>>();
function load(id: string): Promise<DS | null> {
  if (!cache.has(id)) cache.set(id, fetch(`${BASE}data/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(id)!;
}
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const EN = document.documentElement.lang.startsWith("en");
const LOC = EN ? "en-GB" : "pt-PT";
const T = (pt: string, en: string) => (EN ? en : pt);
const nf = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
const nfc = new Intl.NumberFormat(LOC, { notation: "compact", maximumFractionDigits: 1 });
const MONTHS = EN ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] : ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function theme() {
  return { ink: css("--ink"), muted: css("--muted"), line: css("--line"), pasture: css("--pasture"), schist: css("--schist"), accent: css("--accent"), cork: css("--cork"), surface: css("--surface") };
}
function axisStyle(t: ReturnType<typeof theme>) {
  return {
    axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontFamily: "Lexend Variable" }, splitLine: { lineStyle: { color: t.line, type: "dashed" as const } },
  };
}
function baseOpt(t: ReturnType<typeof theme>) {
  return {
    textStyle: { fontFamily: "Lexend Variable", color: t.ink },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, backgroundColor: t.surface, borderColor: t.line, textStyle: { color: t.ink } },
    legend: { top: 0, left: 0, textStyle: { color: t.muted }, icon: "roundRect" },
    aria: { enabled: true },
  };
}

/** Annual totals; a year is "complete" only with 12 months. Partial years are labelled. */
function annual(rows: Row[]): { years: string[]; label: (y: string) => string; sum: (filter: (r: Row) => boolean) => number[] } {
  const monthsByYear = new Map<string, Set<string>>();
  rows.forEach((r) => { const y = r.period.slice(0, 4); if (!monthsByYear.has(y)) monthsByYear.set(y, new Set()); monthsByYear.get(y)!.add(r.period); });
  const years = [...monthsByYear.keys()].sort();
  const label = (y: string) => { const n = monthsByYear.get(y)!.size; return n >= 12 ? y : `${y} (${MONTHS[0]}–${MONTHS[n - 1]})`; };
  const sum = (f: (r: Row) => boolean) => years.map((y) => rows.filter((r) => r.period.startsWith(y) && f(r)).reduce((a, r) => a + r.value, 0));
  return { years, label, sum };
}

// CN 0102 groups (Combined Nomenclature). Official labels are shown in the data table.
export function cnGroup(code: string): string | null {
  if (code === "0102") return null; // aggregate
  if (code.startsWith("010221") || code === "01029020" || code.startsWith("0102 21")) return T("Reprodutores de raça pura", "Pure-bred breeding animals");
  if (code === "01022910") return T("Vitelos até 80 kg", "Calves up to 80 kg");
  if (["01022921", "01022941", "01022951", "01022961", "01022991"].includes(code)) return T("Para abate", "For slaughter");
  if (["01022929", "01022949", "01022959", "01022969", "01022999"].includes(code)) return T("Outros (recria / engorda)", "Others (rearing / fattening)");
  return T("Outras categorias", "Other categories");
}
const GROUP_COLORS = ["--pasture", "--cork", "--accent", "--schist", "--muted"];

const renderers: Record<string, (el: HTMLElement, ds: DS, mode: string) => any> = {
  population(el, ds, mode) {
    const t = theme();
    const geos = ["PT", "ES"];
    const periods = [...new Set(ds.rows.map((r) => r.period))].sort();
    const series = geos.map((g, i) => {
      const s = new Map(ds.rows.filter((r) => r.geo === g).map((r) => [r.period, r.value]));
      const first = periods.map((p) => s.get(p)).find((v) => v != null) ?? 1;
      return {
        name: g === "PT" ? "Portugal" : T("Espanha", "Spain"), type: "line", smooth: true, showSymbol: false, lineStyle: { width: 3 },
        color: i === 0 ? t.pasture : t.schist,
        data: periods.map((p) => { const v = s.get(p); return v == null ? null : mode === "index" ? +(100 * v / first).toFixed(1) : v; }),
      };
    });
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => (v == null ? "—" : mode === "index" ? `${v.toLocaleString(LOC)}` : `${nf.format(v)} ${T("cabeças", "head")}`) },
      xAxis: { type: "category", data: periods, ...axisStyle(t) },
      yAxis: { type: "value", scale: mode === "index", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => (mode === "index" ? `${v}` : nfc.format(v)) } },
      series,
    };
  },

  "live-trade"(el, ds, mode) {
    const t = theme();
    const ind = mode === "eur" ? "VALUE_IN_EUROS" : "SUPPLEMENTARY_QUANTITY";
    const rows = ds.rows.filter((r) => r.series.endsWith(ind) && r.product_code && r.product_code !== "0102");
    const a = annual(mode === "eur" ? ds.rows.filter((r) => r.series.endsWith(ind)) : rows);
    const groups = [...new Set(rows.map((r) => cnGroup(r.product_code!)).filter(Boolean))] as string[];
    const series: any[] = groups.map((g, i) => ({ name: g, type: "bar", stack: "t", barMaxWidth: 34, color: css(GROUP_COLORS[i % GROUP_COLORS.length]),
      data: a.sum((r) => cnGroup(r.product_code!) === g) }));
    if (mode === "eur") {
      // Official total (code 0102) minus detailed categories = not broken down here.
      const totals = ds.rows.filter((r) => r.product_code === "0102" && r.series.endsWith(ind));
      const tot = a.years.map((y) => totals.filter((r) => r.period.startsWith(y)).reduce((s, r) => s + r.value, 0));
      const parts = a.years.map((_, i) => series.reduce((s, x) => s + x.data[i], 0));
      series.push({ name: T("Não discriminado / anterior a 2012", "Not specified / before 2012"), type: "bar", stack: "t", barMaxWidth: 34, color: t.line,
        data: tot.map((v, i) => Math.max(0, v - parts[i])) });
    }
    series[series.length - 1].itemStyle = { borderRadius: [4, 4, 0, 0] };
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => (mode === "eur" ? `${nfc.format(v)} €` : `${nf.format(v)} ${T("cabeças", "head")}`) },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => nfc.format(v) } },
      series,
    };
  },

  "beef-balance"(el, ds) {
    const t = theme();
    const rows = ds.rows.filter((r) => r.series.endsWith("QUANTITY_IN_100KG"));
    const a = annual(rows);
    const tonnes = (f: string) => a.sum((r) => r.flow === f).map((v) => +(v / 1000).toFixed(0));
    return {
      ...baseOpt(t),
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => `${nf.format(v)} t` },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => `${nfc.format(v)} t` } },
      series: [
        { name: T("Portugal compra a Espanha", "Portugal buys from Spain"), type: "bar", color: t.schist, barMaxWidth: 22, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: tonnes("import") },
        { name: T("Portugal vende a Espanha", "Portugal sells to Spain"), type: "bar", color: t.pasture, barMaxWidth: 22, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: tonnes("export") },
      ],
    };
  },

  "live-exports-world"(el, ds) {
    const t = theme();
    const rows = ds.rows.filter((r) => r.geo === "PT");
    const a = annual(rows);
    return {
      ...baseOpt(t), legend: { show: false },
      tooltip: { ...baseOpt(t).tooltip, valueFormatter: (v: number) => `${nf.format(v)} ${T("cabeças", "head")}` },
      xAxis: { type: "category", data: a.years.map(a.label), ...axisStyle(t) },
      yAxis: { type: "value", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => nfc.format(v) } },
      series: [{ name: T("Portugal — exportações de bovinos vivos (todos os destinos)", "Portugal — live cattle exports (all destinations)"), type: "bar", color: t.accent, barMaxWidth: 26, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: a.sum(() => true) }],
    };
  },
};

async function mapChart(el: HTMLElement) {
  const t = theme();
  const [ds, geo] = await Promise.all([load("bovine_population_regions"), fetch(`${BASE}geo/nuts2.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  if (!ds || !geo) return empty(el);
  echarts.registerMap("iberia", geo);
  const year = [...new Set(ds.rows.map((r) => r.period))].sort().pop()!;
  const latest = new Map<string, number>();
  // latest available year per region (regions report in different years)
  [...ds.rows].sort((a, b) => a.period.localeCompare(b.period)).forEach((r) => latest.set(r.geo, r.value));
  const yearOf = new Map<string, string>();
  [...ds.rows].sort((a, b) => a.period.localeCompare(b.period)).forEach((r) => yearOf.set(r.geo, r.period));
  const labels = new Map<string, string>(geo.features.map((f: any) => [f.properties.name, f.properties.label]));
  const data = [...latest].map(([name, value]) => ({ name, value }));
  const max = Math.max(...data.map((d) => d.value));
  const chart = echarts.init(el, null, { renderer: "canvas" });
  chart.setOption({
    tooltip: { trigger: "item", backgroundColor: t.surface, borderColor: t.line, textStyle: { color: t.ink },
      formatter: (p: any) => `<strong>${labels.get(p.name) ?? p.name}</strong><br>${p.value ? nf.format(p.value) + T(" bovinos", " cattle") : T("sem dados", "no data")}<br><span style="color:${t.muted}">${T("ref.", "ref.")} ${yearOf.get(p.name) ?? "—"}</span>` },
    visualMap: { min: 0, max, left: 0, bottom: 0, calculable: false, orient: "horizontal", itemWidth: 12, itemHeight: 140,
      text: [nfc.format(max), "0"], textStyle: { color: t.muted }, inRange: { color: [css("--cork-soft"), t.cork, t.accent] } },
    series: [{ type: "map", map: "iberia", roam: false, aspectScale: 0.85, data, nameProperty: "name",
      itemStyle: { borderColor: t.surface, borderWidth: 0.8, areaColor: css("--cork-soft") },
      emphasis: { label: { show: false }, itemStyle: { areaColor: t.pasture } }, select: { disabled: true } }],
    aria: { enabled: true, description: T(`Mapa do efetivo bovino por região NUTS 2 de Portugal e Espanha, último ano disponível até ${year}.`, `Map of the cattle herd by NUTS 2 region of Portugal and Spain, latest year available up to ${year}.`) },
  });
  new ResizeObserver(() => chart.resize()).observe(el);
}

function empty(el: HTMLElement) {
  el.classList.remove("chart");
  el.innerHTML = `<div class="empty">${T("Os dados deste gráfico chegam na próxima atualização automática. Nenhum valor é mostrado antes de ser verificado.", "The data for this chart will arrive with the next automatic update. No value is shown before it is verified.")}</div>`;
}

async function mount(el: HTMLElement) {
  const kind = el.dataset.chart!;
  if (kind === "map") return mapChart(el);
  if (kind === "breeds-map") return;
  const ds = await load(el.dataset.dataset!);
  if (!ds || !ds.rows.length) return empty(el);
  const chart = echarts.init(el, null, { renderer: "canvas" });
  const draw = (mode: string) => chart.setOption(renderers[kind](el, ds, mode), true);
  draw(el.dataset.mode ?? "abs");
  const group = el.parentElement?.querySelector<HTMLElement>(".toggle");
  group?.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(b.dataset.mode!);
    }));
  new ResizeObserver(() => chart.resize()).observe(el);
}

const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target as HTMLElement); } }), { rootMargin: "200px" });
document.querySelectorAll<HTMLElement>("[data-chart]").forEach((el) => io.observe(el));

// ---------- Breed map (solares) ----------
type BreedPt = { slug: string; official_name: string; solar: string; solar_en?: string; lat: number; lon: number; photo?: string; photo_kind?: string;
  herd?: { year: number; males: number; females: number; breeders: number }; catalogue_page?: number };

async function breedsMap(el: HTMLElement) {
  const t = theme();
  const [geo, list] = await Promise.all([
    fetch(`${BASE}geo/nuts3_pt.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${BASE}data/breeds.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  if (!geo || !list.length) return empty(el);
  const part = (test: (n: string) => boolean) => ({ ...geo, features: geo.features.filter((f: any) => test(f.properties.name)) });
  echarts.registerMap("pt-cont", part((n) => n.startsWith("PT1")));
  echarts.registerMap("pt-acores", part((n) => n === "PT200"));
  echarts.registerMap("pt-madeira", part((n) => n === "PT300"));
  const zone = (b: BreedPt) => (b.lon < -20 ? 1 : b.lon < -15 ? 2 : 0);
  const side = document.getElementById("map-side");
  const chips = document.getElementById("map-chips");
  const small = () => el.clientWidth < 560;
  let current = "";
  const show = (b: BreedPt, scroll = false) => {
    current = b.slug;
    paint();
    if (chips) chips.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.slug === b.slug)));
    if (!side) return;
    const solar = EN ? (b.solar_en ?? b.solar) : b.solar;
    const PFX = EN ? `${BASE}en/` : BASE;
    const img = b.photo && b.photo_kind === "raça" ? `<figure class="photo"><img src="${BASE}img/${b.photo}-md.webp" alt="${T("Fotografia da raça", "Photograph of the breed")} ${b.official_name}" style="border-radius:14px;aspect-ratio:4/3;width:100%;object-fit:cover"></figure><span class="chip">${T("Fotografia da raça", "Photograph of the breed")}</span>` : "";
    const herd = b.herd ? `<p style="margin:0"><strong>${b.herd.females.toLocaleString(LOC)}</strong> ${T("fêmeas e", "females and")} <strong>${b.herd.males.toLocaleString(LOC)}</strong> ${T("machos em linha pura, em", "males in pure line, in")} ${b.herd.breeders.toLocaleString(LOC)} ${T("criadores", "breeders")} <span style="color:${t.muted}">(${T("livro genealógico", "herd book")}, ${b.herd.year})</span></p>` : "";
    side.innerHTML = `${img}<h3 style="margin:6px 0 2px">${b.official_name}</h3><p style="margin:0;color:${t.muted}">${T("Solar", "Homeland")}: ${solar}</p>${herd}
      <p style="font-size:.75rem;color:${t.muted};margin:0">${T("Fonte: Catálogo Oficial de Raças Autóctones Portuguesas", "Source: Official Catalogue of Portuguese Native Breeds")}, DGAV/CAP${b.catalogue_page ? `, p. ${b.catalogue_page}` : ""}</p>
      <a class="btn" href="${PFX}racas/${b.slug}/">${T("Ver a raça →", "See the breed →")}</a>`;
    if (scroll && small()) side.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const maxF = Math.max(...list.map((b: BreedPt) => b.herd?.females ?? 0), 1);
  const size = (b: BreedPt) => (small() ? 9 : 11) + (small() ? 14 : 24) * Math.sqrt((b.herd?.females ?? 0) / maxF);
  const chart = echarts.init(el, null, { renderer: "canvas" });
  const land = { areaColor: css("--cork-soft"), borderColor: t.surface, borderWidth: 0.8 };
  const geoBase = { roam: false, silent: true, emphasis: { disabled: true }, itemStyle: land };
  const serie = (gi: number, z: number) => ({
    type: "scatter", coordinateSystem: "geo", geoIndex: gi, z: 5,
    data: list.filter((b: BreedPt) => zone(b) === z).map((b: BreedPt) => ({ name: b.official_name, value: [b.lon, b.lat], b, symbolSize: size(b),
      itemStyle: { color: b.slug === current ? t.ink : t.accent },
      label: { position: b.lon > -6.6 && b.lon < -6 ? "left" : "right" } })),
    itemStyle: { color: t.accent, borderColor: "#fff", borderWidth: 2, shadowBlur: 6, shadowColor: "rgba(0,0,0,.25)" },
    label: { show: !small(), formatter: (p: any) => p.name, position: "right", color: t.ink, fontWeight: 600, fontFamily: "Lexend Variable", fontSize: 12,
      textBorderColor: css("--paper"), textBorderWidth: 3 },
    labelLayout: { hideOverlap: true }, emphasis: { scale: 1.25 },
  });
  const layout = () => small()
    ? { cont: { left: "36%", top: "2%", width: "62%", height: "96%" }, az: { left: "1%", top: "5%", width: "36%", height: "20%" }, ma: { left: "4%", top: "32%", width: "24%", height: "12%" },
        t1: { left: "2%", top: "2%" }, t2: { left: "4%", top: "28%" } }
    : { cont: { left: "42%", top: "1%", width: "56%", height: "98%" }, az: { left: "1%", top: "6%", width: "40%", height: "26%" }, ma: { left: "6%", top: "40%", width: "26%", height: "16%" },
        t1: { left: "2%", top: "2%" }, t2: { left: "6%", top: "36%" } };
  function paint() {
    const L = layout();
    chart.setOption({
      tooltip: { trigger: "item", confine: true, backgroundColor: t.surface, borderColor: t.line, textStyle: { color: t.ink },
        formatter: (p: any) => p.data?.b ? `<strong>${p.data.b.official_name}</strong><br>${EN ? (p.data.b.solar_en ?? p.data.b.solar) : p.data.b.solar}` : "" },
      geo: [
        { ...geoBase, map: "pt-cont", ...L.cont, aspectScale: 0.85 },
        { ...geoBase, map: "pt-acores", ...L.az, aspectScale: 0.8 },
        { ...geoBase, map: "pt-madeira", ...L.ma, aspectScale: 0.8 },
      ],
      series: [serie(0, 0), serie(1, 1), serie(2, 2)],
      graphic: [
        { type: "text", ...L.t1, style: { text: T("Açores", "Azores"), fill: t.muted, font: "600 12px Lexend Variable" } },
        { type: "text", ...L.t2, style: { text: "Madeira", fill: t.muted, font: "600 12px Lexend Variable" } },
      ],
    }, true);
  }
  paint();
  if (chips) {
    chips.innerHTML = list.map((b: BreedPt) => `<button type="button" class="chip-btn" data-slug="${b.slug}" aria-pressed="false">${b.official_name}</button>`).join("");
    chips.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => btn.addEventListener("click", () => {
      const b = list.find((x: BreedPt) => x.slug === btn.dataset.slug); if (b) show(b, true);
    }));
  }
  chart.on("mouseover", (p: any) => p.data?.b && !small() && show(p.data.b));
  chart.on("click", (p: any) => p.data?.b && show(p.data.b, true));
  let w = el.clientWidth;
  new ResizeObserver(() => { chart.resize(); if (Math.abs(el.clientWidth - w) > 40) { w = el.clientWidth; paint(); } }).observe(el);
}
document.querySelectorAll<HTMLElement>('[data-chart="breeds-map"]').forEach((el) => io.unobserve(el));
document.querySelectorAll<HTMLElement>('[data-chart="breeds-map"]').forEach((el) => {
  const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { o.disconnect(); breedsMap(el); } }), { rootMargin: "200px" });
  o.observe(el);
});
