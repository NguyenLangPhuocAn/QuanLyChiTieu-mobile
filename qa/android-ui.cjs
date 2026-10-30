const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const adb = path.join(process.env.ANDROID_HOME || path.join(os.homedir(), 'AppData/Local/Android/Sdk'), 'platform-tools/adb.exe');
const call = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
const evidenceSet = process.env.NOVA_QA_EVIDENCE_SET || '2026-10-26-recurring';
if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(evidenceSet)) throw new Error('Invalid QA evidence folder name.');
const output = path.join(__dirname, 'evidence', evidenceSet);
fs.mkdirSync(output, { recursive: true });
const [action, ...args] = process.argv.slice(2);
if (action !== 'screen') {
  const focus = call('shell', 'dumpsys', 'window').split('\n').filter(line => /mCurrentFocus=/.test(line)).join('\n');
  if (!/com\.mobile\.dev|permissioncontroller|NotificationShade|com\.android\.systemui|com\.(?:google\.android|android)\.documentsui|com\.google\.android\.providers\.media\.module\/com\.android\.providers\.media\.photopicker\.PhotoPickerActivity|com\.google\.android\.apps\.nexuslauncher|com\.android\.launcher3|com\.android\.camera2/.test(focus))
    throw new Error('QA app/system dialog is not focused; inspect a new screenshot before acting.');
}
const attributes = xml => [...xml.matchAll(/<node\s+([^>]+)>?/g)].map(node => Object.fromEntries([...node[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]])));
const currentXml = () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
    const result = call('shell', 'uiautomator', 'dump', '/sdcard/nova-qa-window.xml');
    if (result.includes('ERROR') || !result.includes('dumped to')) continue;
    const xml = call('shell', 'cat', '/sdcard/nova-qa-window.xml');
    if (xml.includes('<hierarchy')) return xml;
    } catch {
      // The emulator can kill UiAutomator during a transition; never read the old dump.
    }
  }
  throw new Error('Android UI dump failed; do not reuse a stale UI tree.');
};
if (action === 'fill' || action === 'press') {
  const nodes = attributes(currentXml()).filter(node => node['content-desc'] === args[0] && (action !== 'fill' || node.class === 'android.widget.EditText'));
  if (nodes.length !== 1) throw new Error(`Expected one visible control for ${args[0]}.`);
  const bounds = [...nodes[0].bounds.matchAll(/\d+/g)].map(match => Number(match[0]));
  if (bounds.length !== 4 || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw new Error('Control is off screen; scroll and observe again.');
  call('shell', 'input', 'tap', String(Math.round((bounds[0] + bounds[2]) / 2)), String(Math.round((bounds[1] + bounds[3]) / 2)));
  if (action === 'fill') {
    if (!attributes(currentXml()).some(node => node['content-desc'] === args[0] && node.focused === 'true' && node.password !== 'true')) throw new Error('Input focus not verified.');
    call('shell', 'input', 'text', args[1].replace(/ /g, '%s'));
  }
}
else if (action === 'tap') call('shell', 'input', 'tap', args[0], args[1]);
else if (action === 'text') call('shell', 'input', 'text', args[0].replace(/ /g, '%s'));
else if (action === 'back') call('shell', 'input', 'keyevent', '4');
else if (action === 'swipe') call('shell', 'input', 'swipe', ...args.slice(0, 4), '450');
else if (action !== 'screen') throw new Error('Use screen, tap, text, back or swipe.');
const name = action === 'screen' ? args[0] : args.at(-1);
if (!/^\d{2}-[a-z0-9-]+$/.test(name)) throw new Error('Evidence name must be NN-lowercase-words.');
const xml = currentXml();
fs.writeFileSync(path.join(output, `${name}.xml`), xml);
call('shell', 'screencap', '-p', '/sdcard/nova-qa-screen.png');
call('pull', '/sdcard/nova-qa-screen.png', path.join(output, `${name}.png`));
console.log(JSON.stringify({ screenshot: path.join(output, `${name}.png`) }));
for (const node of xml.matchAll(/<node\s+([^>]+)>?/g)) {
  const attr = Object.fromEntries([...node[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  if (attr.text || attr['content-desc'] || attr.focused === 'true') console.log(JSON.stringify({ text: attr.text, description: attr['content-desc'], type: attr.class, bounds: attr.bounds, focused: attr.focused, password: attr.password }));
}
