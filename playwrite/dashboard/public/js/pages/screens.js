// Screens: every page's screenshot from a run (desktop and phone), and visual changes
// against approved screenshots (before / after / difference).
import { setQuery } from '../app.js';
import { api, html, icon, num, render, when } from '../lib.js';
import { badge, confirmDialog, dropdown, emptyState, loading, openDialog, sectionCard, statCard, stateBadge, tabs, toast } from '../ui.js';
import { runTitle } from './common.js';

/** Share of pixels that differ more than `tolerance` (0–255 per channel), and a diff image. */
async function compareImages(beforeUrl, afterUrl, tolerance = 24) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load a screenshot'));
      img.src = src;
    });
  const [a, b] = await Promise.all([load(beforeUrl), load(afterUrl)]);
  const w = Math.max(a.naturalWidth, b.naturalWidth);
  const h = Math.max(a.naturalHeight, b.naturalHeight);
  const pixels = (img) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const pa = pixels(a);
  const pb = pixels(b);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const diff = octx.createImageData(w, h);
  let changed = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
    if (d > tolerance) {
      changed++;
      diff.data.set([230, 40, 60, 255], i);
    } else {
      // Faded "after" image so the red changes stand out.
      const g = (pb[i] + pb[i + 1] + pb[i + 2]) / 3;
      const v = 235 + g * 0.08;
      diff.data.set([v, v, v, 255], i);
    }
  }
  octx.putImageData(diff, 0, 0);
  return { canvas: out, share: changed / (w * h), sizeChanged: a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight, w, h };
}

