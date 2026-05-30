// firebase-mapa.js — CítrusSim
// Atualiza o mapa de calor do mediador com dados reais do Firebase
// v2 — caminhos corrigidos, preserva status de decisão, sem nomes duplicados

const DB_MAPA = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

// Ordem fixa das cooperativas (exibição padrão antes do primeiro processamento)
const EQUIPES_ORDEM = [
  { id:'c1', nome:'Horizonte Verde' },
  { id:'c2', nome:'Sol do Campo' },
  { id:'c3', nome:'Vale Citrícola' },
  { id:'c4', nome:'Jales Agroindustrial' },
  { id:'c5', nome:'Terra Frutífera' },
  { id:'c6', nome:'Noroeste Paulista' },
  { id:'c7', nome:'Citrus Premium' },
  { id:'c8', nome:'Campo Aberto' },
];

// ── LER DADOS DO FIREBASE (caminhos corretos) ──────────────────────────────

async function lerResultadosRodada(rodada) {
  // Salvo pelo processar-rodada.js em: torneio/resultados/r{n}/resultados/{cId}
  try {
    const res = await fetch(`${DB_MAPA}/torneio/resultados/r${rodada}/resultados.json`);
    const data = await res.json();
    return data; // objeto { c1:{...}, c2:{...}, ... }
  } catch(e) { return null; }
}

async function lerRankingFirebase() {
  // Salvo pelo processar-rodada.js em: torneio/ranking/equipes/{cId}
  try {
    const res = await fetch(`${DB_MAPA}/torneio/ranking/equipes.json`);
    const data = await res.json();
    return data; // objeto { c1:{...}, c2:{...}, ... }
  } catch(e) { return null; }
}

async function lerRodadaAtual() {
  try {
    const res = await fetch(`${DB_MAPA}/torneio/config/rodadaAtual.json`);
    const data = await res.json();
    return typeof data === 'number' ? data - 1 : 1; // rodadaAtual = próxima, então -1 = última processada
  } catch(e) { return 1; }
}

// ── CORES DO MAPA DE CALOR ─────────────────────────────────────────────────

function corIDC(v) {
  if (v === null || v === undefined) return 'c-cinza';
  if (v >= 70) return 'c-verde-forte';
  if (v >= 50) return 'c-verde-medio';
  if (v >= 30) return 'c-amarelo';
  return 'c-vermelho';
}

function corCaixa(v) {
  if (v === null || v === undefined) return 'c-cinza';
  if (v >= 40000) return 'c-verde-forte';
  if (v >= 20000) return 'c-verde-medio';
  if (v >= 0)     return 'c-amarelo';
  return 'c-vermelho';
}

function corRep(v) {
  if (v === null || v === undefined) return 'c-cinza';
  if (v >= 70) return 'c-verde-forte';
  if (v >= 50) return 'c-verde-medio';
  if (v >= 30) return 'c-amarelo';
  return 'c-vermelho';
}

function corMargem(v) {
  if (v === null || v === undefined) return 'c-cinza';
  if (v >= 15) return 'c-verde-forte';
  if (v >= 0)  return 'c-verde-medio';
  return 'c-vermelho';
}

// ── ATUALIZAR MAPA DE CALOR ────────────────────────────────────────────────

