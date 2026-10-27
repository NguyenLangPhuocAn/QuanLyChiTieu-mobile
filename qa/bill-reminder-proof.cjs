const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const adb = path.join(process.env.ANDROID_HOME || path.join(os.homedir(), 'AppData/Local/Android/Sdk'), 'platform-tools/adb.exe');
const call = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args], { encoding: 'utf8', windowsHide: true });
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// Only the isolated debug app. Never read auth storage or the production app's preferences.
const xml = call('shell', 'run-as', 'com.mobile.dev', 'cat', 'shared_prefs/bill_reminders_v1.xml');
const strings = Object.fromEntries([...xml.matchAll(/<string name="([^"]+)">([\s\S]*?)<\/string>/g)].map(match => [match[1], decode(match[2])]));
const owner = strings.active;
const book = strings.book ? JSON.parse(strings.book) : null;
const set = [...xml.matchAll(/<set name="([^"]+)">([\s\S]*?)<\/set>/g)].find(match => match[1] === `${owner}:sent`);
const sentCount = set ? [...set[2].matchAll(/<string>/g)].length : 0;
const enabled = xml.includes(`<boolean name="${owner}:enabled" value="true"`);
const alarms = call('shell', 'dumpsys', 'alarm');
const alarmLines = alarms.split('\n');
const alarmVisible = alarmLines.some((line, index) => line.includes('tag=*walarm*:com.mobile.action.BILL_REMINDER') && alarmLines[index - 1]?.includes('com.mobile.dev'));
const proof = {
  date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()), package: 'com.mobile.dev', activeOwnerSet: Boolean(owner), nativeMirrorPresent: Boolean(book), enabled,
  billCount: book?.bills.length ?? 0,
  eligibleBillCount: book?.bills.filter(b => !b.paused && !b.archived && b.reminderEnabled).length ?? 0,
  trackedStartDateCount: book?.bills.filter(b => b.startDate).length ?? 0,
  handledPeriodCount: book?.periods.length ?? 0,
  durableSentKeyCount: sentCount, postedDay: strings.postedDay || null, alarmVisible,
  privateNamesAmountsTokensIncluded: false,
};
const name = process.argv[2];
if (!/^[a-z0-9-]+$/.test(name || '')) throw new Error('Use a lowercase evidence name.');
const evidenceSet = process.env.NOVA_QA_EVIDENCE_SET || '2026-10-27-bill-reminders';
if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(evidenceSet)) throw new Error('Invalid QA folder.');
const output = path.join(__dirname, 'evidence', evidenceSet, `${name}.json`);
fs.writeFileSync(output, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
