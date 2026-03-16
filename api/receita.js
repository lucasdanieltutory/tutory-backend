import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plataforma, data, descricao, valor, tipo, observacao } = req.body;

    const tabelas = {
      mentoria: 'receita_mentoria',
      hub: 'receita_hub',
      experience: 'vendas_experience'
    };

    const tabela = tabelas[plataforma];
    if (!tabela) return res.status(400).json({ error: 'Plataforma inválida' });

    const registro = plataforma === 'experience'
      ? { data, descricao, valor: parseFloat(valor), quantidade: 1, observacao }
      : { data, descricao, valor: parseFloat(valor), tipo: tipo || 'entrada', observacao };

    const { error } = await supabase.from(tabela).insert(registro);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro receita:', err);
    return res.status(500).json({ error: err.message });
  }
}
