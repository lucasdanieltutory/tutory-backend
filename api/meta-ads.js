import { detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const dataStr = ontem.toISOString().split('T')[0];

    const TOKEN = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE = 'https://graph.facebook.com/v19.0';

    const fields = [
      'campaign_name',
      'adset_name',
      'ad_name',
      'impressions',
      'clicks',
      'ctr',
      'cpc',
      'spend',
      'actions',
      'cost_per_action_type',
      'creative{thumbnail_url}'
    ].join(',');

    const url = `${BASE}/${AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${dataStr}","until":"${dataStr}"}&level=ad&access_token=${TOKEN}&limit=500`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    const anuncios = data.data || [];
    let salvos = { mentoria: 0, hub: 0, experience: 0 };

    for (const c of anuncios) {
      const plataforma = detectarPlataforma(c.campaign_name);
      const leads = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto = parseFloat(c.spend || 0);
      const cpl = leads > 0 ? gasto / leads : 0;
      const thumbnail_url = c.creative?.thumbnail_url || null;

      const registro = {
        data: dataStr,
        campanha_nome: c.campaign_name,
        conjunto_nome: c.adset_name,
        anuncio_nome: c.ad_name,
        impressoes: parseInt(c.impressions || 0),
        cliques: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        gasto,
        thumbnail_url
      };

      if (plataforma === 'mentoria') {
        await supabase.from('campanhas_mentoria').insert({ ...registro, leads, cpl });
        salvos.mentoria++;
      } else if (plataforma === 'hub') {
        await supabase.from('campanhas_hub').insert({ ...registro, leads, cpl });
        salvos.hub++;
      } else if (plataforma === 'experience') {
        const custo_por_compra = vendas > 0 ? gasto / vendas : 0;
        await supabase.from('campanhas_experience').insert({ 
          ...registro, vendas, custo_por_compra 
        });
        salvos.experience++;
      }
    }

    return res.status(200).json({ 
      success: true, 
      total: anuncios.length,
      salvos,
      data: dataStr 
    });
  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
