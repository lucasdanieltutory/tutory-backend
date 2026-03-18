import { detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

async function salvar(tabela, registros) {
  if (registros.length === 0) return;
  // Deleta os registros existentes para o período e insere novamente
  const datas = [...new Set(registros.map(r => r.data))];
  for (const data of datas) {
    await supabase.from(tabela).delete().eq('data', data);
  }
  // Insere em lotes de 50
  for (let i = 0; i < registros.length; i += 50) {
    const lote = registros.slice(i, i + 50);
    const { error } = await supabase.from(tabela).insert(lote);
    if (error) console.error(`Erro ao inserir em ${tabela}:`, error.message);
  }
}

export default async function handler(req, res) {
  try {
    const TOKEN      = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE       = 'https://graph.facebook.com/v19.0';

    const mes  = req.body?.mes  || req.query?.mes;
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
      // Suporta desde/ate direto
      const ontem = new Date(Date.now()-86400000);
      desde = req.query?.desde || ontem.toISOString().split('T')[0];
      ate   = req.query?.ate   || req.query?.desde || ontem.toISOString().split('T')[0];
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

    const mn = [], hb = [], ex = [];

    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      if (plataforma === 'desconhecido') continue;
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
      if (plataforma === 'mentoria') mn.push({ ...reg, leads, cpl: leads>0?gasto/leads:0 });
      else if (plataforma === 'hub') hb.push({ ...reg, leads, cpl: leads>0?gasto/leads:0 });
      else if (plataforma === 'experience') ex.push({ ...reg, vendas, custo_por_compra: vendas>0?gasto/vendas:0 });
    }

    await salvar('campanhas_mentoria', mn);
    await salvar('campanhas_hub', hb);
    await salvar('campanhas_experience', ex);

    // Busca anúncios só se for 1 dia (cron diário)
    if (!mes && desde === ate) {
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
      const amn = [], ahb = [], aex = [];
      for (const a of anuncios) {
        const plataforma = detectarPlataforma(a.campaign_name);
        if (plataforma === 'desconhecido') continue;
        const leads = extrairLeads(a.actions);
        const vendas = extrairVendas(a.actions);
        const gasto = parseFloat(a.spend || 0);
        const reg = { data: a.date_start||desde, campanha_nome: a.campaign_name, conjunto_nome: a.adset_name, anuncio_nome: a.ad_name, impressoes: parseInt(a.impressions||0), cliques: parseInt(a.clicks||0), ctr: parseFloat(a.ctr||0), cpc: parseFloat(a.cpc||0), gasto };
        if (plataforma === 'mentoria') amn.push({ ...reg, leads, cpl: leads>0?gasto/leads:0 });
        else if (plataforma === 'hub') ahb.push({ ...reg, leads, cpl: leads>0?gasto/leads:0 });
        else if (plataforma === 'experience') aex.push({ ...reg, vendas, custo_por_compra: vendas>0?gasto/vendas:0 });
      }
      await salvar('anuncios_mentoria', amn);
      await salvar('anuncios_hub', ahb);
      await salvar('anuncios_experience', aex);
    }

    return res.status(200).json({ success: true, periodo: `${desde} → ${ate}`, total: campanhas.length, salvos: { mn: mn.length, hb: hb.length, ex: ex.length } });

  } catch (err) {
    console.error('Erro meta-ads:', err);
    return res.status(500).json({ error: err.message });
  }
}
