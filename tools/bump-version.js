#!/usr/bin/env node
// Richiesta 42 (TODO 4/5): ?v= automatico su CSS e JS.
//
// GitHub Pages fa tenere CSS e JS in cache al browser per 10 minuti
// (Cache-Control: max-age=600). Per far riscaricare subito un file cambiato,
// index.html lo richiama con ?v=<hash>: l'hash sono i primi 8 caratteri dello
// SHA-256 del contenuto di QUEL file, quindi cambia solo quando cambia lui.
//
// Uso:
//   node tools/bump-version.js            legge i file dalla cartella di lavoro
//   node tools/bump-version.js --staged   legge i file preparati per il commit
//                                         (lo usa l'hook .githooks/pre-commit)
//
// I fine riga vengono portati a LF prima dell'hash: così il risultato è lo
// stesso su Windows (CRLF con core.autocrlf=true) e nel repository (LF).
// Esce con codice 1 se un file richiamato in index.html non esiste.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const STAGED = process.argv.includes('--staged');

// Solo attributi href/src che puntano a css/*.css o js/*.js locali
// (gli script da CDN hanno un URL completo e non corrispondono).
const RIF = /((?:href|src)=["'])((?:css|js)\/[A-Za-z0-9_.-]+\.(?:css|js))(?:\?v=[^"']*)?(["'])/g;

function leggiFile(rel) {
  if (STAGED) {
    try {
      return execFileSync('git', ['show', ':' + rel], {
        cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (e) {
      return null; // non presente nell'area di stage
    }
  }
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs) : null;
}

function hash8(buf) {
  const lf = Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  return crypto.createHash('sha256').update(lf).digest('hex').slice(0, 8);
}

const originale = fs.readFileSync(INDEX, 'utf8');
const mancanti = [];
const cambiati = [];

const nuovo = originale.replace(RIF, (intero, prima, rel, dopo) => {
  const buf = leggiFile(rel);
  if (buf === null) {
    mancanti.push(rel);
    return intero;
  }
  const h = hash8(buf);
  const sostituto = `${prima}${rel}?v=${h}${dopo}`;
  if (sostituto !== intero) cambiati.push(`${rel}  ->  ?v=${h}`);
  return sostituto;
});

if (mancanti.length) {
  console.error('bump-version: file richiamati in index.html ma non trovati' +
    (STAGED ? ' nel commit' : '') + ':');
  for (const m of mancanti) console.error('  - ' + m);
  process.exit(1);
}

if (nuovo === originale) {
  console.log('bump-version: nessun ?v= da aggiornare.');
} else {
  fs.writeFileSync(INDEX, nuovo, 'utf8');
  console.log('bump-version: aggiornati in index.html:');
  for (const c of cambiati) console.log('  ' + c);
}
