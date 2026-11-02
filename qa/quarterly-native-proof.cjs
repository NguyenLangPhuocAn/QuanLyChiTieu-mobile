const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Inspect only the isolated debug app's bill mirror; never export auth or billing names.
const adb = path.join(process.env.ANDROID_HOME || path.join(os.homedir(), 'AppData/Local/Android/Sdk'), 'platform-tools/adb.exe');
const xml = execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'run-as', 'com.mobile.dev', 'cat', 'shared_prefs/bill_reminders_v1.xml'], { encoding: 'utf8', windowsHide: true });
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strings = Object.fromEntries([...xml.matchAll(/<string name="([^"]+)">([\s\S]*?)<\/string>/g)].map(match => [match[1], decode(match[2])]));
const qaOwner = createHash('sha256').update('http://10.0.2.2:3304|9').digest('hex');
assert.equal(strings.active, qaOwner, 'Only the current isolated QA owner is allowed');
const book = JSON.parse(strings.book);
const quarterly = book.bills.filter(bill => bill.cycle === 'QUARTERLY');
assert.equal(quarterly.length, 1);
assert.equal(book.bills.length, 1);
assert.equal(book.periods.length, 0, 'No past period may be marked paid or skipped');
assert.equal(quarterly[0].anchorDate, '2026-01-31');
assert.equal(quarterly[0].startDate, '2027-01-31');
const proof = {
  package: 'com.mobile.dev', qaUserId: 9, activeOwnerIsIsolatedQa: true,
  quarterlyBills: quarterly.length,
  anchorDate: quarterly[0].anchorDate, startDate: quarterly[0].startDate,
  handledPeriods: book.periods.length, privateTokensIncluded: false,
};
const folder = path.join(__dirname, 'evidence', '2026-11-02-quarterly-bills');
fs.writeFileSync(path.join(folder, 'native-quarterly.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
