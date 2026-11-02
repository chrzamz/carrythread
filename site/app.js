import { messages } from './messages.js';
import { release } from './release.js';

const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7V5h7l2 3h9v11H3V7Z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01m4-11h6m-6 11h6" stroke-linecap="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.38.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
};
const e = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const lines = (value) => e(value).replace(/\n/g, '<br>');
const languageNames = {'en':'English', 'zh-CN':'简体中文', 'es':'Español', 'ja':'日本語'};
const targets = ['Codex', 'Claude Code', 'OpenCode', 'Pi', 'Finch'];
let selectedProject = 0;
let selectedTab = 0;
let selectedTarget = 'Codex';
let currentLocale = initialLocale();

function initialLocale() {
  let stored;
  try { stored = localStorage.getItem('carrythread-site-language'); } catch { /* Browser storage can be disabled. */ }
  const requested = new URLSearchParams(location.search).get('lang') || stored || navigator.language;
  if (messages[requested]) return requested;
  if (requested?.startsWith('zh')) return 'zh-CN';
  if (requested?.startsWith('es')) return 'es';
  if (requested?.startsWith('ja')) return 'ja';
  return 'en';
}
function releaseLabel(t) { return release.stage === 'released' ? t.hero.released.replace('{version}', release.version) : t.hero.preview; }
function releaseHref() { return release.stage === 'released' ? release.latest : release.releases; }
function releaseCta(t) { return release.stage === 'released' ? t.hero.downloadCta : t.hero.previewCta; }
function brand() { return '<a class="brand" href="#" aria-label="Carrythread"><img src="./assets/mark.svg" width="35" height="35" alt=""><span>Carrythread</span></a>'; }
function sectionHeading(kicker,title,intro) { return `<div class="section-heading"><div><p class="section-kicker">${e(kicker)}</p><h2>${lines(title)}</h2></div><p>${e(intro)}</p></div>`; }
function primaryCta(t) { return `<a class="button release-link" href="${releaseHref()}">${e(releaseCta(t))}${icons.external}</a>`; }
function render() {
  const t = messages[currentLocale];
  document.documentElement.lang = currentLocale;
  document.title = t.meta.title;
  document.querySelector('meta[name="description"]').content = t.meta.description;
  document.querySelector('meta[property="og:title"]').content = t.meta.title;
  document.querySelector('meta[property="og:description"]').content = t.meta.description;
  document.querySelector('.skip-link').textContent = t.nav.skip;
  document.querySelector('#app').innerHTML = `
    <div class="wrap">
      <header class="topbar">${brand()}<nav class="navigation" aria-label="${e(t.nav.workflow)}"><a href="#workflow">${e(t.nav.workflow)}</a><a href="#sources">${e(t.nav.sources)}</a><a href="#privacy">${e(t.nav.privacy)}</a><a href="#open-source">${e(t.nav.open)}</a></nav><div class="header-end"><label class="language-label">${icons.globe}<span class="sr-only">${e(t.nav.language)}</span><select id="language" class="language">${Object.entries(languageNames).map(([key,name])=>`<option value="${key}" ${key===currentLocale?'selected':''}>${name}</option>`).join('')}</select></label><a class="github-link" href="${release.repository}">${icons.github}${e(t.nav.github)}</a></div></header>
      <main id="main">
        <section class="hero" aria-labelledby="hero-title"><div class="hero-topline"><span class="eyebrow">${e(t.hero.eyebrow)}</span><span class="release-note">${e(releaseLabel(t))}</span></div><div class="hero-heading"><h1 id="hero-title">${e(t.hero.title)}<span class="accent">${e(t.hero.accent)}</span></h1><div class="hero-copy"><p>${e(t.hero.body)}</p><div class="actions">${primaryCta(t)}<a class="button secondary" href="#walkthrough">${e(t.hero.demoCta)}${icons.arrow}</a></div><div class="platform-note">${e(release.stage==='released'?t.hero.releaseNote:t.hero.previewNote)}</div></div></div>
          <div class="demo-frame" id="walkthrough" aria-label="${e(t.demo.title)}"><div class="window-bar"><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="window-title">Carrythread</span><span class="demo-label">${e(t.demo.synthetic)}</span></div><div class="demo-body"><aside class="demo-sidebar"><div class="workspace-title">${e(t.demo.workspace)}</div><div class="small-label">${e(t.demo.projectsLabel)}</div><div class="project-buttons">${t.demo.projects.map((project,index)=>`<button class="project-button ${index===selectedProject?'active':''}" data-project="${index}" aria-pressed="${index===selectedProject}"><span aria-hidden="true"></span><span>${e(project.name)}</span></button>`).join('')}</div><div class="sidebar-line"></div><div class="sidebar-foot">${lines(t.demo.sidebar)}</div></aside><div class="demo-content"><div class="demo-heading"><div><div class="demo-scope">${e(t.demo.scope)}</div><h3>${e(t.demo.heading)}</h3></div><span class="outline-icon" aria-hidden="true">${icons.folder}</span></div><div class="demo-tabs" role="tablist" aria-label="${e(t.demo.title)}">${t.demo.tabs.map((label,index)=>`<button role="tab" class="demo-tab ${index===selectedTab?'active':''}" id="demo-tab-${index}" data-tab="${index}" aria-selected="${index===selectedTab}" aria-controls="demo-panel" tabindex="${index===selectedTab?'0':'-1'}">${e(label)}</button>`).join('')}</div><div class="demo-panel" id="demo-panel" role="tabpanel" aria-labelledby="demo-tab-${selectedTab}" tabindex="0"></div></div></div></div><div class="demo-explainer"><span>${e(t.demo.hint)}</span><span>${e(t.demo.note)}</span></div>
        </section>
        <div class="concept-line" aria-hidden="true"><span>${e(t.bridge[0])}</span>${icons.arrow}<span>${e(t.bridge[1])}</span>${icons.arrow}<span class="strong">${e(t.bridge[2])}</span></div>
        <section class="section" id="workflow">${sectionHeading(t.workflow.kicker,t.workflow.title,t.workflow.intro)}<div class="workflow-grid">${t.workflow.steps.map((step,index)=>`<article class="workflow-step"><div class="step-no"><span>0${index+1}</span>${[icons.folder,icons.page,icons.arrow][index]}</div><h3>${e(step.title)}</h3><p>${e(step.body)}</p><div class="feature-details">${step.tags.map(tag=>`<span>${e(tag)}</span>`).join('')}</div></article>`).join('')}</div><div class="statement"><p>${e(t.workflow.statement)}</p><p>${e(t.workflow.statementBody)}</p></div></section>
        <section class="section" id="sources">${sectionHeading(t.sources.kicker,t.sources.title,t.sources.intro)}<table class="support-table"><caption class="sr-only">${e(t.sources.title.replace('\n',' '))}</caption><thead><tr>${t.sources.columns.map(column=>`<th scope="col">${e(column)}</th>`).join('')}</tr></thead><tbody>${t.sources.rows.map(row=>`<tr><td><span class="source-name">${e(row[0])}</span></td><td><span class="source-format">${e(row[1])}</span></td><td class="source-limit">${e(row[2])}</td></tr>`).join('')}</tbody></table><p class="table-note">${e(t.sources.note)}</p></section>
        <section class="section" id="privacy">${sectionHeading(t.privacy.kicker,t.privacy.title,t.privacy.intro)}<div class="privacy-grid"><ul class="privacy-list">${t.privacy.points.map((point,index)=>`<li>${[icons.lock,icons.eye,icons.server][index]}<div><strong>${e(point.title)}</strong><p>${e(point.body)}</p></div></li>`).join('')}</ul><aside class="provider-box"><div class="small-label">${e(t.privacy.providerTitle)}</div>${t.privacy.providers.map(provider=>`<div class="provider-row"><strong>${e(provider[0])}</strong><span>${e(provider[1])}</span></div>`).join('')}<p>${e(t.privacy.providerNote)}</p><p>${e(t.privacy.keyNote)}</p></aside></div></section>
        <section class="section" id="open-source">${sectionHeading(t.open.kicker,t.open.title,t.open.intro)}<div class="open-grid"><article class="open-card"><div class="small-label">${e(t.open.coreLabel)}</div><h3>${e(t.open.coreTitle)}</h3><p>${e(t.open.coreBody)}</p><ul>${t.open.coreFeatures.map(feature=>`<li>${icons.check}<span>${e(feature)}</span></li>`).join('')}</ul><a class="button secondary" href="${release.repository}">${e(t.open.coreCta)}${icons.external}</a></article><article class="future-card"><div class="eyebrow">${e(t.open.futureLabel)}</div><h3>${e(t.open.futureTitle)}</h3><p>${e(t.open.futureBody)}</p><div class="future-items">${t.open.futureItems.map(item=>`<div>${e(item)}<span>${e(t.open.futureState)}</span></div>`).join('')}</div><p class="future-note">${e(t.open.futureNote)}</p></article></div><div class="installation"><h3>${e(t.installation.title)}</h3><ol>${t.installation.steps.map(step=>`<li>${e(step)}</li>`).join('')}</ol><p>${e(t.installation.note)}</p></div></section>
        <section class="section faq"><div><p class="section-kicker">${e(t.faq.kicker)}</p><h2>${e(t.faq.title)}</h2></div><div>${t.faq.items.map(item=>`<details><summary>${e(item.q)}</summary><p>${e(item.a)}</p></details>`).join('')}</div></section>
        <section class="final-cta"><div><h2>${e(t.cta.title)}</h2><p>${e(t.cta.body)}</p></div><div class="actions">${primaryCta(t)}<a class="button secondary" href="${release.repository}">${icons.github}${e(t.cta.github)}</a></div></section>
      </main>
      <footer class="footer"><div><div class="footer-brand"><img src="./assets/mark.svg" width="21" height="21" alt="">Carrythread · 续迹</div><div class="footer-caption">${e(t.footer.caption)}<br>${e(t.footer.languageNote)}</div></div><nav class="footer-links"><a href="${release.repository}#readme">${e(t.footer.docs)}</a><a href="${release.repository}/issues">${e(t.footer.issues)}</a><a href="${release.repository}/tree/main/resources/brand">${e(t.footer.brand)}</a><a href="#privacy">${e(t.footer.privacy)}</a></nav></footer>
    </div>`;
  renderDemo();
  bindEvents();
}
function contextText() {
  const t=messages[currentLocale], p=t.demo.projects[selectedProject], label=t.demo.packageLabels;
  return `${t.demo.synthetic}\nCarrythread → ${selectedTarget}\n\n${label[0]}\n${p.item}\n\n${label[1]}\n${p.summary}\n\n${label[2]}\n${p.next}\n\n${label[3]}\n${p.evidence.map((evidence,index)=>`[example-${selectedProject+1}-${index+1}] ${evidence.date} · ${t.demo[evidence.role]}\n${evidence.text}`).join('\n\n')}`;
}
function renderDemo() {
  const t=messages[currentLocale], p=t.demo.projects[selectedProject];
  const title=`<div class="work-item-title"><h4>${e(p.item)}</h4><span class="status-chip">${e(p.status)}</span></div>`;
  let content='';
  if(selectedTab===0) content=`${title}<div class="state-track">${p.states.map((state,index)=>`<div class="state-step ${index===0?'complete':index===1?'current':''}">${index===0?icons.check:icons.circle}<span>${e(state)}</span></div>`).join('')}</div><p class="demo-summary">${e(p.summary)}</p><div class="next-action"><span class="next-icon">${icons.arrow}</span><div><small>${e(t.demo.next)}</small><p>${e(p.next)}</p></div></div><div class="demo-bottom"><div class="source-pills"><span>Claude Code</span><span>Codex</span><span>Markdown</span></div><span>${e(t.demo.updated)}</span></div>`;
  else if(selectedTab===1) content=`${title}<p class="demo-summary">${e(t.demo.evidenceLabel)}</p>${p.evidence.map((evidence,index)=>`<article class="evidence-row"><div class="evidence-head"><span class="source-kind">${e(t.demo[evidence.role])} · ${index===0?'Claude Code':'Codex'}</span><span>${e(evidence.date)}</span></div><p class="evidence-quote">${e(evidence.text)}</p></article>`).join('')}<p class="proof-note">${e(t.demo.reference)}: example-${selectedProject+1}-1 · example-${selectedProject+1}-2</p>`;
  else content=`${title}<div class="handoff-grid"><textarea id="handoff-preview" class="handoff-text" readonly aria-label="${e(t.demo.tabs[2])}">${e(contextText())}</textarea><div class="handoff-options"><label for="handoff-target">${e(t.demo.target)}</label><select class="handoff-select" id="handoff-target">${targets.map(target=>`<option ${target===selectedTarget?'selected':''}>${e(target)}</option>`).join('')}</select><button class="handoff-copy" id="copy-context">${e(t.demo.copy)}</button><p>${e(t.demo.handoffNote)}</p></div></div><p class="handoff-feedback" id="copy-status" role="status" aria-live="polite"></p>`;
  const panel=document.querySelector('#demo-panel');
  panel.innerHTML=content;
  panel.setAttribute('aria-labelledby',`demo-tab-${selectedTab}`);
  document.querySelectorAll('[data-tab]').forEach(button=>{const active=Number(button.dataset.tab)===selectedTab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  document.querySelectorAll('[data-project]').forEach(button=>{const active=Number(button.dataset.project)===selectedProject;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelector('#handoff-target')?.addEventListener('change',(event)=>{selectedTarget=event.target.value;document.querySelector('#handoff-preview').value=contextText();document.querySelector('#copy-status').textContent='';});
  document.querySelector('#copy-context')?.addEventListener('click',async()=>{
    const status=document.querySelector('#copy-status');
    try { await navigator.clipboard.writeText(contextText()); status.textContent=t.demo.copied; }
    catch { document.querySelector('#handoff-preview').focus();document.querySelector('#handoff-preview').select();status.textContent=t.demo.copyFailed; }
  });
}
function bindEvents() {
  document.querySelector('#language').addEventListener('change',(event)=>{
    currentLocale=event.target.value;
    try { localStorage.setItem('carrythread-site-language',currentLocale); } catch { /* Still switch without persistence. */ }
    const nextURL=new URL(location.href);nextURL.searchParams.set('lang',currentLocale);history.replaceState(null,'',nextURL);
    render();document.querySelector('#language').focus({preventScroll:true});
  });
  document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{selectedProject=Number(button.dataset.project);renderDemo();}));
  document.querySelectorAll('[data-tab]').forEach(button=>{
    button.addEventListener('click',()=>{selectedTab=Number(button.dataset.tab);renderDemo();});
    button.addEventListener('keydown',(event)=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      selectedTab=event.key==='Home'?0:event.key==='End'?2:(selectedTab+(event.key==='ArrowRight'?1:2))%3;
      renderDemo();document.querySelector(`#demo-tab-${selectedTab}`).focus();
    });
  });
}
render();
