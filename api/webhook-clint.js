import { scoreLead } from '../lib/claude.js';
import { supabase } from '../lib/supabase.js';

function detectarCanal(tag) {
  if (!tag) return 'Orgânico';
  const t = tag.toLowerCase();
  if (t.includes('lp 1 site') || t.includes('lp1')) return 'Landing Page';
  if (t.includes('formulárioresp') || t.includes('formularioresp')) return 'Respondi';
  if (t.includes('instagram') || t.includes('tráfego') || t.includes('trafego')) return 'Typebot';
  if (t.includes('site')) return 'Site Oficial';
  return 'Orgânico';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const canal = detectarCanal(body.contact_tag);

    const lead = {
      contact_name: body.contact_name || '',
      contact_email: body.contact_email || '',
      contact_phone: body.contact_phone || '',
      contact_instagram: body.contact_instagram || '',
      contact_tag: body.contact_tag || '',
      cargo: body.cargo || '',
      cargo_lp: body.cargo_lp || '',
      faturamento: body.faturamento || '',
      momento: body.momento || '',
      canal
    };

    const scoreData = await scoreLead(lead);

    const { error } = await supabase.from('leads_mentoria').insert({
      ...lead,
      score: scoreData.score,
      classificacao: scoreData.classificacao,
      resumo: scoreData.resumo,
      proxima_acao: scoreData.proxima_acao
    });

    if (error) throw error;

    return res.status(200).json({ success: true, score: scoreData.score, classificacao: scoreData.classificacao });
  } catch (err) {
    console.error('Erro webhook-clint:', err);
    return res.status(500).json({ error: err.message });
  }
}