async function atualizarMapaComFirebase() {
  const rodadaProcessada = await lerRodadaAtual();

  // Lê resultados da última rodada processada E o ranking consolidado
  const [resultados, rankingEquipes] = await Promise.all([
    lerResultadosRodada(rodadaProcessada),
    lerRankingFirebase()
  ]);

  // Se não há nada processado ainda, sai sem mexer na tabela
  if (!resultados && !rankingEquipes) {
    console.log('🗺️ Sem dados processados ainda — mapa estático mantido.');
    return;
  }

  // Combinar: preferência para resultados detalhados, fallback para ranking
  const dadosPorId = {};
  EQUIPES_ORDEM.forEach(e => {
    const r = (resultados && resultados[e.id]) || (rankingEquipes && rankingEquipes[e.id]) || null;
    dadosPorId[e.id] = r;
  });

  // Ordenar por IDC (quem tem IDC vem primeiro, quem não tem fica no final)
  const ordenados = [...EQUIPES_ORDEM].sort((a, b) => {
    const idcA = dadosPorId[a.id]?.idc || 0;
    const idcB = dadosPorId[b.id]?.idc || 0;
    return idcB - idcA;
  });

  // Atualizar cada linha da tabela individualmente (preserva status de decisão)
  const tbody = document.getElementById('mapa-tbody');
  if (!tbody) {
    console.warn('🗺️ mapa-tbody não encontrado.');
    return;
  }

  const linhas = tbody.querySelectorAll('tr');

  ordenados.forEach((equipe, i) => {
    const dados = dadosPorId[equipe.id];
    const linha = linhas[i];
    if (!linha) return;

    const idc    = dados?.idc    ?? null;
    const caixa  = dados?.caixa  ?? null;
    const rep    = dados?.rep    ?? null;
    const ms     = dados?.ms     ?? null;
    const margem = dados?.margem ?? null;
    const func   = dados?.func   ?? null;
    const pd     = dados?.pd     ?? null;

    // Preserva a célula de status (última coluna) — gerenciada pelo firebase-mediador.js
    const celulas = linha.querySelectorAll('td');
    const totalCols = celulas.length;

    // Atualiza apenas as colunas de dados (deixa a última — status — intacta)
    if (celulas[0]) celulas[0].textContent = `${i+1}. ${equipe.nome}`;

    if (celulas[1]) celulas[1].innerHTML =
      `<div class="celula ${corIDC(idc)}">${idc !== null ? idc.toFixed(1) : '—'}</div>`;

    if (celulas[2]) celulas[2].innerHTML =
      `<div class="celula ${corCaixa(caixa)}">${
        caixa !== null ? 'R$' + (caixa / 1000).toFixed(0) + 'k' : '—'
      }</div>`;

    if (celulas[3]) celulas[3].innerHTML =
      `<div class="celula ${corRep(rep)}">${rep !== null ? rep + '/100' : '—'}</div>`;

    if (celulas[4]) celulas[4].innerHTML =
      `<div class="celula ${ms !== null ? 'c-verde-medio' : 'c-cinza'}">${ms !== null ? ms + '%' : '—'}</div>`;

    if (celulas[5]) celulas[5].innerHTML =
      `<div class="celula ${corMargem(margem)}">${margem !== null ? margem.toFixed(1) + '%' : '—'}</div>`;

    if (celulas[6]) celulas[6].innerHTML =
      `<div class="celula c-verde-medio">${func !== null ? func + ' func.' : '6 func.'}</div>`;

    if (celulas[7]) celulas[7].innerHTML =
      `<div class="celula ${pd && parseFloat(pd) > 0 ? 'c-verde-forte' : 'c-cinza'}">${
        pd && parseFloat(pd) > 0 ? '1 ativa' : '—'
      }</div>`;

    // celulas[8] = status de decisão → NÃO mexemos aqui
  });

  // Atualizar card de Líder (se existir no painel)
  const lider = ordenados.find(e => dadosPorId[e.id]?.idc);
  if (lider) {
    const dadosLider = dadosPorId[lider.id];
    document.querySelectorAll('.resumo-card').forEach(card => {
      const label = card.querySelector('.resumo-label');
      if (label && label.textContent.includes('Líder')) {
        const valor = card.querySelector('.resumo-valor');
        const det   = card.querySelector('.resumo-detalhe');
        if (valor) { valor.textContent = lider.nome; valor.style.fontSize = '14px'; }
        if (det)   det.textContent = 'IDC: ' + dadosLider.idc.toFixed(1) + ' pts';
      }
    });
  }

  console.log(`🗺️ Mapa de calor atualizado — R${rodadaProcessada} — ${new Date().toLocaleTimeString('pt-BR')}`);
}

// ── ATUALIZAR RANKING DO MEDIADOR ──────────────────────────────────────────

async function atualizarRankingMediador() {
  const rankingEquipes = await lerRankingFirebase();
  if (!rankingEquipes) return;

  const tbody = document.getElementById('ranking-tbody');
  if (!tbody) return;

  const equipes = Object.entries(rankingEquipes)
    .map(([id, dados]) => ({ id, ...dados }))
    .sort((a, b) => (b.idc || 0) - (a.idc || 0));

  const posClasses = ['pos-1', 'pos-2', 'pos-3'];

  tbody.innerHTML = equipes.map((e, i) => `
    <tr>
      <td><span class="rank-pos ${posClasses[i] || 'pos-n'}">${i + 1}</span></td>
      <td><strong>${e.nome}</strong></td>
      <td>
        ${e.idc
          ? `<strong>${e.idc.toFixed(1)}</strong>
             <div class="barra-idc-wrap"><div class="barra-idc" style="width:${Math.min(100, e.idc)}%"></div></div>`
          : '<span style="color:#aaa">—</span>'}
      </td>
      <td>${e.margem !== undefined ? e.margem.toFixed(1) + '%' : '—'}</td>
      <td>
        <div class="celula ${e.caixa >= 30000 ? 'c-verde-forte' : e.caixa >= 0 ? 'c-amarelo' : 'c-vermelho'}"
             style="min-width:50px;font-size:11px;">
          R$${e.caixa !== undefined ? (e.caixa / 1000).toFixed(0) : '50'}k
        </div>
      </td>
      <td>${e.rep !== undefined ? e.rep + '/100' : '50/100'}</td>
      <td>—</td>
      <td>${e.pd && parseFloat(e.pd) > 0 ? '✅' : '—'}</td>
    </tr>
  `).join('');

  console.log(`🏆 Ranking do mediador atualizado — ${new Date().toLocaleTimeString('pt-BR')}`);
}

// ── POLLING — atualiza a cada 15 segundos ─────────────────────────────────

async function atualizarTudoMapa() {
  await Promise.all([
    atualizarMapaComFirebase(),
    atualizarRankingMediador()
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    atualizarTudoMapa();
    setInterval(atualizarTudoMapa, 15000);
  });
} else {
  atualizarTudoMapa();
  setInterval(atualizarTudoMapa, 15000);
}
