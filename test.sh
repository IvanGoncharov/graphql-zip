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

function body() {
  node body.js
}

function full_package() {
  (node header.js; node body.js)
}

echo -e "Minified responce: \t$(minified | wc -c)"
echo -e "Gzipped responce: \t$(minified | gzipData | wc -c)"
echo -e "Header: \t\t$(header | wc -c)"
echo -e "Gzipped header: \t$(header | gzipData | wc -c)"
echo -e "Body: \t\t\t$(body | wc -c)"
echo -e "Gzipped body: \t\t$(body | gzipData | wc -c)"
echo -e "Package: \t\t$(full_package | wc -c)"
echo -e "Gzip package: \t\t$(full_package | gzipData | wc -c)"
