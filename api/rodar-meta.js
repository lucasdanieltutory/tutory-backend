export default async function handler(req, res) {
  try {
    const data = req.query?.data || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const baseUrl = `https://${req.headers.host}`;
    const response = await fetch(`${baseUrl}/api/meta-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
