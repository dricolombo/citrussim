// firebase-ranking.js — CítrusSim
// Conecta o ranking-publico.html ao Firebase em tempo real

const DB_URL = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

const EQUIPES_BASE = [
  { id:'c1', nome:'Horizonte Verde',     caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c2', nome:'Sol do Campo',         caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c3', nome:'Vale Citrícola',       caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c4', nome:'Jales Agroindustrial', caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c5', nome:'Terra Frutífera',      caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c6', nome:'Noroeste Paulista',    caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c7', nome:'Citrus Premium',       caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
  { id:'c8', nome:'Campo Aberto',         caixa:50000, rep:50, ms:null, vol:null, idc:null, margem:null, status:'pendente' },
];

const CORES = ['#f7c844','#4a9463','#e8710a','#2563eb','#7c3aed','#0891b2','#dc2626','#059669'];

// ── LER DADOS DO FIREBASE ──
async function lerRanking() {
  try {
    const res = await fetch(`${DB_URL}/torneio/ranking.json`);
    return await res.json();
  } catch(e) { return null; }
}

async function lerStatus() {
  try {
    const res = await fetch(`${DB_URL}/torneio/status.json`);
    return await res.json();
  } catch(e) { return null; }
}

async function lerResultados(rodada) {
  try {
    const res = await fetch(`${DB_URL}/torneio/resultados/r${rodada}.json`);
    return await res.json();
  } catch(e) { return null; }
}

async function lerGazeta(rodada) {
  try {
    const res = await fetch(`${DB_URL}/torneio/gazeta/r${rodada}.json`);
    return await res.json();
  } catch(e) { return null; }
}

// ── MONTAR DADOS DAS EQUIPES ──
async function montarDadosEquipes() {
  const [ranking, status, resultados] = await Promise.all([
    lerRanking(),
    lerStatus(),
    lerResultados(1)
  ]);

  return EQUIPES_BASE.map((eq, i) => {
    const rankDados = ranking && ranking.equipes && ranking.equipes[eq.id];
    const statusDados = status && status[eq.id];
    const resDados = resultados && resultados.resultados && resultados.resultados[eq.id];

    return {
      ...eq,
      idc:    rankDados?.idc    || resDados?.idc    || null,
      caixa:  rankDados?.caixa  || resDados?.caixa  || eq.caixa,
      rep:    rankDados?.rep    || resDados?.rep     || eq.rep,
      ms:     rankDados?.ms     || resDados?.ms      || null,
      vol:    rankDados?.vol    || resDados?.vol     || null,
      margem: rankDados?.margem || resDados?.margem  || null,
      status: statusDados?.status === 'enviado' ? 'ativo' : 'pendente',
    };
  }).sort((a, b) => (b.idc || 0) - (a.idc || 0));
}

// ── RENDERIZAR RANKING ──
function renderizarRanking(equipes) {
  const tbody = document.getElementById('rank-tbody');
  if (!tbody) return;

  tbody.innerHTML = equipes.map((e, i) => {
    const medalhas = ['🥇','🥈','🥉'];
    const medClasses = ['medal-1','medal-2','medal-3'];
    const medHtml = i < 3
      ? `<span class="pos-medal ${medClasses[i]}">${medalhas[i]}</span>`
      : `<span class="pos-medal medal-n">${i+1}</span>`;

    const idcHtml = e.idc
      ? `<span class="idc-val" style="color:${e.idc>=75?'#4a9463':e.idc>=55?'#f59332':'#dc2626'}">${e.idc.toFixed(1)}</span>
         <div class="idc-barra-wrap"><div class="idc-barra" style="width:${e.idc}%;background:${e.idc>=75?'#4a9463':e.idc>=55?'#f59332':'#dc2626'}"></div></div>`
      : `<span style="color:rgba(253,246,232,0.3)">—</span>`;

    const caixaK = (e.caixa/1000).toFixed(0);
    const corCaixa = e.caixa>=40000?'#4a9463':e.caixa>=20000?'#f59332':'#dc2626';
    const corRep   = e.rep>=70?'#f7c844':e.rep>=50?'#f59332':'#dc2626';

    return `<tr${i===0?' class="destaque"':''}>
      <td>${medHtml}</td>
      <td>
        <div class="coop-nome">Cooperativa ${e.nome}</div>
        <div class="coop-detalhe">${e.vol ? e.vol+' cx vendidas' : e.status==='ativo'?'Decisão enviada':'Aguardando decisões'}</div>
      </td>
      <td>${idcHtml}</td>
      <td>
        <div style="font-size:13px;font-weight:600;color:${corCaixa}">R$${caixaK}k</div>
        <div style="width:70px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;">
          <div style="width:${Math.min(100,(e.caixa/80000)*100)}%;height:4px;border-radius:2px;background:${corCaixa}"></div>
        </div>
      </td>
      <td>${e.margem!=null?`<span class="tag ${e.margem>=15?'tag-verde':e.margem>=0?'tag-amarelo':'tag-vermelho'}">${e.margem}%</span>`:'<span style="color:rgba(253,246,232,0.3)">—</span>'}</td>
      <td>
        <div style="font-size:13px;font-weight:600;color:${corRep}">${e.rep}/100</div>
        <div style="width:70px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;">
          <div style="width:${e.rep}%;height:4px;border-radius:2px;background:${corRep}"></div>
        </div>
      </td>
      <td>${e.ms!=null?`<span class="tag tag-azul">${e.ms}%</span>`:'<span style="color:rgba(253,246,232,0.3)">—</span>'}</td>
      <td><span class="tag ${e.status==='ativo'?'tag-verde':'tag-amarelo'}">${e.status==='ativo'?'✅ Enviou':'⏳ Pendente'}</span></td>
    </tr>`;
  }).join('');
}

// ── RENDERIZAR PÓDIO ──
function renderizarPodio(equipes) {
  const top3 = equipes.filter(e => e.idc).slice(0, 3);
  if (top3.length < 3) return; // aguarda dados reais

  const ordem = [top3[1], top3[0], top3[2]]; // 2º, 1º, 3º (visual do pódio)
  const alturas = ['140px','180px','110px'];
  const classes = ['podio-2','podio-1','podio-3'];
  const emojis = ['🥈','👑','🥉'];
  const posicoes = [2, 1, 3];

  const podio = document.querySelector('.podio');
  if (!podio) return;

  podio.innerHTML = ordem.map((e, i) => `
    <div class="podio-item">
      <div class="podio-nome${i===1?' style="font-size:15px;font-weight:700;color:var(--amarelo)"':''}"}>
        Cooperativa<br/>${e.nome}
      </div>
      <div class="podio-plataforma ${classes[i]}" style="height:${alturas[i]}">
        <div class="podio-emoji">${emojis[i]}</div>
        <div class="podio-pos">${posicoes[i]}</div>
        <div class="podio-idc${i===1?' style="font-size:28px"':''}">${e.idc.toFixed(1)}</div>
        <div class="podio-idc-label">IDC</div>
      </div>
    </div>
  `).join('');
}

// ── RENDERIZAR REPUTAÇÃO ──
function renderizarReputacao(equipes) {
  const grid = document.getElementById('rep-grid');
  if (!grid) return;

  const circ = 2 * Math.PI * 27;
  grid.innerHTML = equipes.map((e, i) => {
    const cor = e.rep>=70?'#4a9463':e.rep>=50?'#f59332':'#dc2626';
    const offset = circ - (circ * e.rep / 100);
    return `
      <div class="rep-card">
        <div class="rep-nome">${e.nome}</div>
        <div class="rep-gauge">
          <svg viewBox="0 0 70 70">
            <circle class="rep-track" cx="35" cy="35" r="27"/>
            <circle class="rep-fill" cx="35" cy="35" r="27"
              stroke="${cor}" stroke-dasharray="${circ.toFixed(1)}"
              stroke-dashoffset="${offset.toFixed(1)}"
              transform="rotate(-90 35 35)"/>
          </svg>
          <div class="rep-val" style="color:${cor}">${e.rep}</div>
        </div>
        <span class="tag ${e.rep>=70?'tag-verde':e.rep>=50?'tag-amarelo':'tag-vermelho'}">
          ${e.rep>=70?'⭐ Alta':e.rep>=50?'🟡 Média':'🔴 Baixa'}
        </span>
      </div>`;
  }).join('');
}

// ── RENDERIZAR MARKET SHARE ──
function renderizarMercado(equipes) {
  const msLista = document.getElementById('ms-lista');
  const volLista = document.getElementById('vol-lista');
  if (!msLista || !volLista) return;

  msLista.innerHTML = equipes.map((e, i) => `
    <div class="ms-item">
      <div class="ms-cor" style="background:${CORES[i]}"></div>
      <div class="ms-nome">${e.nome}</div>
      <div class="ms-barra-wrap"><div class="ms-barra" style="width:${e.ms||0}%;background:${CORES[i]}"></div></div>
      <div class="ms-pct">${e.ms ? e.ms+'%' : '—'}</div>
    </div>`).join('');

  const maxVol = Math.max(...equipes.map(e => e.vol || 0), 1);
  volLista.innerHTML = equipes.map((e, i) => `
    <div class="ms-item">
      <div class="ms-cor" style="background:${CORES[i]}"></div>
      <div class="ms-nome">${e.nome}</div>
      <div class="ms-barra-wrap"><div class="ms-barra" style="width:${e.vol?Math.round((e.vol/maxVol)*100):0}%;background:${CORES[i]}"></div></div>
      <div class="ms-pct">${e.vol ? e.vol+'cx' : '—'}</div>
    </div>`).join('');
}

// ── ATUALIZAR GAZETA NO PAINEL DE MERCADO ──
async function atualizarDadosMercado() {
  const gazeta = await lerGazeta(1);
  if (!gazeta) return;

  const campos = {
    'prev-laranja': gazeta.precoLaranja ? 'R$ '+gazeta.precoLaranja : null,
    'prev-suco':    gazeta.precoSuco    ? 'R$ '+gazeta.precoSuco    : null,
    'prev-mercado': gazeta.mercado      ? gazeta.mercado+' cx'       : null,
    'prev-cambio':  gazeta.cambio       ? 'R$ '+gazeta.cambio        : null,
    'prev-juros':   gazeta.juros        ? gazeta.juros+'%'           : null,
  };

  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  });

  // Manchete
  const manchete = document.querySelector('.gazeta-manchete-prev');
  if (manchete && gazeta.manchete) manchete.textContent = gazeta.manchete;
}

// ── ATUALIZAR TUDO ──
async function atualizarRankingCompleto() {
  const equipes = await montarDadosEquipes();

  renderizarRanking(equipes);
  renderizarPodio(equipes);
  renderizarReputacao(equipes);
  renderizarMercado(equipes);
  atualizarDadosMercado();

  // Atualizar rodada no badge
  const badge = document.querySelector('.rodada-badge');
  if (badge) badge.textContent = '🌾 Rodada 1 — Em andamento';

  // Contador de enviadas
  const enviadas = equipes.filter(e => e.status === 'ativo').length;
  const rodapeInfo = document.querySelector('.rodape-atualizado');
  if (rodapeInfo) {
    rodapeInfo.innerHTML = `<span class="pulso"></span>${enviadas}/8 equipes enviaram · Ao vivo`;
  }
}

// ── POLLING ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    atualizarRankingCompleto();
    setInterval(atualizarRankingCompleto, 10000);
  });
} else {
  atualizarRankingCompleto();
  setInterval(atualizarRankingCompleto, 10000);
}
