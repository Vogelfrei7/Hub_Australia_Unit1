// Erzeugt aus core.md + topics/*.md die fertigen System-Prompts für Sidekick.
// Aufruf:  node agents/build.mjs      → agents/dist/<ID>.md (komplett in Sidekick einfügen)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const read = (p) => readFileSync(new URL(p, dir), 'utf8').replace(/\r\n/g, '\n');
const registry = JSON.parse(read('registry.json'));
const core = read('core.md');

function parseTopic(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Themen-Datei ohne Kopfbereich (---)');
  const meta = Object.fromEntries(m[1].split('\n').map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  return { meta, body: m[2].trim() };
}

const agents = registry.agents.map((a) => (a.file ? { ...a, ...parseTopic(read(a.file)) } : a));
for (const a of agents) if (a.meta) a.name = a.meta.name;

const table = agents.map((a) =>
  `- **${a.name}** (ID ${a.id}): ${a.covers}; Blatt-IDs ${a.sheets}${a.active ? '' : ' – noch nicht freigeschaltet: Kinder bitte an die Lehrkraft verweisen'}`,
).join('\n');

mkdirSync(new URL('dist/', dir), { recursive: true });
for (const a of agents.filter((x) => x.meta)) {
  const fill = {
    AGENT_NAME: a.name,
    AGENT_ID: a.id,
    BOOK: registry.book,
    TOPIC_NAME: a.meta.topic,
    DEFAULT_SHEET: a.meta.default_sheet,
    RESULT_URL: registry.resultUrl,
    AGENT_TABLE: table,
    TOPIC: a.body,
  };
  let out = core.replace(/\{\{(\w+)\}\}/g, (all, k) => {
    if (!(k in fill)) throw new Error(`Unbekannter Platzhalter ${all}`);
    return fill[k];
  });
  if (/\{\{\w+\}\}/.test(out)) throw new Error(`Platzhalter übrig in ${a.id}`);
  const starters = (a.meta.starters || '').split('|').map((s) => s.trim()).filter(Boolean);
  writeFileSync(new URL(`dist/${a.id}.md`, dir), out + '\n');
  writeFileSync(new URL(`dist/${a.id}.setup.md`, dir),
    `# ${a.name} – Einrichtung in Sidekick\n\n` +
    `- **Name:** ${a.name}\n- **System-Prompt:** Inhalt von \`dist/${a.id}.md\` komplett einfügen (${out.length} Zeichen)\n` +
    `- **Modell:** Sonnet 5.5 (Alternative: GPT 6 Sol)\n- **Wissen:** nur die Blätter und Lösungen dieses Themas (${a.meta.sheets}) – keine anderen Themen\n` +
    `- **Nutzergedächtnis:** aus\n- **Starter-Buttons:**\n${starters.map((s) => `  - ${s}`).join('\n')}\n` +
    `- **Weiterleitung (cascading):** alle anderen Coaches aus der Liste erlauben\n`);
  console.log(`${a.id}: ${out.length} Zeichen → agents/dist/${a.id}.md`);
}
