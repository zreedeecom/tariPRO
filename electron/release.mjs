// Pure helpers for update checks and release notes; no Electron imports so they can be tested with node --test.

const parts = version => String(version).replace(/^v/, '').split('-')[0].split('.').map(Number);

// Positive when a is newer than b. Pre-release suffixes are ignored: releases are plain X.Y.Z.
export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let index = 0; index < 3; index++) { const difference = (x[index] || 0) - (y[index] || 0); if (difference) return difference; }
  return 0;
}

// Installer for this system from a GitHub release: `-arm64.dmg` / `-x64.dmg` on Mac, `.exe` on Windows. Null if missing.
export function pickInstaller(assets, platform, arch) {
  const suffix = platform === 'darwin' ? `-${arch}.dmg` : platform === 'win32' ? '.exe' : null;
  return assets?.find(asset => suffix && asset.name.endsWith(suffix))?.browser_download_url ?? null;
}

// Released sections of the changelog (skips the format note and Unreleased); with a version, only that one.
export function changelogSection(markdown, version) {
  const sections = markdown.split(/^(?=## )/m).filter(section => section.startsWith('## [') && !section.startsWith('## [Unreleased]'));
  return (version ? sections.filter(section => section.startsWith(`## [${version}]`)) : sections).join('').trim();
}

const escape = text => text.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const inline = text => escape(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

// Just what CHANGELOG.md uses: headings, lists, paragraphs, bold, code and links.
export function markdownToHtml(markdown) {
  const html = []; let list = false;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^(#{1,4}) (.*)/), item = line.match(/^[-*] (.*)/);
    if (!item && list) { html.push('</ul>'); list = false; }
    // Version headings drop Keep a Changelog's brackets: "[0.2.0] - 2026-11-12" reads "0.2.0 - 2026-11-12".
    if (heading) html.push(`<h${heading[1].length}>${inline(heading[2].replace(/^\[([^\]]+)\]/, '$1'))}</h${heading[1].length}>`);
    else if (item) { if (!list) { html.push('<ul>'); list = true; } html.push(`<li>${inline(item[1])}</li>`); }
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  if (list) html.push('</ul>');
  return html.join('\n');
}

// Release notes as plain text for a native dialog.
export function plainNotes(markdown, limit = 1200) {
  const text = markdown.replace(/^#{1,4} /gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-*] /gm, '• ').trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}
