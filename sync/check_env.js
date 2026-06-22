require('dotenv').config();
const p = process.env.SQL_AQUA_PASS || '';
console.log('Hex:', Buffer.from(p).toString('hex'));
console.log('Trim Hex:', Buffer.from(p.trim()).toString('hex'));
console.log('Length:', p.length, 'Trim Length:', p.trim().length);
console.log('User:', process.env.SQL_AQUA_USER);
