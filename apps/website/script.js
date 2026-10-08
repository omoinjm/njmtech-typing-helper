// Live repo stats via GitHub's public REST API — unauthenticated, CORS-enabled,
// no build step. A 403 (rate limited) or network failure just leaves the "—"
// placeholders in place rather than showing a broken loading state.
const REPO = 'omoinjm/njmtech-typing-helper';
const API = `https://api.github.com/repos/${REPO}`;

function formatCount(n) {
  if (typeof n !== 'number') return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  return response.ok ? response.json() : null;
}

async function loadRepoStats() {
  try {
    const [repo, release] = await Promise.all([getJson(API), getJson(`${API}/releases/latest`)]);
    if (repo) {
      setText('stat-stars', formatCount(repo.stargazers_count));
      setText('stat-forks', formatCount(repo.forks_count));
      // open_issues_count includes PRs; close enough for a landing page.
      setText('stat-issues', formatCount(repo.open_issues_count));
    }
    // 404 until the first tagged release exists.
    setText('stat-release', release?.tag_name ?? 'None yet');
  } catch (err) {
    console.error('[website] Failed to load GitHub repo stats:', err);
  }
}

loadRepoStats();
