import { detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const desde = req.query?.desde || req.query?.data || ontem;
    const ate   = req.query?.ate   || req.query?.data || ontem;

    const TOKEN      = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE       = 'https://graph.facebook.com/v19.0';

    const fields = [
      'campaign_name',
      'impressions',
      'clicks',
      'ctr',
      'cpc',
      'spend',
      'actions',
      'date_start'
    ].join(',');

    const url = `${BASE}/${AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${desde}","until":"${ate}"}&level=campaign&time_increment=1&access_token=${TOKEN}&limit=500`;

    let campanhas = [];
    let nextUrl = url;
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      campanhas = campanhas.concat(data.data || []);
      nextUrl = data.paging?.next || null;
    }

    let salvos = { mentoria: 0, hub: 0, experience: 0, ignorados: 0 };

    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      if (plataforma === 'desconhecido') { salvos.ignorados++; continue; }

      const leads  = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto  = parseFloat(c.spend || 0);
      const cpl    = leads > 0 ? gasto / leads : 0;
      const dataRegistro = c.date_start || desde;

      const registro = {
        data:          dataRegistro,
        campanha_nome: c.campaign_name,
        conjunto_nome: null,
        anuncio_nome:  null,
        impressoes:    parseInt(c.impressions || 0),
        cliques:       parseInt(c.clicks || 0),
        ctr:           parseFloat(c.ctr || 0),
        cpc:           parseFloat(c.cpc || 0),
        gasto
      };

      if (plataforma === 'mentoria') {
        await supabase.from('campanhas_mentoria')
          .upsert({ ...registro, leads, cpl },
                  { onConflict: 'data,campanha_nome' });
        salvos.mentoria++;
      } else if (plataforma === 'hub') {
        await supabase.from('campanhas_hub')
          .upsert({ ...registro, leads, cpl },
                  { onConflict: 'data,campanha_nome' });
        salvos.hub++;
      } else if (plataforma === 'experience') {
        const custo_por_compra = vendas > 0 ? gasto / vendas : 0;
        await supabase.from('campanhas_experience')
          .upsert({ ...registro, vendas, custo_por_compra },
                  { onConflict: 'data,campanha_nome' });
        salvos.experience++;
      }
    }

    return res.status(200).json({
      success: true,
      periodo: `${desde} → ${ate}`,
      total: campanhas.length,
      salvos
    });

  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
