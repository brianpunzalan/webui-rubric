import type { ArtifactManifest } from './manifest.js';

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a self-contained HTML report (no external assets/CDNs) that binds the
 * composite visuals to the bundled evaluation data. Image `src` values are
 * relative to the artifact dir so the page renders in place.
 */
export function buildReportHtml(manifest: ArtifactManifest): string {
  const v = manifest.verdict;
  const it = manifest.iteration;

  const dimensionRows = v.dimensions
    .map(
      (d) =>
        `<tr><td>${esc(d.name)}</td><td class="num">${esc(d.weight)}</td><td class="num">${esc(
          d.score,
        )}</td></tr>`,
    )
    .join('');

  const blockingRows =
    manifest.blocking.length === 0
      ? `<tr><td colspan="3" class="muted">None</td></tr>`
      : manifest.blocking
          .map(
            (b) =>
              `<tr><td>${esc(b.criterion_id)}</td><td>${esc(b.wcag_ref)}</td><td>${esc(
                b.evidence,
              )}</td></tr>`,
          )
          .join('');

  const issueRows =
    manifest.top_issues.length === 0
      ? `<tr><td colspan="4" class="muted">None</td></tr>`
      : manifest.top_issues
          .map(
            (t) =>
              `<tr><td class="num">${esc(t.rank)}</td><td>${esc(t.criterion_id)}</td><td class="num">${esc(
                t.severity,
              )}</td><td>${t.fix.map((f) => esc(f)).join('<br>')}</td></tr>`,
          )
          .join('');

  const viewportSections = manifest.viewports
    .map((vp) => {
      const regionImgs = vp.images.regions
        .map(
          (r) =>
            `<figure><img src="${esc(r)}" alt="diff region"><figcaption>${esc(r)}</figcaption></figure>`,
        )
        .join('');
      const regionDetail = vp.diff_regions
        .map((region) => {
          const els = region.elements
            .map((el) => {
              const styles = el.styleDiffs
                .map(
                  (s) =>
                    `<li><code>${esc(s.property)}</code>: ${esc(s.actual)} → <strong>${esc(
                      s.expected,
                    )}</strong></li>`,
                )
                .join('');
              return `<li><code>${esc(el.selector)}</code> (&lt;${esc(el.tagName)}&gt;)<ul>${styles}</ul></li>`;
            })
            .join('');
          return `<li>rows ${esc(region.y_start)}–${esc(region.y_end)} (${(
            region.pct_of_total_diff * 100
          ).toFixed(1)}% of diff)<ul>${els}</ul></li>`;
        })
        .join('');

      const metrics = vp.compared
        ? `<p class="metrics">diff ${(vp.diff_ratio * 100).toFixed(2)}% ·
    ${esc(vp.diff_pixel_count)}/${esc(vp.total_pixel_count)} px ·
    threshold ${esc(vp.threshold)} ·
    parity score ${vp.score === null ? 'n/a' : esc(vp.score) + '/4'}</p>`
        : `<p class="metrics muted">Pixel comparison unavailable${
            vp.note ? ` — ${esc(vp.note)}` : ''
          }</p>`;

      // With a matching diff we show the side-by-side composite; otherwise we
      // fall back to the reference and screenshot stacked so they can still be
      // compared by eye.
      const visuals = vp.images.composite
        ? `<figure class="composite">
    <img src="${esc(vp.images.composite)}" alt="reference | screenshot | diff">
    <figcaption>reference&nbsp;|&nbsp;screenshot&nbsp;|&nbsp;diff</figcaption>
  </figure>`
        : `<div class="regions">
    <figure><img src="${esc(vp.images.reference)}" alt="reference"><figcaption>reference</figcaption></figure>
    <figure><img src="${esc(vp.images.screenshot)}" alt="screenshot"><figcaption>screenshot</figcaption></figure>
  </div>`;

      return `
<section class="viewport">
  <h3>Viewport: ${esc(vp.viewport)}</h3>
  ${metrics}
  ${visuals}
  ${regionImgs ? `<div class="regions">${regionImgs}</div>` : ''}
  ${regionDetail ? `<details><summary>DOM-mapped diff regions</summary><ul>${regionDetail}</ul></details>` : ''}
</section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evaluation artifact — ${esc(manifest.url)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; max-width: 1100px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 20px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
  .card .big { font-size: 24px; font-weight: 600; }
  .card .lbl { color: #64748b; font-size: 12px; text-transform: uppercase; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 24px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #94a3b8; }
  figure { margin: 8px 0; }
  figure img { max-width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; }
  figcaption { color: #64748b; font-size: 12px; }
  .regions { display: flex; gap: 12px; flex-wrap: wrap; }
  .regions figure img { max-width: 320px; }
  .metrics { color: #475569; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
  details { margin-top: 8px; }
  summary { cursor: pointer; color: #334155; }
</style>
</head>
<body>
<h1>Evaluation artifact</h1>
<p class="sub">${esc(manifest.url)} · ${esc(manifest.timestamp)} · run ${esc(manifest.run_id)}</p>

<div class="cards">
  <div class="card"><div class="big">${esc(v.composite_score)}</div><div class="lbl">Composite</div></div>
  <div class="card"><div class="big">${v.ship_ready ? '✓' : '✗'}</div><div class="lbl">Ship ready</div></div>
  <div class="card"><div class="big">${esc(v.blocking_count)}</div><div class="lbl">Blocking</div></div>
  <div class="card"><div class="big">${esc(manifest.top_issues.length)}</div><div class="lbl">Top issues</div></div>
  <div class="card"><div class="big">${it.delta === null ? '—' : esc(it.delta)}</div><div class="lbl">Δ vs prev (iter ${it.iteration === null ? '—' : esc(it.iteration)})</div></div>
</div>

${viewportSections || '<p class="muted">No reference image supplied — no visual comparison.</p>'}

<h2>Dimension scores</h2>
<table><thead><tr><th>Dimension</th><th class="num">Weight</th><th class="num">Score</th></tr></thead>
<tbody>${dimensionRows}</tbody></table>

<h2>Top issues</h2>
<table><thead><tr><th class="num">#</th><th>Criterion</th><th class="num">Severity</th><th>Suggested fix</th></tr></thead>
<tbody>${issueRows}</tbody></table>

<h2>Blocking (WCAG AA)</h2>
<table><thead><tr><th>Criterion</th><th>WCAG</th><th>Evidence</th></tr></thead>
<tbody>${blockingRows}</tbody></table>
</body>
</html>`;
}
