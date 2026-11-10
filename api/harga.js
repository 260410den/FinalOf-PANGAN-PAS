const { getPrices } = require('./_pihps.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const url = new URL(req.url, 'http://localhost');
  const jenis = url.searchParams.get('jenis') || 'tradisional';
  const rentang = url.searchParams.get('rentang') || '7d';
  try {
    const data = await getPrices(jenis, rentang);
    res.setHeader('Cache-Control', data.partial ? 'public, s-maxage=60' : 'public, s-maxage=10800, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 502).json({ ok: false, error: e.status ? e.message : 'Sumber harga PIHPS tidak dapat dihubungi saat ini.' });
  }
};

module.exports.config = { maxDuration: 60 };
