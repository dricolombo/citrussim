// firebase-mediador.js — CítrusSim
// Integração do painel do mediador com Firebase em tempo real

const DB_URL = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

// Mapeamento de IDs para nomes
const EQUIPES = {
  c1: 'Horizonte Verde',
  c2: 'Sol do Campo',
  c3: 'Vale Citrícola',
  c4: 'Jales Agroindustrial',
  c5: 'Terra Frutífera',
  c6: 'Noroeste Paulista',
  c7: 'Citrus Premium',
  c8: 'Campo Aberto',
};

// ── LER STATUS DO FIREBASE ──
async function lerStatusEquipes() {
  try {
    const res = await fetch(`${DB_URL}/torneio/status.json`);
    return await res.json();
  } catch(e) {
    console.error('Erro ao ler status:', e);
    return null;
  }
}

async function lerDecisoesRodada(rodada) {
  try {
    const res = await fetch(`${DB_URL}/torneio/rodadas/r${rodada}/decisoes.json`);
    return await res.json();
  } catch(e) {
    console.error('Erro ao ler decisões:', e);
    return null;
  }
}

// ── FORMATAR HORÁRIO ──
function formatarHorario(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch(e) { return null; }
}

// ── ATUALIZAR CARDS DE DECISÃO ──
async function atualizarStatusDecisoes() {
  const rodadaAtual = 1;
  const [status, decisoes] = await Promise.all([
    lerStatusEquipes(),
    lerDecisoesRodada(rodadaAtual)
  ]);

  let enviadas = 0;

  Object.keys(EQUIPES).forEach(id => {
    const nome = EQUIPES[id];
    const statusEquipe = status && status[id];
    const decisaoEquipe = decisoes && decisoes[id];

    // Determinar se enviou nesta rodada
    const enviou = statusEquipe &&
      statusEquipe.status === 'enviado' &&
      statusEquipe.rodadaAtual === rodadaAtual;

    const horario = enviou ? formatarHorario(statusEquipe.ultimaDecisao) : null;

    if (enviou) enviadas++;

    // Atualizar card na tela
    atualizarCardDecisao(id, nome, enviou, horario);

    // Atualizar mapa de calor
    atualizarMapaCalor(id, nome, enviou, decisaoEquipe);
  });

  // Atualizar contador geral
  atualizarContadorDecisoes(enviadas, 8);

  // Atualizar indicador de última atualização
  const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.getElementById('ultima-atualizacao');
  if (el) el.textContent = 'Última atualização: ' + agora;
}

// ── ATUALIZAR CARD INDIVIDUAL ──
function atualizarCardDecisao(id, nome, enviou, horario) {
  // Procura por card com data-id ou pelo nome
  const cards = document.querySelectorAll('.dec-card');
  cards.forEach(card => {
    const nomeEl = card.querySelector('.dec-card-nome');
    if (nomeEl && nomeEl.textContent.includes(nome)) {
      const statusEl = card.querySelector('.dec-card-status');
      const horaEl = card.querySelector('.dec-card-hora');
      if (statusEl) {
        statusEl.className = 'dec-card-status ' + (enviou ? 'status-enviou' : 'status-pendente');
        statusEl.textContent = enviou ? '✅ Enviou' : '⏳ Pendente';
      }
      if (horaEl) {
        horaEl.textContent = horario ? 'às ' + horario : 'Aguardando...';
      }
    }
  });
}

// ── ATUALIZAR MAPA DE CALOR ──
function atualizarMapaCalor(id, nome, enviou, decisao) {
  const linhas = document.querySelectorAll('#mapa-tbody tr');
  linhas.forEach(linha => {
    const nomeEl = linha.querySelector('.col-nome');
    if (nomeEl && nomeEl.textContent.includes(nome.substring(0, 8))) {
      // Atualizar coluna de decisão
      const celulas = linha.querySelectorAll('td');
      if (celulas.length >= 9) {
        const celDecisao = celulas[celulas.length - 1];
        if (enviou) {
          const horario = decisao ? formatarHorario(decisao.timestamp) : '';
          celDecisao.innerHTML = `<span class="status-enviou">✅ ${horario || 'Enviou'}</span>`;
        } else {
          celDecisao.innerHTML = `<span class="status-pendente">⏳ Pendente</span>`;
        }
      }
    }
  });
}

// ── ATUALIZAR CONTADOR GERAL ──
function atualizarContadorDecisoes(enviadas, total) {
  // Resumo no topo
  const resumoCards = document.querySelectorAll('.resumo-card');
  resumoCards.forEach(card => {
    const label = card.querySelector('.resumo-label');
    if (label && label.textContent.includes('Decisões')) {
      const valor = card.querySelector('.resumo-valor');
      const detalhe = card.querySelector('.resumo-detalhe');
      if (valor) valor.innerHTML = `${enviadas}<span style="font-size:16px;color:#aaa">/${total}</span>`;
      if (detalhe) detalhe.textContent = (total - enviadas) + ' equipes pendentes';
    }
  });

  // Badge no header de controle de rodada
  const decText = document.querySelector('[class*="rodada-info"] p:last-child');
  if (decText && decText.textContent.includes('Decisões')) {
    decText.textContent = `Decisões recebidas: ${enviadas} de ${total} equipes`;
  }
}

// ── INICIAR POLLING (atualização automática) ──
let pollingId = null;

function iniciarAtualizacaoAutomatica(intervaloSegundos = 10) {
  // Primeira atualização imediata
  atualizarStatusDecisoes();

  // Depois a cada X segundos
  pollingId = setInterval(atualizarStatusDecisoes, intervaloSegundos * 1000);

  console.log(`🔄 CítrusSim: atualizando status a cada ${intervaloSegundos}s`);
}

function pararAtualizacao() {
  if (pollingId) clearInterval(pollingId);
}

// ── AUTO-INICIAR quando o DOM estiver pronto ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => iniciarAtualizacaoAutomatica(10));
} else {
  iniciarAtualizacaoAutomatica(10);
}
