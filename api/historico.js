import { detectarPlataforma, extrairLeads, extrairVendas } from '../lib/meta.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const desde = req.query?.desde || '2026-01-01';
    const ate   = req.query?.ate   || '2026-03-16';

    const TOKEN      = process.env.META_TOKEN;
    const AD_ACCOUNT = process.env.META_AD_ACCOUNT;
    const BASE       = 'https://graph.facebook.com/v19.0';

    // Gera array de datas entre desde e ate
    const datas = [];
    const d = new Date(desde);
    const fim = new Date(ate);
    while (d <= fim) {
      datas.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    let totalSalvos = { campanhas: 0, anuncios: 0, ignorados: 0 };
    let erros = [];

    // Processa em lotes de 7 dias para evitar timeout
    const lote = req.query?.lote ? parseInt(req.query.lote) : 0;
    const tamLote = 7;
    const inicio = lote * tamLote;
    const fim2 = Math.min(inicio + tamLote, datas.length);
    const datasLote = datas.slice(inicio, fim2);

    if (datasLote.length === 0) {
      return res.status(200).json({ success: true, mensagem: 'Todos os lotes processados!', total: totalSalvos });
    }

    const dataIni = datasLote[0];
    const dataFim = datasLote[datasLote.length - 1];

    // Busca campanhas
    const fieldsCamp = 'campaign_name,impressions,clicks,ctr,cpc,spend,actions,date_start';
    const urlCamp = `${BASE}/${AD_ACCOUNT}/insights?fields=${fieldsCamp}&time_range={"since":"${dataIni}","until":"${dataFim}"}&level=campaign&time_increment=1&access_token=${TOKEN}&limit=500`;

    let campanhas = [];
    let nextUrl = urlCamp;
    while (nextUrl) {
      const r = await fetch(nextUrl);
      const d2 = await r.json();
      if (d2.error) throw new Error(d2.error.message);
      campanhas = campanhas.concat(d2.data || []);
      nextUrl = d2.paging?.next || null;
    }

    // Busca anúncios
    const fieldsAd = 'campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions,date_start';
    const urlAd = `${BASE}/${AD_ACCOUNT}/insights?fields=${fieldsAd}&time_range={"since":"${dataIni}","until":"${dataFim}"}&level=ad&time_increment=1&access_token=${TOKEN}&limit=500`;

    let anuncios = [];
    nextUrl = urlAd;
    while (nextUrl) {
      const r = await fetch(nextUrl);
      const d2 = await r.json();
      if (d2.error) throw new Error(d2.error.message);
      anuncios = anuncios.concat(d2.data || []);
      nextUrl = d2.paging?.next || null;
    }

    // Salva campanhas
    for (const c of campanhas) {
      const plataforma = detectarPlataforma(c.campaign_name);
      if (plataforma === 'desconhecido') { totalSalvos.ignorados++; continue; }
      const leads = extrairLeads(c.actions);
      const vendas = extrairVendas(c.actions);
      const gasto = parseFloat(c.spend || 0);
      const cpl = leads > 0 ? gasto / leads : 0;
      const dataR = c.date_start || dataIni;
      const reg = { data: dataR, campanha_nome: c.campaign_name, conjunto_nome: null, anuncio_nome: null, impressoes: parseInt(c.impressions || 0), cliques: parseInt(c.clicks || 0), ctr: parseFloat(c.ctr || 0), cpc: parseFloat(c.cpc || 0), gasto };
      if (plataforma === 'mentoria') await supabase.from('campanhas_mentoria').upsert({ ...reg, leads, cpl }, { onConflict: 'data,campanha_nome' });
      else if (plataforma === 'hub') await supabase.from('campanhas_hub').upsert({ ...reg, leads, cpl }, { onConflict: 'data,campanha_nome' });
      else if (plataforma === 'experience') await supabase.from('campanhas_experience').upsert({ ...reg, vendas, custo_por_compra: vendas > 0 ? gasto / vendas : 0 }, { onConflict: 'data,campanha_nome' });
      totalSalvos.campanhas++;
    }

    // Salva anúncios
    for (const a of anuncios) {
      const plataforma = detectarPlataforma(a.campaign_name);
      if (plataforma === 'desconhecido') continue;
      const leads = extrairLeads(a.actions);
      const vendas = extrairVendas(a.actions);
      const gasto = parseFloat(a.spend || 0);
      const cpl = leads > 0 ? gasto / leads : 0;
      const dataR = a.date_start || dataIni;
      const reg = { data: dataR, campanha_nome: a.campaign_name, conjunto_nome: a.adset_name, anuncio_nome: a.ad_name, impressoes: parseInt(a.impressions || 0), cliques: parseInt(a.clicks || 0), ctr: parseFloat(a.ctr || 0), cpc: parseFloat(a.cpc || 0), gasto };
      if (plataforma === 'mentoria') await supabase.from('anuncios_mentoria').upsert({ ...reg, leads, cpl }, { onConflict: 'data,anuncio_nome' });
      else if (plataforma === 'hub') await supabase.from('anuncios_hub').upsert({ ...reg, leads, cpl }, { onConflict: 'data,anuncio_nome' });
      else if (plataforma === 'experience') await supabase.from('anuncios_experience').upsert({ ...reg, vendas, custo_por_compra: vendas > 0 ? gasto / vendas : 0 }, { onConflict: 'data,anuncio_nome' });
      totalSalvos.anuncios++;
    }

    const proximoLote = lote + 1;
    const totalLotes = Math.ceil(datas.length / tamLote);
    const temMais = proximoLote < totalLotes;

    return res.status(200).json({
      success: true,
      periodo: `${dataIni} → ${dataFim}`,
      lote: `${lote + 1}/${totalLotes}`,
      salvos: totalSalvos,
      proximo: temMais ? `Acesse: /api/historico?desde=${desde}&ate=${ate}&lote=${proximoLote}` : 'Concluído! Todos os lotes processados.'
    });

  } catch (err) {
    console.error('Erro historico:', err);
    return res.status(500).json({ error: err.message });
  }
}
