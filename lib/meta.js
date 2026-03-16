const META_TOKEN = process.env.META_TOKEN;
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT;
const BASE_URL = 'https://graph.facebook.com/v19.0';

export async function getCampanhas(dataInicio, dataFim) {
  const fields = 'campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions';
  const url = `${BASE_URL}/${META_AD_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${dataInicio}","until":"${dataFim}"}&level=ad&access_token=${META_TOKEN}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

export function detectarPlataforma(campanhaNome) {
  const nome = (campanhaNome || '').toLowerCase();
  if (nome.includes('mentoria') || nome.includes('mentor')) return 'mentoria';
  if (nome.includes('hub')) return 'hub';
  if (nome.includes('experience') || nome.includes('exp')) return 'experience';
  return 'mentoria';
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
