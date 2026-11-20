// Emails: what the test environment "sent" (saved to its outbox, never delivered).
import { setQuery } from '../app.js';
import { ago, api, debounce, html, icon, num, render, when } from '../lib.js';
import { confirmDialog, copyText, dropdown, emptyState, loading, refreshButton, sectionCard, spinWhile, statCard, tabs, toast } from '../ui.js';

export async function page(main, _params, query) {
  render(main, loading());
  let mails = [];
  let selected = query.get('mail');
  const filters = { q: '', template: 'all', to: 'all' };
  let auto = true;
  let timer = null;

  const load = async () => {
    mails = await api.mail();
  };
  try {
    await load();
  } catch (e) {
    render(main, emptyState({ icon: 'alert', title: 'Could not read the emails', text: e.message }));
    return null;
  }

  render(
    main,
    html`<div class="page-head">
        <div><h1>Emails</h1><p>Every email the test environment sent: invites, password resets, sign-in alerts. They are saved to a folder, never delivered.</p></div>
        <div class="actions">
          <label class="switch" style="padding:6px 10px"><input type="checkbox" data-auto checked/><strong>Check for new ones</strong></label>
          ${refreshButton()}
          <button type="button" class="btn btn-outline" data-clear>${icon('trash')}Delete all</button>
        </div>
      </div>
      <div class="stack">
        <div class="grid grid-stats" id="mail-cards"></div>
        <div class="split">
          ${sectionCard({
            tone: 'primary',
            icon: 'mail',
            title: 'Outbox',
            flush: true,
            body: html`<div class="toolbar">
                <label class="field grow">${icon('search')}<span class="sr-only">Search emails</span><input type="search" placeholder="Search subject or recipient" data-search/></label>
                <div data-dd="template"></div>
              </div>
              <div class="pick-list" id="mail-list"></div>`,
          })}
          <div id="mail-view"></div>
        </div>
      </div>`,
  );

  const drawCards = () => {
    const today = mails.filter((m) => Date.now() - new Date(m.sentAt) < 864e5).length;
    const templates = new Set(mails.map((m) => m.template));
    const people = new Set(mails.map((m) => m.to));
    render(
      main.querySelector('#mail-cards'),
      html`${statCard({ tone: 'primary', pattern: 'rings', icon: 'mail', label: 'Emails', value: num(mails.length), hint: mails[0] ? `Last ${ago(mails[0].sentAt)}` : 'None yet' })}
        ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'clock', label: 'Last 24 hours', value: num(today), hint: 'Sent by the test backend' })}
        ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'tag', label: 'Kinds', value: num(templates.size), hint: [...templates].slice(0, 3).join(', ') || '—' })}
        ${statCard({ tone: 'success', pattern: 'waves', icon: 'user', label: 'Recipients', value: num(people.size), hint: 'Different addresses' })}`,
    );
  };

  const templateDd = dropdown(main.querySelector('[data-dd="template"]'), {
    options: [],
    value: 'all',
    label: 'Kind of email',
    width: '170px',
    onChange: (v) => ((filters.template = v), drawList()),
  });
  const templateOptions = () => [
    { value: 'all', label: 'All kinds' },
    ...[...new Set(mails.map((m) => m.template))].sort().map((t) => ({ value: t, label: t, hint: num(mails.filter((m) => m.template === t).length) })),
  ];

  const shown = () => {
    const q = filters.q.trim().toLowerCase();
    return mails.filter((m) => (filters.template === 'all' || m.template === filters.template) && (!q || `${m.subject} ${m.to} ${m.template}`.toLowerCase().includes(q)));
  };

  const drawList = () => {
    const list = shown();
    render(
      main.querySelector('#mail-list'),
      list.length
        ? html`<ul class="list">${list.map(
            (m) => html`<li><button type="button" class="list-row" data-file="${m.file}" aria-current="${m.file === selected}">
              <span class="grow mail-row"><strong>${m.subject}</strong><span class="muted small">To ${m.to}</span><span class="small"><span class="badge badge-sm tone-violet">${m.template}</span> <span class="muted">${ago(m.sentAt)}</span></span></span>${icon('chevronRight')}
            </button></li>`,
          )}</ul>`
        : emptyState({ icon: 'mail', title: mails.length ? 'No emails match' : 'No emails yet', text: mails.length ? 'Change the search.' : 'Invites, password resets and sign-in alerts from the test environment show up here.' }),
    );
    main.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', () => open(b.dataset.file)));
  };

  let mailTab = 'preview';
  const open = async (file) => {
    selected = file;
    setQuery({ mail: file });
    main.querySelectorAll('[data-file]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.file === file)));
    const view = main.querySelector('#mail-view');
    render(view, html`<div class="section t-neutral"><div class="body">${loading()}</div></div>`);
    let m;
    try {
      m = await api.mailOne(file);
    } catch (e) {
      return render(view, html`<div class="section t-neutral"><div class="body">${emptyState({ icon: 'alert', title: 'Could not open the email', text: e.message })}</div></div>`);
    }
    render(
      view,
      sectionCard({
        tone: 'info',
        icon: 'mail',
        title: m.subject,
        description: html`To <strong>${m.to}</strong> · from ${m.from} · ${when(m.sentAt)}`,
        aside: html`<a class="icon-btn tone-primary" href="/api/mail/${encodeURIComponent(m.file)}/raw" data-tip="Download .eml" aria-label="Download the email file">${icon('download')}</a>`,
        body: html`${m.links.length
            ? html`<div class="callout t-primary" style="margin-bottom:12px">${icon('link')}<div style="min-width:0;flex:1"><strong>Links in this email</strong>
                <ul class="list" style="margin-top:6px">${m.links.map(
                  (l) => html`<li class="list-row" style="padding:6px 0"><a class="grow mono small truncate" href="${l}" target="_blank" rel="noopener noreferrer">${l}</a>
                    <button type="button" class="icon-btn tone-primary" data-copy="${l}" data-tip="Copy link" aria-label="Copy link">${icon('copy')}</button>
                    <a class="icon-btn tone-success" href="${l}" target="_blank" rel="noopener noreferrer" data-tip="Open" aria-label="Open link">${icon('external')}</a></li>`,
                )}</ul></div></div>`
            : ''}
          <div id="mail-tabs"></div><div id="mail-body" style="margin-top:12px"></div>`,
      }),
    );
    view.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy, 'Link copied')));
    const mb = view.querySelector('#mail-body');
    const show = (id) => {
      mailTab = id;
      if (id === 'preview') {
        render(mb, m.html ? html`<iframe class="mail-frame" title="Email preview" sandbox="" referrerpolicy="no-referrer"></iframe>` : html`<pre class="code wrap">${m.text}</pre>`);
        // No scripts, no same-origin access: the email can only be looked at.
        const frame = mb.querySelector('iframe');
        if (frame) frame.srcdoc = m.html;
      } else if (id === 'text') render(mb, html`<pre class="code wrap">${m.text || '(no text part)'}</pre>`);
      else render(mb, html`<pre class="code" style="max-height:560px">${m.raw}</pre>`);
    };
    tabs(
      view.querySelector('#mail-tabs'),
      [
        { id: 'preview', label: 'Preview', icon: 'eye' },
        { id: 'text', label: 'Text', icon: 'file' },
        { id: 'raw', label: 'Source', icon: 'code' },
      ],
      m.html || mailTab !== 'preview' ? mailTab : 'text',
      show,
    );
    show(m.html || mailTab !== 'preview' ? mailTab : 'text');
  };

  const drawEmptyView = () =>
    render(main.querySelector('#mail-view'), html`<div class="section t-neutral"><div class="body">${emptyState({ icon: 'mail', title: 'Pick an email', text: 'Its preview, text, links and source show here.' })}</div></div>`);

  const refresh = async () => {
    const before = mails[0]?.file;
    await load();
    templateDd.setOptions(templateOptions());
    drawCards();
    drawList();
    if (mails[0] && mails[0].file !== before && before !== undefined) toast(`New email: ${mails[0].subject}`, 'success');
    if (selected && !mails.some((m) => m.file === selected)) {
      selected = null;
      setQuery({});
      drawEmptyView();
    }
  };

  templateDd.setOptions(templateOptions());
  drawCards();
  drawList();
  if (selected && mails.some((m) => m.file === selected)) open(selected);
  else drawEmptyView();

  main.querySelector('[data-search]').addEventListener('input', debounce((e) => ((filters.q = e.target.value), drawList())));
  const refreshBtn = main.querySelector('[data-action="refresh"]');
  refreshBtn.addEventListener('click', () => spinWhile(refreshBtn, () => refresh().catch((e) => toast(e.message, 'danger'))));
  main.querySelector('[data-auto]').addEventListener('change', (e) => (auto = e.target.checked));
  main.querySelector('[data-clear]').addEventListener('click', async () => {
    if (!mails.length) return toast('Nothing to delete', 'warning');
    if (!(await confirmDialog({ title: `Delete all ${num(mails.length)} emails?`, text: 'They are removed from the test outbox folder. Tests waiting for an email will only see new ones.', confirmLabel: 'Delete all' }))) return;
    try {
      const r = await api.clearMail();
      toast(`${num(r.removed)} emails deleted`);
      selected = null;
      setQuery({});
      await refresh();
      drawEmptyView();
    } catch (e) {
      toast(e.message, 'danger');
    }
  });
  timer = setInterval(() => auto && !document.hidden && refresh().catch(() => undefined), 5000);
  return {
    onQuery: (q) => q.get('mail') && q.get('mail') !== selected && open(q.get('mail')),
    dispose: () => clearInterval(timer),
  };
}

