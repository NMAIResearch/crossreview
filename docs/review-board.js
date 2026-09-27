// Purpose: display optional reviewer context and distinct declared reviewers from GitHub issues.
(function (root) {
  'use strict';
  const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
  function field(body, label) {
    const sections = String(body || '').split(/^### /m).slice(1);
    for (const section of sections) {
      const end = section.indexOf('\n');
      if (end >= 0 && section.slice(0, end).trim() === label) {
        const value = section.slice(end + 1).trim();
        return value === '_No response_' ? '' : value;
      }
    }
    return '';
  }
  function submissionNumber(issue) {
    const raw = field(issue.body, 'Submission issue number');
    return /^#?[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw.replace('#',''))) ? Number(raw.replace('#','')) : null;
  }
  function eligible(issue) {
    const labels=new Set((issue.labels||[]).map(l=>typeof l==='string'?l:l.name));
    return issue.state==='open' && labels.has('precheck-passed') && labels.has('credit-cleared')
      && !['precheck-pending','precheck-failed','credit-pending','needs-review-credit'].some(l=>labels.has(l));
  }
  function activeReviewers(submissions, notices) {
    const authors = new Map(submissions.map(s => [s.number, String(s.user?.login || '').toLowerCase()]));
    const result = new Map(submissions.map(s => [s.number, new Map()]));
    for (const notice of notices) {
      const number = submissionNumber(notice), login = notice.user?.login;
      if (notice.pull_request || notice.state !== 'open' || notice.user?.type === 'Bot' || !/^[A-Za-z0-9-]{1,39}$/.test(login || '')) continue;
      if (!(notice.labels || []).some(l => (typeof l === 'string' ? l : l.name) === 'review-in-progress')) continue;
      if (!result.has(number) || authors.get(number) === login.toLowerCase()) continue;
      result.get(number).set(login.toLowerCase(), login);
    }
    return new Map([...result].map(([n,people]) => [n,[...people.values()]]));
  }
  async function issues(repo, label, state, fetcher) {
    if (!REPO.test(repo)) throw new Error('Invalid repository');
    const found = [];
    for (let page = 1; page <= 10; page++) {
      const q = new URLSearchParams({labels:label,state,per_page:'100',page:String(page)});
      const response = await fetcher(`https://api.github.com/repos/${repo}/issues?${q}`);
      if (!response.ok) throw new Error('Issue list unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected issue response');
      found.push(...rows.filter(r => !r.pull_request));
      if (rows.length < 100) return found;
    }
    throw new Error('Issue list exceeds the verified page limit');
  }
  function render(el, rows, repo, type, activity) {
    el.replaceChildren();
    if (!rows.length) {el.textContent = type === 'submission' ? 'Nothing waiting. Be the first to submit.' : 'No reviews yet.'; return;}
    const list = document.createElement('ul');
    for (const item of rows.slice(0,12)) {
      if (!Number.isSafeInteger(item.number) || item.number < 1) continue;
      const li=document.createElement('li'), a=document.createElement('a');
      a.href=`https://github.com/${repo}/issues/${item.number}`;
      a.textContent=String(item.title || '').replace(/^\[(submission|review)\]\s*/i,'') || `#${item.number}`;
      li.append(a);
      for (const label of item.labels || []) {
        if (['precheck-passed','precheck-failed','needs-review-credit'].includes(label.name)) {
          const tag=document.createElement('span');tag.className='tag';tag.textContent=label.name.replace(/-/g,' ');li.append(tag);
        }
      }
      const perspective=field(item.body,type==='submission'?'Project domain (optional)':'Your domain experience (optional)');
      if(perspective) {const p=document.createElement('p');p.textContent=(type==='submission'?'Domain: ':'Reviewer perspective (self-described): ')+perspective;li.append(p);}
      if(type==='submission') {
        const p=document.createElement('p'), people=activity?.get(item.number);
        p.textContent=people ? `${people.length} ${people.length===1?'reviewer':'reviewers'} marked as reviewing${people.length?': '+people.map(x=>'@'+x).join(', '):''}.` : 'Review activity unavailable.';
        li.append(p);
        const start=document.createElement('a');
        start.href=`https://github.com/${repo}/issues/new?`+new URLSearchParams({template:'start-review.yml',submission:String(item.number)});
        start.textContent='Pick up this review';li.append(start);
      }
      list.append(li);
    }
    el.append(list);
  }
  async function mount({repo,open,done,fetcher=fetch}) {
    const [submissions,reviews,notices]=await Promise.allSettled([
      issues(repo,'submission','open',fetcher),issues(repo,'review','all',fetcher),issues(repo,'review-in-progress','open',fetcher)
    ]);
    if(submissions.status==='fulfilled') render(open,submissions.value.filter(eligible),repo,'submission',notices.status==='fulfilled'?activeReviewers(submissions.value,notices.value):null);
    else open.textContent='Live list unavailable right now. Browse the issues on GitHub instead.';
    if(reviews.status==='fulfilled') render(done,reviews.value,repo,'review');
    else done.textContent='Live list unavailable right now. Browse the issues on GitHub instead.';
  }
  const api={field,submissionNumber,activeReviewers,issues,mount,eligible};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.CrossreviewBoard=api;
})(globalThis);
