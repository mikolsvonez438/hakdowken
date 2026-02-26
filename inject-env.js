const fs = require('fs');

const apiUrl = process.env.VITE_API_URL || '';
const secretHeader = process.env.VITE_SECRET_HEADER || '';
const secretToken = process.env.VITE_SECRET_TOKEN || '';

let appJs = fs.readFileSync('src/app.js', 'utf8');

appJs = appJs
  .replace('__API_URL__', Buffer.from(apiUrl).toString('base64'))
  .replace('__SECRET_HEADER__', Buffer.from(secretHeader).toString('base64'))
  .replace('__SECRET_TOKEN__', Buffer.from(secretToken).toString('base64'));

if (!fs.existsSync('dist')) fs.mkdirSync('dist');
fs.writeFileSync('dist/app.js', appJs);

console.log('Environment variables injected!');
