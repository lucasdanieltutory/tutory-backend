import { scoreLead } from '../lib/claude.js';
import { supabase } from '../lib/supabase.js';

function detectarCanal(source) {
  if (!source) return 'Orgânico';
  const s = source.toLowerCase();
  if (s.includes('landing') || s.includes('lp')) return 'Landing Page';
  if (s.includes('instagram') || s.includes('paid')) return 'Typebot';
  if (s.includes('organic') || s.includes('direct')) return 'Orgânico';
  return 'Orgânico';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const properties = body.properties || body;
    const canal = detectarCanal(properties.hs_analytics_source);

    const lead = {
      contact_name: `${properties.firstname || ''} ${properties.lastname || ''}`.trim(),
      contact_email: properties.email || '',
      contact_phone: properties.phone || '',
      contact_instagram: properties.instagram || '',
      contact_tag: properties.hs_analytics_source || '',
      cargo: properties.jobtitle || '',
      cargo_lp: '',
      faturamento: properties.faturamento || '',
      momento: properties.momento || '',
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

    return res.status(200).json({ success: true, score: scoreData.score });
  } catch (err) {
    console.error('Erro webhook-hubspot:', err);
    return res.status(500).json({ error: err.message });
  }
}
