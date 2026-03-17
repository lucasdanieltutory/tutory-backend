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

    // ── 1. Busca nível CAMPANHA (investimento correto) ──────────────────
    const fieldsCamp = 'campaign_name,impressions,clicks,ctr,cpc,spend,actions,date_start';
    const urlCamp = `${BASE}/${AD_ACCOUNT}/insights?fields=${fieldsCamp}&time_range={"since":"${desde}","until":"${ate}"}&level=campaign&time_increment=1&access_token=${TOKEN}&limit=500`;

    let campanhas = [];
    let nextUrl = urlCamp;
    while (nextUrl) {
      const r = await fetch(nextUrl);
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      campanhas = campanhas.concat(d.data || []);
      nextUrl = d.paging?.next || null;
    }

    // ── 2. Busca nível ANÚNCIO (para tabela de criativos) ───────────────
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

    let salvos = { campanhas: { mentoria:0, hub:0, experience:0 }, anuncios: { mentoria:0, hub:0, experience:0 }, ignorados: 0 };

    // ── Salva campanhas ─────────────────────────────────────────────────
    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      if (plataforma === 'desconhecido') { salvos.ignorados++; continue; }

      const leads  = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto  = parseFloat(c.spend || 0);
      const cpl    = leads > 0 ? gasto / leads : 0;
      const dataR  = c.date_start || desde;

      const reg = {
        data: dataR, campanha_nome: c.campaign_name,
        conjunto_nome: null, anuncio_nome: null,
        impressoes: parseInt(c.impressions || 0),
        cliques: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        gasto
      };

      if (plataforma === 'mentoria') {
        await supabase.from('campanhas_mentoria').upsert({ ...reg, leads, cpl }, { onConflict: 'data,campanha_nome' });
        salvos.campanhas.mentoria++;
      } else if (plataforma === 'hub') {
        await supabase.from('campanhas_hub').upsert({ ...reg, leads, cpl }, { onConflict: 'data,campanha_nome' });
        salvos.campanhas.hub++;
      } else if (plataforma === 'experience') {
        const custo_por_compra = vendas > 0 ? gasto / vendas : 0;
        await supabase.from('campanhas_experience').upsert({ ...reg, vendas, custo_por_compra }, { onConflict: 'data,campanha_nome' });
        salvos.campanhas.experience++;
      }
    }

    // ── Salva anúncios ──────────────────────────────────────────────────
    for (const a of anuncios) {
      const plataforma = detectarPlataforma(a.campaign_name);
      if (plataforma === 'desconhecido') continue;

      const leads  = extrairLeads(a.actions);
      const vendas = extrairVendas(a.actions);
      const gasto  = parseFloat(a.spend || 0);
      const cpl    = leads > 0 ? gasto / leads : 0;
      const dataR  = a.date_start || desde;

      const reg = {
        data: dataR,
        campanha_nome: a.campaign_name,
        conjunto_nome: a.adset_name,
        anuncio_nome:  a.ad_name,
        impressoes: parseInt(a.impressions || 0),
        cliques: parseInt(a.clicks || 0),
        ctr: parseFloat(a.ctr || 0),
        cpc: parseFloat(a.cpc || 0),
        gasto
      };

      if (plataforma === 'mentoria') {
        await supabase.from('anuncios_mentoria').upsert({ ...reg, leads, cpl }, { onConflict: 'data,anuncio_nome' });
        salvos.anuncios.mentoria++;
      } else if (plataforma === 'hub') {
        await supabase.from('anuncios_hub').upsert({ ...reg, leads, cpl }, { onConflict: 'data,anuncio_nome' });
        salvos.anuncios.hub++;
      } else if (plataforma === 'experience') {
        const custo_por_compra = vendas > 0 ? gasto / vendas : 0;
        await supabase.from('anuncios_experience').upsert({ ...reg, vendas, custo_por_compra }, { onConflict: 'data,anuncio_nome' });
        salvos.anuncios.experience++;
      }
    }

    return res.status(200).json({
      success: true,
      periodo: `${desde} → ${ate}`,
      total_campanhas: campanhas.length,
      total_anuncios: anuncios.length,
      salvos
    });

  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
