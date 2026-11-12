// Prints the CHANGELOG.md section for a tag (vX.Y.Z) as release notes; fails if the tag and package.json disagree or the section is missing.
import fs from 'node:fs';
import { changelogSection } from '../electron/release.mjs';

const tag = process.argv[2] ?? '', version = tag.replace(/^v/, '');
const { version: packageVersion } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (version !== packageVersion) throw new Error(`The tag ${tag} does not match package.json (${packageVersion}).`);
const section = changelogSection(fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version);
if (!section) throw new Error(`CHANGELOG.md has no section for ${version}.`);
console.log(section.split('\n').slice(1).join('\n').trim());
