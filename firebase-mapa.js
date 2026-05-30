// firebase-mapa.js — CítrusSim
// Atualiza o mapa de calor do mediador com dados reais do Firebase

const DB_MAPA = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

const EQUIPES_ORDEM = [
  { id:'c2', nome:'Sol do Campo' },
  { id:'c3', nome:'Vale Citrícola' },
  { id:'c5', nome:'Terra Frutífera' },
  { id:'c1', nome:'Horizonte Verde' },
  { id:'c4', nome:'Jales Agroindustrial' },
  { id:'c6', nome:'Noroeste Paulista' },
  { id:'c7', nome:'Citrus Premium' },
  { id:'c8', nome:'Campo Aberto' },
];

// ── LER RESULTADOS DO FIREBASE ──
async function lerResultadosFirebase() {
  try {
    const res = await fetch(`${DB_MAPA}/torneio/resultados/r1/resultados.json`);
    return await res.json();
  } catch(e) { return null; }
}

async function lerRankingFirebase() {
  try {
    const res = await fetch(`${DB_MAPA}/torneio/ranking.json`);
    return await res.json();
  } catch(e) { return null; }
}

// ── CORES DO MAPA DE CALOR ──
function corIDC(v) {
  if(!v) return 'c-cinza';
  if(v >= 70) return 'c-verde-forte';
  if(v >= 50) return 'c-verde-medio';
  if(v >= 30) return 'c-amarelo';
  return 'c-vermelho';
}
function corCaixa(v) {
  if(!v && v !== 0) return 'c-cinza';
  if(v >= 40000) return 'c-verde-forte';
  if(v >= 20000) return 'c-verde-medio';
  if(v >= 0)     return 'c-amarelo';
  return 'c-vermelho';
}
function corRep(v) {
  if(!v) return 'c-cinza';
  if(v >= 70) return 'c-verde-forte';
  if(v >= 50) return 'c-verde-medio';
  if(v >= 30) return 'c-amarelo';
  return 'c-vermelho';
}
function corMargem(v) {
  if(v === null || v === undefined) return 'c-cinza';
  if(v >= 15) return 'c-verde-forte';
  if(v >= 0)  return 'c-verde-medio';
  return 'c-vermelho';
}

function fmt(v, pre='', suf='', casas=0) {
  if(v === null || v === undefined) return '—';
  return pre + (casas > 0 ? v.toFixed(casas) : Math.round(v).toLocaleString('pt-BR')) + suf;
}