export async function page(main, _params, query) {
  render(main, loading());
  const runs = (await api.runs().catch(() => [])).filter((r) => r.status !== 'interrupted');
  let runId = query.get('run') ?? runs[0]?.id;
  let tab = query.get('tab') ?? 'gallery';
  let data = null;
  const results = new Map(); // key → { share, sizeChanged }

  render(
    main,
    html`<div class="page-head">
        <div><h1>Screens</h1><p>A screenshot of every page from a run, on desktop and phone, and what changed since the screenshots you approved.</p></div>
        <div class="actions"><div data-dd="run"></div></div>
      </div>
      <div class="stack"><div class="grid grid-stats" id="cards"></div><div><div id="tabs"></div><div id="body"></div></div></div>`,
  );
  if (!runs.length) {
    render(main.querySelector('#body'), emptyState({ icon: 'image', title: 'No runs yet', text: 'The smoke tests take a screenshot of every page.' }));
    return null;
  }
  dropdown(main.querySelector('[data-dd="run"]'), {
    options: runs.map((r) => ({ value: r.id, label: runTitle(r) })),
    value: runId,
    label: 'Run',
    width: '260px',
    onChange: (v) => {
      runId = v;
      results.clear();
      setQuery({ run: v, tab: tab === 'gallery' ? '' : tab });
      load();
    },
  });

  const load = async () => {
    render(main.querySelector('#body'), loading());
    data = await api.visual(runId).catch(() => ({ items: [], run: null, baselines: 0 }));
    drawCards();
    drawTabs();
  };

  const drawCards = () => {
    const withBase = data.items.filter((i) => i.baseline);
    const changed = [...results.values()].filter((r) => r.share > 0.002 || r.sizeChanged).length;
    render(
      main.querySelector('#cards'),
      html`${statCard({ tone: 'primary', pattern: 'rings', icon: 'image', label: 'Screenshots', value: num(data.items.length), hint: `${num(data.items.filter((i) => i.project === 'mobile').length)} on a phone` })}
        ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Approved', value: num(withBase.length), hint: `${num(data.items.length - withBase.length)} without an approved one` })}
        ${statCard({ tone: changed ? 'danger' : 'neutral', pattern: 'stripes', icon: 'compare', label: 'Changed', value: results.size ? num(changed) : '…', hint: results.size ? 'More than 0.2% of pixels' : 'Open "Visual changes"' })}`,
    );
  };

  const drawTabs = () => {
    const body = main.querySelector('#body');
    const views = { gallery: gallery, changes: changes };
    if (!views[tab]) tab = 'gallery';
    tabs(
      main.querySelector('#tabs'),
      [
        { id: 'gallery', label: 'Gallery', icon: 'image', count: data.items.length },
        { id: 'changes', label: 'Visual changes', icon: 'compare' },
      ],
      tab,
      (id) => {
        tab = id;
        setQuery({ run: runId, tab: id === 'gallery' ? '' : id });
        views[id](body);
      },
    );
    views[tab](body);
  };

  const label = (i) => i.page ?? i.title;
  const showImage = (src, title) =>
    openDialog({ title, width: 1200, body: html`<div class="lightbox"><img src="${src}" alt="${title}"/></div>`, footer: html`<a class="btn btn-outline" href="${src}${src.includes('?') ? '&' : '?'}download">${icon('download')}Download</a>` });

  // ------------------------------------------------------------------ gallery
  const gallery = (body) => {
    if (!data.items.length) {
      return render(body, html`<div class="section t-neutral"><div class="body">${emptyState({ icon: 'image', title: 'No page screenshots in this run', text: 'The smoke tests take them from now on (turn off with PW_PAGE_CHECKS=0). Run them once.' })}</div></div>`);
    }
    const projects = [...new Set(data.items.map((i) => i.project))];
    render(
      body,
      html`<div class="stack">${projects.map((p) =>
        sectionCard({
          tone: p === 'mobile' ? 'violet' : 'primary',
          icon: p === 'mobile' ? 'phone' : 'monitor',
          title: p === 'mobile' ? 'Phone' : p === 'public' ? 'Without sign-in' : 'Desktop',
          description: `${num(data.items.filter((i) => i.project === p).length)} pages · ${data.run ? when(data.run.startedAt) : ''}`,
          body: html`<div class="gallery ${p === 'mobile' ? 'phone' : ''}">${data.items
            .filter((i) => i.project === p)
            .map(
              (i) => html`<button type="button" class="shot" data-shot="${i.key}">
                <img src="${i.current}" alt="${label(i)}" loading="lazy"/>
                <span class="cap"><strong class="mono">${label(i)}</strong><span>${stateBadge(i.state, 1, true)} ${i.baseline ? badge('Approved', 'success', 'check', true) : ''}</span></span>
              </button>`,
            )}</div>`,
        }),
      )}</div>`,
    );
    body.querySelectorAll('[data-shot]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = data.items.find((x) => x.key === b.dataset.shot);
        showImage(i.current, `${label(i)} · ${i.project}`);
      }),
    );
  };

  // ------------------------------------------------------------ visual changes
  const changes = async (body) => {
    if (!data.items.length) return gallery(body);
    render(
      body,
      sectionCard({
        tone: 'warning',
        icon: 'compare',
        title: 'Changes since the approved screenshots',
        description: 'Red pixels differ. Approve a screenshot to make it the new "before". Dates and counts that change every run show as small differences.',
        aside: html`<button type="button" class="btn btn-primary btn-sm" data-approve-all>${icon('check')}Approve all ${num(data.items.length)}</button>`,
        flush: true,
        body: html`<div id="change-list">${loading('Comparing screenshots…')}</div>`,
      }),
    );
    body.querySelector('[data-approve-all]').addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Approve every screenshot of this run?', text: 'They become the "before" for future comparisons.', confirmLabel: 'Approve all', tone: 'primary' }))) return;
      await approve(data.items.map((i) => i.key));
    });
    for (const i of data.items) {
      if (!i.baseline || results.has(i.key)) continue;
      try {
        const r = await compareImages(i.baseline, i.current);
        results.set(i.key, { share: r.share, sizeChanged: r.sizeChanged });
      } catch {
        results.set(i.key, { share: null });
      }
    }
    drawCards();
    const order = (i) => (!i.baseline ? -1 : (results.get(i.key)?.share ?? 0) + (results.get(i.key)?.sizeChanged ? 1 : 0));
    const items = [...data.items].sort((a, b) => order(b) - order(a));
    render(
      body.querySelector('#change-list'),
      html`<ul class="list">${items.map((i) => {
        const r = results.get(i.key);
        const state = !i.baseline
          ? badge('Not approved yet', 'neutral', null, true)
          : r?.share === null
            ? badge('Could not compare', 'warning', 'alert', true)
            : r.sizeChanged
              ? badge('Size changed', 'danger', 'alert', true)
              : r.share > 0.002
                ? badge(`${(r.share * 100).toFixed(2)}% changed`, 'danger', 'compare', true)
                : badge('Same', 'success', 'check', true);
        return html`<li><button type="button" class="list-row" data-diff="${i.key}">
          <img src="${i.current}" alt="" style="width:72px;height:46px;object-fit:cover;object-position:top;border-radius:4px;border:1px solid var(--border)" loading="lazy"/>
          <span class="grow"><strong class="mono truncate" style="display:block">${label(i)}</strong><span class="muted small">${i.project}${i.approvedAt ? ` · approved ${when(i.approvedAt)}` : ''}</span></span>
          ${state}${icon('chevronRight')}
        </button></li>`;
      })}</ul>`,
    );
    body.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => openDiff(data.items.find((x) => x.key === b.dataset.diff))));
  };

  const approve = async (keys) => {
    try {
      await api.approve(data.run.id, keys);
      toast(keys.length === 1 ? 'Screenshot approved' : `${num(keys.length)} screenshots approved`);
      keys.forEach((k) => results.delete(k));
      await load();
    } catch (e) {
      toast(e.message, 'danger');
    }
  };

  const openDiff = async (i) => {
    const { el, close } = openDialog({
      title: `${label(i)} · ${i.project}`,
      description: i.baseline ? `Approved ${when(i.approvedAt)} → this run` : 'No approved screenshot yet',
      width: 1200,
      body: i.baseline ? loading('Comparing…') : html`<div class="lightbox"><img src="${i.current}" alt="${label(i)}"/></div>`,
      footer: html`${i.baseline ? html`<button type="button" class="btn btn-outline" data-unapprove>${icon('trash')}Forget the approved one</button>` : ''}
        <button type="button" class="btn btn-primary" data-approve>${icon('check')}${i.baseline ? 'Approve this one instead' : 'Approve this screenshot'}</button>`,
    });
    el.querySelector('[data-approve]').addEventListener('click', async () => {
      close();
      await approve([i.key]);
    });
    el.querySelector('[data-unapprove]')?.addEventListener('click', async () => {
      await api.removeBaseline(i.key).catch((e) => toast(e.message, 'danger'));
      close();
      results.delete(i.key);
      toast('Approved screenshot removed');
      load();
    });
    if (!i.baseline) return;
    const dbody = el.querySelector('.dbody');
    try {
      const r = await compareImages(i.baseline, i.current);
      render(
        dbody,
        html`<div class="actions" style="margin-bottom:12px">${r.sizeChanged ? badge('The size changed', 'danger', 'alert') : ''}${badge(`${(r.share * 100).toFixed(2)}% of pixels changed`, r.share > 0.002 ? 'danger' : 'success')}</div>
          <div id="diff-tabs"></div><div id="diff-body" style="margin-top:12px"></div>`,
      );
      const db = dbody.querySelector('#diff-body');
      const show = (id) => {
        if (id === 'side') {
          render(db, html`<div class="diff-views"><figure><figcaption>Before (approved)</figcaption><img src="${i.baseline}" alt="Before"/></figure><figure><figcaption>After (this run)</figcaption><img src="${i.current}" alt="After"/></figure><figure><figcaption>Difference (red)</figcaption><div data-canvas></div></figure></div>`);
          db.querySelector('[data-canvas]').append(r.canvas);
        } else {
          render(db, html`<div class="slider-view" data-slider><img src="${i.current}" alt="After"/><div class="top" style="width:50%"><img src="${i.baseline}" alt="Before"/></div></div>
            <label class="small muted" style="display:block;margin-top:8px">Drag: left shows before, right shows after <input type="range" min="0" max="100" value="50" data-range/></label>`);
          const view = db.querySelector('[data-slider]');
          const top = view.querySelector('.top');
          const fit = () => (top.querySelector('img').style.width = `${view.clientWidth}px`);
          fit();
          db.querySelector('[data-range]').addEventListener('input', (e) => (top.style.width = `${e.target.value}%`));
          new ResizeObserver(fit).observe(view);
        }
      };
      tabs(dbody.querySelector('#diff-tabs'), [{ id: 'side', label: 'Side by side', icon: 'compare' }, { id: 'slide', label: 'Slider', icon: 'layers' }], 'side', show);
      show('side');
    } catch (e) {
      render(dbody, emptyState({ icon: 'alert', title: 'Could not compare', text: e.message }));
    }
  };

  await load();
  return null;
}
