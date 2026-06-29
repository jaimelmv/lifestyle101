const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Admin password check — fail closed if env var is not set
  const ADMIN_PASS = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASS) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }
  const provided = body.adminPassword || '';
  // Constant-time comparison to prevent timing-based enumeration
  const a = Buffer.from(provided.padEnd(ADMIN_PASS.length));
  const b = Buffer.from(ADMIN_PASS);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { code, client } = body;
  if (!code || !client) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or client data' }) };
  }

  // Sanitize code: alphanumeric + hyphens only
  const safeCode = code.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!safeCode) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid code' }) };
  }

  const clientData = {
    code: safeCode,
    name: client.name || '',
    createdAt: client.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    buyList: client.buyList || [],
    stopList: client.stopList || [],
    recommendations: client.recommendations || [],
    notes: client.notes || '',
    goal: client.goal || '',
  };

  // Write to clients/ folder
  const filePath = path.join('/var/task', '..', '..', 'clients', `${safeCode}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(clientData, null, 2));
  } catch (err) {
    // On Netlify, filesystem writes don't persist — we return the data for the client to download
    // The admin must manually add the file to the repo
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, data: clientData, manual: true })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, data: clientData })
  };
};
