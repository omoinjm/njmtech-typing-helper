// Live star count via GitHub's public REST API — unauthenticated, CORS-enabled,
// no build step. A 403 (rate limited) or network failure just leaves it blank.
const REPO = 'omoinjm/njmtech-typing-helper';

async function loadRepoStats() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`);
    if (!response.ok) return;
    const data = await response.json();
    if (typeof data.stargazers_count === 'number') {
      const n = data.stargazers_count;
      document.getElementById('stat-stars').textContent = `★ ${n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}`;
    }
  } catch (err) {
    console.error('[website] Failed to load GitHub repo stats:', err);
  }
}

loadRepoStats();
