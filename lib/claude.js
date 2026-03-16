import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export async function scoreLead(lead) {
  const prompt = `Você é um especialista em qualificação de leads para a Tutory, empresa de mentoria para concurseiros e profissionais.

Analise este lead e retorne um JSON com score de 0-10:

Lead:
- Nome: ${lead.contact_name}
- Cargo: ${lead.cargo || lead.cargo_lp || 'não informado'}
- Faturamento: ${lead.faturamento || 'não informado'}
- Momento: ${lead.momento || 'não informado'}
- Canal: ${lead.canal || 'não informado'}
- Tag: ${lead.contact_tag || 'não informado'}

Critérios de pontuação:
MOMENTO: "frustrado/tentei tudo" = +4, "sei que preciso resolver" = +3, "sou mentor" = +3, "quero sair das planilhas" = +2, "estou criando" = +2, "só quero saber mais" = -2, "sou aluno" = -3
FATURAMENTO: R$50k+ = +4, R$15k-R$49k = +3, R$8k-R$14k = +3, R$5k-R$7k = +2, R$1k-R$3k = +1, R$0-R$999 = 0
CARGO: Delegado/Auditor/Magistrado = +3, Policial/Procurador/Diplomata = +2, Médico/Professor = +2, Outro = +1
CANAL: Landing Page = +2, outros = +1
TESTE: nome contém TESTE/DAN/SJS = -10

Classificação: 8-10 = Quente, 5-7 = Morno, 0-4 = Frio

Retorne APENAS este JSON sem markdown:
{"score": 0, "classificacao": "Frio", "resumo": "texto", "proxima_acao": "texto"}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.content[0].text);
}

export async function gerarDiagnostico(dados, plataforma) {
  const prompt = `Você é analista de marketing da Tutory. Analise os dados de hoje e gere um diagnóstico conciso em português.

Plataforma: ${plataforma}
Dados: ${JSON.stringify(dados)}

Retorne APENAS este JSON sem markdown:
{"resumo": "2-3 frases sobre performance geral", "alertas": "pontos de atenção ou 'Nenhum alerta'", "recomendacoes": "ações recomendadas"}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.content[0].text);
}
