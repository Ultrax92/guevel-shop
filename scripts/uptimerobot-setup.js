// scripts/uptimerobot-setup.js
// Crée les moniteurs UptimeRobot (préprod + prod) avec alerte e-mail.
// Usage : node scripts/uptimerobot-setup.js   (lit UPTIMEROBOT_API_KEY dans .env.uptimerobot, jamais affichée)
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.uptimerobot');
const apiKey = (fs.readFileSync(envFile, 'utf8').match(/^UPTIMEROBOT_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!apiKey) throw new Error('UPTIMEROBOT_API_KEY absente de .env.uptimerobot');

const DOMAIN = 'guevel-shop.xyz';
const services = ['api', 'gateway', 'notifications', 'stock'];
const monitors = [];
for (const [env, suffix] of [
  ['PROD', ''],
  ['PREPROD', '-preprod'],
]) {
  monitors.push({ name: `${env} - frontend`, url: `https://${suffix ? `preprod.${DOMAIN}` : DOMAIN}/`, type: 1 });
  for (const s of services) {
    // Moniteur "mot-clé" : alerte si la sonde ne contient plus "status":"ok" (couvre aussi db down sur l'API)
    monitors.push({
      name: `${env} - ${s}`,
      url: `https://${s}${suffix}.${DOMAIN}/health`,
      type: 2,
      keyword: '"status":"ok"',
    });
  }
}

const call = async (method, params) => {
  const body = new URLSearchParams({ api_key: apiKey, format: 'json', ...params });
  const res = await fetch(`https://api.uptimerobot.com/v2/${method}`, { method: 'POST', body });
  return res.json();
};

(async () => {
  const contacts = await call('getAlertContacts', {});
  if (contacts.stat !== 'ok') throw new Error(`getAlertContacts : ${JSON.stringify(contacts.error)}`);
  const alertContacts = contacts.alert_contacts.map((c) => `${c.id}_0_0`).join('-');
  console.log(`Contacts d'alerte : ${contacts.alert_contacts.length}`);

  const existing = await call('getMonitors', {});
  const existingUrls = new Set((existing.monitors || []).map((m) => m.url));

  for (const m of monitors) {
    if (existingUrls.has(m.url)) {
      console.log(`déjà présent  ${m.name}`);
      continue;
    }
    const params = { friendly_name: m.name, url: m.url, type: m.type, interval: 300, alert_contacts: alertContacts };
    if (m.type === 2) Object.assign(params, { keyword_type: 2, keyword_case_type: 0, keyword_value: m.keyword });
    const r = await call('newMonitor', params);
    console.log(
      `${r.stat === 'ok' ? 'créé        ' : 'ÉCHEC       '} ${m.name} -> ${m.url}${r.stat === 'ok' ? '' : ' ' + JSON.stringify(r.error)}`
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
