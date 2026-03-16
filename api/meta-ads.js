import { getCampanhas, detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const dataStr = ontem.toISOString().split('T')[0];

    const campanhas = await getCampanhas(dataStr, dataStr);

    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      const leads = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto = parseFloat(c.spend || 0);
      const leads_total = leads || 1;
      const cpl = gasto / leads_total;

      const registro = {
        data: dataStr,
        campanha_nome: c.campaign_name,
        conjunto_nome: c.adset_name,
        anuncio_nome: c.ad_name,
        impressoes: parseInt(c.impressions || 0),
        cliques: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        gasto
      };

      if (plataforma === 'mentoria') {
        await supabase.from('campanhas_mentoria').insert({ ...registro, leads, cpl });
      } else if (plataforma === 'hub') {
        await supabase.from('campanhas_hub').insert({ ...registro, leads, cpl });
      } else if (plataforma === 'experience') {
        await supabase.from('campanhas_experience').insert({ 
          ...registro, vendas, custo_por_compra: gasto / (vendas || 1) 
        });
      }
    }

    return res.status(200).json({ success: true, total: campanhas.length, data: dataStr });
  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
