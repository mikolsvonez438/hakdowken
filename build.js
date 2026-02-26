const fs = require('fs');

// Read the env variable
const apiDomain = process.env.API_DOMAIN || '';

// Read your script
let script = fs.readFileSync('script2.js', 'utf8');

// Replace placeholder with actual domain (base64 encoded)
const encodedDomain = Buffer.from(apiDomain).toString('base64');
script = script.replace('__API_DOMAIN__', `'${encodedDomain}'`);

// Write back
fs.writeFileSync('script2.js', script);
console.log('Domain injected!');
