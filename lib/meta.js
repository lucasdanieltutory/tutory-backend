const META_TOKEN = process.env.META_TOKEN;
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT;
const BASE_URL = 'https://graph.facebook.com/v19.0';

export async function getCampanhas(dataInicio, dataFim) {
  // Busca no nível de campanha (não ad) para evitar campos vazios
  const fields = 'campaign_name,impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type';
  const url = `${BASE_URL}/${META_AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${dataInicio}","until":"${dataFim}"}&level=campaign&access_token=${META_TOKEN}&limit=500`;

  console.log('[meta.js] Buscando campanhas:', url.replace(META_TOKEN, 'TOKEN_HIDDEN'));

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const campanhas = data.data || [];
  console.log(`[meta.js] Total campanhas retornadas: ${campanhas.length}`);

  // Log das plataformas detectadas para debug
  const porPlataforma = { mentoria: 0, hub: 0, experience: 0, desconhecido: 0 };
  campanhas.forEach(c => {
    const plat = detectarPlataforma(c.campaign_name);
    porPlataforma[plat] = (porPlataforma[plat] || 0) + 1;
  });
  console.log('[meta.js] Distribuição por plataforma:', porPlataforma);

  return campanhas;
}

export function detectarPlataforma(campanhaNome) {
  const nome = (campanhaNome || '').toLowerCase();

  if (!nome) {
    console.warn('[meta.js] campaign_name vazio ou nulo');
    return 'desconhecido';
  }

  // Mentoria — padrão: [GMS]-...-[MENTORIA]-...
  if (
    nome.includes('mentoria') ||
    nome.includes('mentor') ||
    nome.includes('gms')
  ) return 'mentoria';

  // Hub
  if (
    nome.includes('hub') ||
    nome.includes('tutoryhub')
  ) return 'hub';

  // Experience
  if (
    nome.includes('experience') ||
    nome.includes('exp')
  ) return 'experience';

  console.warn('[meta.js] Campanha não classificada:', campanhaNome);
  return 'desconhecido';
}

export function extrairLeads(acoes) {
  if (!acoes) return 0;
  const leadAction = acoes.find(a => a.action_type === 'lead' || a.action_type === 'complete_registration');
  return leadAction ? parseInt(leadAction.value) : 0;
}

export function extrairVendas(acoes) {
  if (!acoes) return 0;
  const vendaAction = acoes.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
  return vendaAction ? parseInt(vendaAction.value) : 0;
}