// ── ATUALIZAR MAPA DE CALOR ──
async function atualizarMapaComFirebase() {
  const [resultados, ranking] = await Promise.all([
    lerResultadosFirebase(),
    lerRankingFirebase()
  ]);

  if (!resultados && !ranking) return;

  // Combinar dados
  const dados = {};
  if (resultados) {
    Object.entries(resultados).forEach(([id, r]) => {
      dados[id] = { ...r };
    });
  }
  if (ranking && ranking.equipes) {
    Object.entries(ranking.equipes).forEach(([id, r]) => {
      dados[id] = { ...(dados[id] || {}), ...r };
    });
  }

  // Ordenar por IDC
  const ordenados = EQUIPES_ORDEM.map(e => ({
    ...e,
    ...(dados[e.id] || {}),
  })).sort((a, b) => (b.idc || 0) - (a.idc || 0));

  // Atualizar tabela
  const tbody = document.getElementById('mapa-tbody');
  if (!tbody) return;

  tbody.innerHTML = ordenados.map((e, i) => {
    const idc    = e.idc    || null;
    const caixa  = e.caixa  !== undefined ? e.caixa  : null;
    const rep    = e.rep    !== undefined ? e.rep    : null;
    const ms     = e.ms     !== undefined ? e.ms     : null;
    const margem = e.margem !== undefined ? e.margem : null;
    const func   = e.func   !== undefined ? e.func   : null;
    const pd     = e.pd     !== undefined ? e.pd     : null;

    // Status da decisão (mantém do sistema existente)
    const statusEl = document.querySelector(`#mapa-tbody tr:nth-child(${i+1}) td:last-child`);
    const statusHTML = statusEl ? statusEl.innerHTML : '<span class="status-pendente">⏳ Pendente</span>';

    return `<tr>
      <td class="col-nome">${i+1}. ${e.nome}</td>
      <td><div class="celula ${corIDC(idc)}">${idc ? idc.toFixed(1) : '—'}</div></td>
      <td><div class="celula ${corCaixa(caixa)}">${caixa !== null ? 'R$'+(caixa/1000).toFixed(0)+'k' : '—'}</div></td>
      <td><div class="celula ${corRep(rep)}">${rep !== null ? rep+'/100' : '—'}</div></td>
      <td><div class="celula ${ms ? 'c-verde-medio' : 'c-cinza'}">${ms ? ms+'%' : '—'}</div></td>
      <td><div class="celula ${corMargem(margem)}">${margem !== null ? margem.toFixed(1)+'%' : '—'}</div></td>
      <td><div class="celula c-verde-medio">${func ? func+' func.' : '6 func.'}</div></td>
      <td><div class="celula ${pd && pd > 0 ? 'c-verde-forte' : 'c-cinza'}">${pd && pd > 0 ? '1 ativa' : '—'}</div></td>
      <td id="status-${e.id}"><span class="status-pendente">⏳ Pendente</span></td>
    </tr>`;
  }).join('');

  // Atualizar cards de resumo
  const enviadas = Object.values(dados).filter(d => d.idc).length;
  const lider = ordenados.find(e => e.idc);

  // Atualizar card de líder
  const cards = document.querySelectorAll('.resumo-card');
  cards.forEach(card => {
    const label = card.querySelector('.resumo-label');
    if (label && label.textContent.includes('Líder')) {
      const valor = card.querySelector('.resumo-valor');
      const det   = card.querySelector('.resumo-detalhe');
      if (valor && lider) valor.style.fontSize = '14px';
      if (valor && lider) valor.textContent = lider.nome;
      if (det   && lider) det.textContent = 'IDC: ' + lider.idc.toFixed(1) + ' pts';
    }
  });

  console.log('🗺️ Mapa de calor atualizado com dados do Firebase');
}

// ── ATUALIZAR RANKING DO MEDIADOR ──
async function atualizarRankingMediador() {
  const ranking = await lerRankingFirebase();
  if (!ranking || !ranking.equipes) return;

  const tbody = document.getElementById('ranking-tbody');
  if (!tbody) return;

  const equipes = Object.values(ranking.equipes)
    .sort((a, b) => (b.idc || 0) - (a.idc || 0));

  const posClasses = ['pos-1','pos-2','pos-3'];

  tbody.innerHTML = equipes.map((e, i) => `
    <tr>
      <td><span class="rank-pos ${posClasses[i] || 'pos-n'}">${i+1}</span></td>
      <td><strong>${'Cooperativa ' + e.nome}</strong></td>
      <td>
        ${e.idc ? `<strong>${e.idc.toFixed(1)}</strong>
        <div class="barra-idc-wrap"><div class="barra-idc" style="width:${e.idc}%"></div></div>`
        : '<span style="color:#aaa">—</span>'}
      </td>
      <td>${e.margem !== undefined ? e.margem.toFixed(1)+'%' : '—'}</td>
      <td><div class="celula ${e.caixa >= 30000 ? 'c-verde-forte' : e.caixa >= 0 ? 'c-amarelo' : 'c-vermelho'}" style="min-width:50px;font-size:11px;">
        R$${e.caixa ? (e.caixa/1000).toFixed(0) : '50'}k
      </div></td>
      <td>${e.rep !== undefined ? e.rep+'/100' : '50/100'}</td>
      <td>—</td>
      <td>${e.pd && e.pd > 0 ? '✅' : '—'}</td>
    </tr>
  `).join('');

  console.log('🏆 Ranking do mediador atualizado');
}

// ── POLLING — atualiza a cada 15 segundos ──
async function atualizarTudoMapa() {
  await atualizarMapaComFirebase();
  await atualizarRankingMediador();
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
