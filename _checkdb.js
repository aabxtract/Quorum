const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL);
const p = new Pool({
  host: url.hostname, port: parseInt(url.port || '5432'),
  database: url.pathname.replace(/^\//, ''),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false }
});
(async () => {
  try {
    const r = await p.query('SELECT id, email, display_name, wallet_address, auth_method FROM users ORDER BY created_at');
    console.log('Users:');
    r.rows.forEach(u => console.log(`  ${u.email} | method: ${u.auth_method} | wallet: ${u.wallet_address || 'none'}`));
  } catch(e) {
    console.error('Error:', e.message);
  }
  await p.end();
})();
