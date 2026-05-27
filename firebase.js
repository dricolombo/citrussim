// firebase.js — CítrusSim · Integração com Firebase Realtime Database
// Banco: https://citrussim-fatec-default-rtdb.firebaseio.com

const DB_URL = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

// ══════════════════════════════════════════
// FUNÇÕES BASE — leitura e escrita no banco
// ══════════════════════════════════════════

async function dbEscrever(caminho, dados) {
  try {
    const res = await fetch(`${DB_URL}/${caminho}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    return await res.json();
  } catch(e) {
    console.error('Erro ao escrever no banco:', e);
    return null;
  }
}

async function dbLer(caminho) {
  try {
    const res = await fetch(`${DB_URL}/${caminho}.json`);
    return await res.json();
  } catch(e) {
    console.error('Erro ao ler do banco:', e);
    return null;
  }
}

async function dbAtualizar(caminho, dados) {
  try {
    const res = await fetch(`${DB_URL}/${caminho}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    return await res.json();
  } catch(e) {
    console.error('Erro ao atualizar banco:', e);
    return null;
  }
}

// ══════════════════════════════════════════
// EQUIPES — salvar e ler decisões
// ══════════════════════════════════════════

async function salvarDecisoesNoBanco(coopId, rodada, decisoes) {
  const caminho = `torneio/rodadas/r${rodada}/decisoes/${coopId}`;
  const dados = {
    ...decisoes,
    coopId,
    rodada,
    timestamp: new Date().toISOString(),
    status: 'enviado'
  };
  const resultado = await dbEscrever(caminho, dados);
  if (resultado) {
    // Atualiza status no painel de controle
    await dbAtualizar(`torneio/status/${coopId}`, {
      ultimaDecisao: new Date().toISOString(),
      rodadaAtual: rodada,
      status: 'enviado'
    });
  }
  return resultado;
}

async function lerDecisoesRodada(rodada) {
  return await dbLer(`torneio/rodadas/r${rodada}/decisoes`);
}

async function lerStatusEquipes() {
  return await dbLer('torneio/status');
}

// ══════════════════════════════════════════
// GAZETA — publicar e ler
// ══════════════════════════════════════════

async function publicarGazeta(rodada, dados) {
  return await dbEscrever(`torneio/gazeta/r${rodada}`, {
    ...dados,
    publicadaEm: new Date().toISOString(),
    rodada
  });
}

async function lerGazeta(rodada) {
  return await dbLer(`torneio/gazeta/r${rodada}`);
}

// ══════════════════════════════════════════
// RANKING — publicar resultados
// ══════════════════════════════════════════

async function publicarResultados(rodada, resultados) {
  return await dbEscrever(`torneio/resultados/r${rodada}`, {
    resultados,
    processadoEm: new Date().toISOString()
  });
}

async function lerResultados(rodada) {
  return await dbLer(`torneio/resultados/r${rodada}`);
}

async function lerRanking() {
  return await dbLer('torneio/ranking');
}

async function publicarRanking(ranking) {
  return await dbEscrever('torneio/ranking', {
    equipes: ranking,
    atualizadoEm: new Date().toISOString()
  });
}

// ══════════════════════════════════════════
// CONFIGURAÇÃO DO TORNEIO
// ══════════════════════════════════════════

async function lerConfiguracaoTorneio() {
  return await dbLer('torneio/config');
}

async function salvarConfiguracaoTorneio(config) {
  return await dbEscrever('torneio/config', config);
}

// ══════════════════════════════════════════
// POLLING — atualização em tempo real
// ══════════════════════════════════════════

function iniciarPolling(caminho, callback, intervaloMs = 5000) {
  async function verificar() {
    const dados = await dbLer(caminho);
    if (dados) callback(dados);
  }
  verificar();
  return setInterval(verificar, intervaloMs);
}

function pararPolling(intervalId) {
  clearInterval(intervalId);
}

// ══════════════════════════════════════════
// INICIALIZAR TORNEIO (mediador)
// ══════════════════════════════════════════

async function inicializarTorneio() {
  const config = {
    nome: 'CítrusSim 2026',
    rodadaAtual: 1,
    totalRodadas: 6,
    status: 'aberto',
    equipes: {
      c1: { nome: 'Cooperativa Horizonte Verde',     caixa: 50000, rep: 50, func: 6 },
      c2: { nome: 'Cooperativa Sol do Campo',         caixa: 50000, rep: 50, func: 6 },
      c3: { nome: 'Cooperativa Vale Citrícola',       caixa: 50000, rep: 50, func: 6 },
      c4: { nome: 'Cooperativa Jales Agroindustrial', caixa: 50000, rep: 50, func: 6 },
      c5: { nome: 'Cooperativa Terra Frutífera',      caixa: 50000, rep: 50, func: 6 },
      c6: { nome: 'Cooperativa Noroeste Paulista',    caixa: 50000, rep: 50, func: 6 },
      c7: { nome: 'Cooperativa Citrus Premium',       caixa: 50000, rep: 50, func: 6 },
      c8: { nome: 'Cooperativa Campo Aberto',         caixa: 50000, rep: 50, func: 6 },
    },
    parametros: {
      precoLaranja: 18,
      mercadoTotal: 6400,
      precoRefSuco: 42,
      cambio: 5.80,
      juros: 2.0
    },
    criadoEm: new Date().toISOString()
  };
  return await salvarConfiguracaoTorneio(config);
}
