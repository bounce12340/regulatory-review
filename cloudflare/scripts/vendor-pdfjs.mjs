// Copies the pdf.js files the browser needs into public/vendor/pdfjs, so PDFs can be
// turned into text in the browser and served from our own origin (CSP: script-src 'self').
// Run after upgrading pdfjs-dist:  npm run vendor:pdfjs
import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";

const src = "node_modules/pdfjs-dist";
const dest = "public/vendor/pdfjs";
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of ["build/pdf.min.mjs", "build/pdf.worker.min.mjs", "LICENSE"]) {
  cpSync(`${src}/${f}`, `${dest}/${f.split("/").pop()}`);
}
// Character maps let pdf.js map CJK font codes (common in Taiwanese PDFs) to Unicode.
cpSync(`${src}/cmaps`, `${dest}/cmaps`, { recursive: true });
const { version } = JSON.parse(readFileSync(`${src}/package.json`, "utf8"));
console.log(`pdf.js ${version} copied to ${dest}`);
