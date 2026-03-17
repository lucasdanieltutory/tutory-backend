const META_TOKEN = process.env.META_TOKEN;
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT;
const BASE_URL = 'https://graph.facebook.com/v19.0';

export async function getCampanhas(dataInicio, dataFim) {
  const fields = 'campaign_name,impressions,clicks,ctr,cpc,spend,actions';
  const url = `${BASE_URL}/${META_AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${dataInicio}","until":"${dataFim}"}&level=campaign&time_increment=1&access_token=${META_TOKEN}&limit=500`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const campanhas = data.data || [];
  console.log(`[meta.js] Total campanhas retornadas: ${campanhas.length}`);

  return campanhas;
}

export function detectarPlataforma(campanhaNome) {
  const nome = (campanhaNome || '');

  // Só processa campanhas com padrão estruturado [...]
  // Ignora posts impulsionados, campanhas antigas, etc.
  if (!nome.startsWith('[')) {
    console.log(`[meta.js] Ignorando campanha fora do padrão: "${nome}"`);
    return 'desconhecido';
  }

  const lower = nome.toLowerCase();

  if (lower.includes('mentoria') || lower.includes('gms')) return 'mentoria';
  if (lower.includes('hub'))                                return 'hub';
  if (lower.includes('experience') || lower.includes('exp')) return 'experience';

  console.log(`[meta.js] Campanha no padrão mas não classificada: "${nome}"`);
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
