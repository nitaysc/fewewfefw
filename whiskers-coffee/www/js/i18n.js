// Languages. Text is written in English in the code and looked up here by that English
// text, so t('Not enough coins') gives the Russian when Russian is chosen. Placeholders
// like {name} are filled from vars. Game rules on the host return messages made with
// msg(), which carries the placeholders across the network so each phone shows them in
// its own language.
import { RU } from './lang/ru.js';

const LANGS = { en: null, ru: RU };
export const LANGUAGES = [['en', 'English'], ['ru', 'Русский']];
let lang = 'en';
export const setLang = (l) => { lang = LANGS[l] !== undefined ? l : 'en'; document.documentElement.lang = lang; };
export const getLang = () => lang;

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : s);
export function t(s, vars) {
  const d = LANGS[lang];
  let out = (d && d[s]) || s;
  // translate values that are themselves names (drinks, foods, furniture...)
  if (vars) { const v = {}; for (const k in vars) v[k] = typeof vars[k] === 'string' && d && d[vars[k]] ? d[vars[k]] : vars[k]; return fill(out, v); }
  return out;
}
// a message to show on any phone: msg('{name} joined', {name}) -> 'key\u0001{json}'
export const msg = (s, vars) => (vars ? s + '\u0001' + JSON.stringify(vars) : s);
export function tr(m) {
  if (typeof m !== 'string') return '';
  const i = m.indexOf('\u0001');
  if (i < 0) return t(m);
  let vars = {};
  try { vars = JSON.parse(m.slice(i + 1)); } catch { /* plain text */ }
  return t(m.slice(0, i), vars);
}
// static text in the page: <b data-t="Join a friend">Join a friend</b>
export function translatePage(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of root.querySelectorAll('[data-t-ph]')) el.placeholder = t(el.dataset.tPh);
}
