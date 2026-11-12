import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {compareVersions,pickInstaller,changelogSection,markdownToHtml,plainNotes} from '../electron/release.mjs';
test('Versions compare numerically and accept a leading v',()=>{
 assert.ok(compareVersions('v0.10.0','0.9.9')>0);assert.ok(compareVersions('0.2.0','v0.2.1')<0);assert.equal(compareVersions('v1.0.0','1.0.0'),0);assert.equal(compareVersions('1.2','1.2.0'),0);
});
test('The installer matches the system and architecture',()=>{
 const assets=['tariPRO-0.2.0-arm64.dmg','tariPRO-0.2.0-x64.dmg','tariPRO-0.2.0-x64.exe','tariPRO-0.2.0-arm64.dmg.blockmap','latest.yml'].map(name=>({name,browser_download_url:`https://example.test/${name}`}));
 assert.equal(pickInstaller(assets,'darwin','arm64'),'https://example.test/tariPRO-0.2.0-arm64.dmg');
 assert.equal(pickInstaller(assets,'darwin','x64'),'https://example.test/tariPRO-0.2.0-x64.dmg');
 assert.equal(pickInstaller(assets,'win32','x64'),'https://example.test/tariPRO-0.2.0-x64.exe');
 assert.equal(pickInstaller([],'darwin','arm64'),null);assert.equal(pickInstaller(assets,'linux','x64'),null);
});
test('Changelog sections and HTML come out of the real CHANGELOG.md',async()=>{
 const markdown=await fs.readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8');
 const section=changelogSection(markdown,'0.1.0');assert.match(section,/^## \[0\.1\.0\]/);assert.doesNotMatch(section,/Unreleased/);
 assert.doesNotMatch(changelogSection(markdown),/Keep a Changelog|Unreleased/);assert.match(changelogSection(markdown),/^## \[\d+\.\d+\.\d+\]/);assert.equal(changelogSection(markdown,'9.9.9'),'');
 const html=markdownToHtml('## [1.0.0]\n\n### Añadido\n- Uno con `código` y **negrita**\n- <script>\n\nVer [web](https://example.test).');
 assert.equal(html,'<h2>1.0.0</h2>\n<h3>Añadido</h3>\n<ul>\n<li>Uno con <code>código</code> y <strong>negrita</strong></li>\n<li>&lt;script&gt;</li>\n</ul>\n<p>Ver <a href="https://example.test">web</a>.</p>');
 assert.equal(plainNotes('### Añadido\n- **Uno** y `dos`'),'Añadido\n• Uno y dos');assert.equal(plainNotes('x'.repeat(20),10),`${'x'.repeat(10)}…`);
});
