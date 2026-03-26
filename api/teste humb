// api/test-thumb.js — rota temporária para debug de thumbnails
export default async function handler(req, res) {
  try {
    const TOKEN      = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE       = 'https://graph.facebook.com/v19.0';

    // Testa 3 formas diferentes de buscar a thumbnail
    const results = {};

    // Forma 1: creative com thumbnail_url
    const r1 = await fetch(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name,creative{thumbnail_url}&limit=3&access_token=${TOKEN}`);
    const d1 = await r1.json();
    results.forma1_thumbnail_url = d1.data?.map(a => ({ id: a.id, name: a.name, thumb: a.creative?.thumbnail_url })) || d1.error;

    // Forma 2: creative com picture
    const r2 = await fetch(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name,creative{picture}&limit=3&access_token=${TOKEN}`);
    const d2 = await r2.json();
    results.forma2_picture = d2.data?.map(a => ({ id: a.id, name: a.name, thumb: a.creative?.picture })) || d2.error;

    // Forma 3: creative com image_url
    const r3 = await fetch(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name,creative{image_url}&limit=3&access_token=${TOKEN}`);
    const d3 = await r3.json();
    results.forma3_image_url = d3.data?.map(a => ({ id: a.id, name: a.name, thumb: a.creative?.image_url })) || d3.error;

    // Forma 4: buscar creative diretamente pelo ID
    const r4 = await fetch(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name,adcreatives{thumbnail_url,image_url,picture}&limit=3&access_token=${TOKEN}`);
    const d4 = await r4.json();
    results.forma4_adcreatives = d4.data?.map(a => ({ id: a.id, name: a.name, creatives: a.adcreatives })) || d4.error;

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
