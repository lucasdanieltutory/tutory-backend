import { detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const TOKEN      = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE       = 'https://graph.facebook.com/v19.0';

    const mes  = req.body?.mes  || req.query?.mes;
    const modo = req.body?.modo || req.query?.modo || 'completo'; // completo ou campanhas

    let desde, ate;
    if (mes) {
      const m = parseInt(mes);
      desde = `2026-${String(m).padStart(2,'0')}-01`;
      const ultimoDia = new Date(2026, m, 0).getDate();
      ate = `2026-${String(m).padStart(2,'0')}-${ultimoDia}`;
      const hoje = new Date();
      if (m === hoje.getMonth() + 1) {
        const ontem = new Date(hoje); ontem.setDate(ontem.getDate()-1);
        ate = ontem.toISOString().split('T')[0];
      }
    } else {
      const ontem = new Date(Date.now()-86400000);
      desde = ontem.toISOString().split('T')[0];
      ate   = desde;
    }

    const fields = 'campaign_name,impressions,clicks,ctr,cpc,spend,actions,date_start';
    const url = `${BASE}/${AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${desde}","until":"${ate}"}&level=campaign&time_increment=1&access_token=${TOKEN}&limit=500`;

    let campanhas = [];
    let nextUrl = url;
    while (nextUrl) {
      const r = await fetch(nextUrl);
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      campanhas = campanhas.concat(d.data || []);
      nextUrl = d.paging?.next || null;
    }

    let salvos = { mentoria:0, hub:0, experience:0, ignorados:0 };

    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      if (plataforma === 'desconhecido') { salvos.ignorados++; continue; }
      const leads = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto = parseFloat(c.spend || 0);
      const reg = {
        data: c.date_start || desde,
        campanha_nome: c.campaign_name,
        conjunto_nome: null, anuncio_nome: null,
        impressoes: parseInt(c.impressions || 0),
        cliques: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        gasto
      };
      if (plataforma === 'mentoria') {
        await supabase.from('campanhas_mentoria').upsert({ ...reg, leads, cpl: leads>0?gasto/leads:0 }, { onConflict: 'data,campanha_nome' });
        salvos.mentoria++;
      } else if (plataforma === 'hub') {
        await supabase.from('campanhas_hub').upsert({ ...reg, leads, cpl: leads>0?gasto/leads:0 }, { onConflict: 'data,campanha_nome' });
        salvos.hub++;
      } else if (plataforma === 'experience') {
        await supabase.from('campanhas_experience').upsert({ ...reg, vendas, custo_por_compra: vendas>0?gasto/vendas:0 }, { onConflict: 'data,campanha_nome' });
        salvos.experience++;
      }
    }

    // Busca anúncios só se não for histórico (modo=completo e sem mes)
    if (!mes) {
      const fieldsAd = 'campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions,date_start';
      const urlAd = `${BASE}/${AD_ACCOUNT}/insights?fields=${fieldsAd}&time_range={"since":"${desde}","until":"${ate}"}&level=ad&time_increment=1&access_token=${TOKEN}&limit=500`;
      let anuncios = [];
      nextUrl = urlAd;
      while (nextUrl) {
        const r = await fetch(nextUrl);
        const d = await r.json();
        if (d.error) throw new Error(d.error.message);
        anuncios = anuncios.concat(d.data || []);
        nextUrl = d.paging?.next || null;
      }
      for (const a of anuncios) {
        const plataforma = detectarPlataforma(a.campaign_name);
        if (plataforma === 'desconhecido') continue;
        const leads = extrairLeads(a.actions);
        const vendas = extrairVendas(a.actions);
        const gasto = parseFloat(a.spend || 0);
        const reg = { data: a.date_start||desde, campanha_nome: a.campaign_name, conjunto_nome: a.adset_name, anuncio_nome: a.ad_name, impressoes: parseInt(a.impressions||0), cliques: parseInt(a.clicks||0), ctr: parseFloat(a.ctr||0), cpc: parseFloat(a.cpc||0), gasto };
        if (plataforma === 'mentoria') await supabase.from('anuncios_mentoria').upsert({ ...reg, leads, cpl: leads>0?gasto/leads:0 }, { onConflict: 'data,anuncio_nome' });
        else if (plataforma === 'hub') await supabase.from('anuncios_hub').upsert({ ...reg, leads, cpl: leads>0?gasto/leads:0 }, { onConflict: 'data,anuncio_nome' });
        else if (plataforma === 'experience') await supabase.from('anuncios_experience').upsert({ ...reg, vendas, custo_por_compra: vendas>0?gasto/vendas:0 }, { onConflict: 'data,anuncio_nome' });
      }
    }

    return res.status(200).json({ success: true, periodo: `${desde} → ${ate}`, total: campanhas.length, salvos });

  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
