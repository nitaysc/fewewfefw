// Guards the Android wrapper's identity. This project's android/ folder started as a copy of
// another app's, and an early build shipped with that app's name and landscape lock.
// CI runs this before building, so that cannot happen again unnoticed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const android = path.join(root, 'android');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const NAME = 'Rookwise';
const ID = 'com.rookwise.chess';

// display name
const strings = read('android/app/src/main/res/values/strings.xml');
const str = (key) => (new RegExp('<string name="' + key + '">([^<]*)</string>').exec(strings) || [])[1];
assert.strictEqual(str('app_name'), NAME, 'app_name in strings.xml');
assert.strictEqual(str('title_activity_main'), NAME, 'title_activity_main in strings.xml');
assert.strictEqual(str('package_name'), ID, 'package_name in strings.xml');
assert.strictEqual(str('custom_url_scheme'), ID, 'custom_url_scheme in strings.xml');

// the board is laid out for an upright phone
const manifest = read('android/app/src/main/AndroidManifest.xml');
const orient = (/android:screenOrientation="([^"]*)"/.exec(manifest) || [])[1];
assert.strictEqual(orient, 'portrait', 'screenOrientation in AndroidManifest.xml');

// package identity
const gradle = read('android/app/build.gradle');
assert(gradle.includes('namespace "' + ID + '"'), 'namespace in build.gradle');
assert(gradle.includes('applicationId "' + ID + '"'), 'applicationId in build.gradle');
const cap = JSON.parse(read('capacitor.config.json'));
assert.strictEqual(cap.appId, ID, 'appId in capacitor.config.json');
assert.strictEqual(cap.appName, NAME, 'appName in capacitor.config.json');
assert.strictEqual(cap.webDir, 'www', 'webDir in capacitor.config.json');
const activity = read('android/app/src/main/java/' + ID.split('.').join('/') + '/MainActivity.java');
assert(activity.includes('package ' + ID + ';'), 'package line in MainActivity.java');

// nothing left over from the app this wrapper was copied from
const SKIP = new Set(['build', '.gradle', 'node_modules', 'public', 'capacitor-cordova-android-plugins']);
const TEXT = /\.(xml|java|gradle|json|properties|pro|kts|txt)$/;
const stale = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (TEXT.test(e.name) && /putt\s*party|puttparty/i.test(fs.readFileSync(p, 'utf8'))) stale.push(path.relative(root, p));
  }
})(android);
assert.deepStrictEqual(stale, [], 'files still naming the old app: ' + stale.join(', '));

console.log('android config ok (' + NAME + ', ' + ID + ', portrait)');
