import { gerarDiagnostico } from '../lib/claude.js';
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const dataStr = ontem.toISOString().split('T')[0];

    const plataformas = [
      { nome: 'mentoria', tabela: 'campanhas_mentoria' },
      { nome: 'hub', tabela: 'campanhas_hub' },
      { nome: 'experience', tabela: 'campanhas_experience' }
    ];

    for (const p of plataformas) {
      const { data: campanhas } = await supabase
        .from(p.tabela)
        .select('*')
        .eq('data', dataStr);

      if (!campanhas || campanhas.length === 0) continue;

      const totalGasto = campanhas.reduce((s, c) => s + (c.gasto || 0), 0);
      const totalLeads = campanhas.reduce((s, c) => s + (c.leads || c.vendas || 0), 0);
      const cplMedio = totalLeads > 0 ? totalGasto / totalLeads : 0;
      const ctrMedio = campanhas.reduce((s, c) => s + (c.ctr || 0), 0) / campanhas.length;

      const dados = {
        data: dataStr,
        plataforma: p.nome,
        total_campanhas: campanhas.length,
        total_gasto: totalGasto.toFixed(2),
        total_leads: totalLeads,
        cpl_medio: cplMedio.toFixed(2),
        ctr_medio: ctrMedio.toFixed(2),
        campanhas: campanhas.map(c => ({
          nome: c.campanha_nome,
          gasto: c.gasto,
          leads: c.leads || c.vendas || 0,
          cpl: c.cpl || c.custo_por_compra || 0,
          ctr: c.ctr
        }))
      };

      const diagnostico = await gerarDiagnostico(dados, p.nome);

      await supabase.from('diagnosticos').insert({
        data: dataStr,
        plataforma: p.nome,
        resumo: diagnostico.resumo,
        alertas: diagnostico.alertas,
        recomendacoes: diagnostico.recomendacoes
      });
    }

    return res.status(200).json({ success: true, data: dataStr });
  } catch (err) {
    console.error('Erro diagnostico:', err);
    return res.status(500).json({ error: err.message });
  }
}
