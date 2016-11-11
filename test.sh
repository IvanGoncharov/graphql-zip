#!/bin/bash
export RESPONCE='./introspection_responce.json'
function minified() {
  node -e "console.log(JSON.stringify(JSON.parse(fs.readFileSync('$RESPONCE', 'utf-8'))))"
}

function gzipData() {
  gzip --best -ckn
}

function header() {
  node header.js
}

echo -e "Minified responce: \t$(minified | wc -c)"
echo -e "Gzipped responce: \t$(minified | gzipData | wc -c)"
echo -e "Header: \t\t$(header | wc -c)"
echo -e "Gzipped header: \t$(header | gzipData | wc -c)"
