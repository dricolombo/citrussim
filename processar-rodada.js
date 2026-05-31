// processar-rodada.js — CítrusSim
// Motor de processamento completo de uma rodada
// Lê decisões do Firebase, calcula DRE/caixa/reputação/IDC e salva resultados

const DB_URL = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

// ══════════════════════════════════════════
// PARÂMETROS DO JOGO
// ══════════════════════════════════════════
const P = {
  precoLaranja:    18.00,
  descontoAV:      0.05,
  impostos:        0.12,
  ir:              0.15,
  salarioBase:     1800,
  energiaFixa:     3000,
  energiaVar:      1.50,
  custoContratar:  2700,
  custoDemitir:    3600,
  armazenagem:     0.02,
  mercadoTotal:    6400,
  repInicial:      50,
  funcInicial:     6,
  caixaInicial:    50000,
  procFaixa: [
    { ate:500,   proc:5.50, embal:3.00 },
    { ate:1000,  proc:4.50, embal:2.50 },
    { ate:2000,  proc:3.80, embal:2.20 },
    { ate:99999, proc:3.20, embal:2.00 },
  ],
};

const EQUIPES_NOMES = {
  c1:'Horizonte Verde', c2:'Sol do Campo', c3:'Vale Citrícola',
  c4:'Jales Agroindustrial', c5:'Terra Frutífera', c6:'Noroeste Paulista',
  c7:'Citrus Premium', c8:'Campo Aberto',
};

// ══════════════════════════════════════════
// FIREBASE — ler e escrever
// ══════════════════════════════════════════
async function dbLer(caminho) {
  const res = await fetch(`${DB_URL}/${caminho}.json`);
  return await res.json();
}

async function dbEscrever(caminho, dados) {
  await fetch(`${DB_URL}/${caminho}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
}

// ══════════════════════════════════════════
// FUNÇÕES DE CÁLCULO
// ══════════════════════════════════════════
function custoUnitario(qtd, precoLaranja) {
  let proc = 5.50, embal = 3.00;
  for (const f of P.procFaixa) {
    if (qtd <= f.ate) { proc = f.proc; embal = f.embal; break; }
  }
  return precoLaranja + proc + embal;
}

function calcularReputacao(repAtual, dados) {
  let delta = 0;
  const { vendido, capacidade, mkt, treino, rh, funcAtual } = dados;

  // Entrega sem ruptura
  if (vendido >= capacidade * 0.9) delta += 5;
  else if (vendido < capacidade * 0.5) delta -= 10;

  // Marketing
  const mktMap = { '0':0, '500':3, '2000':6, '5000':10 };
  delta += mktMap[String(mkt)] || 0;

  // Treinamento
  if (treino && treino !== 'NAO') delta += 4;

  // Demissão em massa
  if (rh < 0 && funcAtual > 0 && Math.abs(rh) / funcAtual > 0.30) delta -= 8;

  return Math.max(0, Math.min(100, repAtual + delta));
}

function calcularIDC(dados) {
  const { margemLiq, caixaFinal, vendido, capacidade, repFinal, pd, caixaInicial } = dados;

  const finScore    = Math.max(0, Math.min(100, 50 + (margemLiq * 2)));
  const saudeScore  = caixaFinal >= 0 ? Math.min(100, (caixaFinal / caixaInicial) * 100) : 0;
  const estoqueScore= capacidade > 0 ? Math.min(100, (vendido / capacidade) * 100) : 50;
  const repScore    = Math.max(0, Math.min(100, repFinal));
  const inovScore   = pd && parseFloat(pd) > 0 ? 60 : 20;
  const missaoScore = 50;

  return +(
    finScore    * 0.26 +
    saudeScore  * 0.21 +
    estoqueScore* 0.17 +
    repScore    * 0.21 +
    inovScore   * 0.10 +
    missaoScore * 0.05
  ).toFixed(2);
}

// ══════════════════════════════════════════
// PROCESSAR UMA EQUIPE
// ══════════════════════════════════════════
function processarEquipe(id, dec, estadoAnterior, mercadoInfo) {
  const { precoLaranja, mercadoTotal } = mercadoInfo;

  // Decisões com defaults
  const compra   = parseFloat(dec.compra)  || 0;
  const pagto    = dec.pagto  || 'AV';
  const ms       = parseFloat(dec.ms)      || 10;
  const preco    = parseFloat(dec.preco)   || 42;
  const receb    = dec.receb  || 'AV';
  const mkt      = dec.mkt    || '0';
  const rh       = parseInt(dec.rh)        || 0;
  const treino   = dec.treino || 'NAO';
  const pd       = dec.pd     || '0';

  // Estado anterior
  const caixaIni = estadoAnterior.caixa || P.caixaInicial;
  const repAnt   = estadoAnterior.rep   || P.repInicial;
  const funcAnt  = estadoAnterior.func  || P.funcInicial;

  // Funcionários e capacidade
  const funcNovo    = Math.max(1, funcAnt + rh);
  const bonusTreino = treino === 'OP' ? 0.15 : 0;
  const capacidade  = Math.round(funcNovo * 100 * (1 + bonusTreino));

  // Compras
  const precoLiqLaranja = pagto === 'AV'
    ? precoLaranja * (1 - P.descontoAV)
    : precoLaranja;
  const custoCompra = compra * precoLiqLaranja;

  // Produção e vendas
  const produzido       = Math.min(compra, capacidade);
  const volumeMercado   = Math.round(mercadoTotal * (ms / 100));
  const vendido         = Math.min(produzido, volumeMercado);

  // DRE
  const receitaBruta  = vendido * preco;
  const impostos      = receitaBruta * P.impostos;
  const receitaLiq    = receitaBruta - impostos;
  const custoUnit     = custoUnitario(vendido, precoLiqLaranja);
  const cmv           = vendido * custoUnit;
  const lucroBruto    = receitaLiq - cmv;

  // Despesas operacionais
  const folha       = funcNovo * P.salarioBase;
  const energiaVar  = produzido * P.energiaVar;
  const custoRH     = rh > 0 ? rh * P.custoContratar : rh < 0 ? Math.abs(rh) * P.custoDemitir : 0;
  const estoqueRest = Math.max(0, produzido - vendido);
  const armazem     = estoqueRest * custoUnit * P.armazenagem;
  const mktValor    = parseFloat(mkt) || 0;
  const pdValor     = parseFloat(pd)  || 0;
  const despesasOp  = folha + P.energiaFixa + energiaVar + mktValor + custoRH + armazem + pdValor;

  const ebit        = lucroBruto - despesasOp;
  const ir          = ebit > 0 ? ebit * P.ir : 0;
  const lucroLiq    = ebit - ir;
  const margemLiq   = receitaBruta > 0 ? +((lucroLiq / receitaBruta) * 100).toFixed(2) : 0;

  // Fluxo de caixa
  const percRecebAgora = receb === 'AV' ? 1.0 : receb === '2x' ? 0.5 : receb === '3x' ? 0.333 : 0;
  const recebAgora     = +(receitaBruta * percRecebAgora).toFixed(2);
  const pagCompra      = pagto === 'AV' ? custoCompra : 0;
  const saidaFolha     = folha + P.energiaFixa + energiaVar + custoRH;
  const saidaMktPd     = mktValor + pdValor;
  const saidaImp       = impostos + ir;
  const caixaFinal     = +(caixaIni + recebAgora - pagCompra - saidaFolha - saidaMktPd - saidaImp).toFixed(2);

  // Reputação e IDC
  const repFinal = calcularReputacao(repAnt, { vendido, capacidade, mkt: mktValor, treino, rh, funcAtual: funcNovo });
  const idc      = calcularIDC({ margemLiq, caixaFinal, vendido, capacidade, repFinal, pd, caixaInicial: caixaIni });

  return {
    id, nome: EQUIPES_NOMES[id],
    // Indicadores principais
    caixa: caixaFinal, rep: repFinal, idc, func: funcNovo,
    ms, vol: vendido, margem: margemLiq,
    // DRE completa
    dre: {
      receitaBruta: +receitaBruta.toFixed(2),
      impostos: +impostos.toFixed(2),
      receitaLiq: +receitaLiq.toFixed(2),
      cmv: +cmv.toFixed(2),
      lucroBruto: +lucroBruto.toFixed(2),
      despesasOp: +despesasOp.toFixed(2),
      ebit: +ebit.toFixed(2),
      ir: +ir.toFixed(2),
      lucroLiq: +lucroLiq.toFixed(2),
      margemLiq,
    },
    // Fluxo de caixa
    fc: {
      caixaInicial: caixaIni,
      recebAgora: +recebAgora.toFixed(2),
      pagCompra: +pagCompra.toFixed(2),
      saidaFolha: +saidaFolha.toFixed(2),
      saidaMktPd: +saidaMktPd.toFixed(2),
      saidaImp: +saidaImp.toFixed(2),
      caixaFinal,
    },
    // Detalhes
    capacidade, produzido, vendido, estoqueRest,
    processadoEm: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════
// PROCESSAR RODADA COMPLETA
// ══════════════════════════════════════════
async function processarRodada(rodada, callback) {
  callback && callback('Lendo decisões do Firebase...', 10);

  // 1. Ler decisões
  const decisoes = await dbLer(`torneio/rodadas/r${rodada}/decisoes`);
  if (!decisoes) {
    callback && callback('❌ Nenhuma decisão encontrada!', 0);
    return null;
  }

  callback && callback('Lendo configurações do torneio...', 20);

  // 2. Ler config e estados anteriores
  const config = await dbLer('torneio/config');
  const mercadoInfo = {
    precoLaranja: config?.parametros?.precoLaranja || 18,
    mercadoTotal: config?.parametros?.mercadoTotal || 6400,
  };

  callback && callback('Calculando resultados de cada cooperativa...', 40);

  // 3. Processar cada equipe
  const resultados = {};
  const estadosAnteriores = {};

  // Ler estados anteriores (rodada anterior ou inicial)
  for (const id of Object.keys(EQUIPES_NOMES)) {
    if (rodada > 1) {
      const resAnterior = await dbLer(`torneio/resultados/r${rodada-1}/resultados/${id}`);
      estadosAnteriores[id] = resAnterior || { caixa: P.caixaInicial, rep: P.repInicial, func: P.funcInicial };
    } else {
      estadosAnteriores[id] = { caixa: P.caixaInicial, rep: P.repInicial, func: P.funcInicial };
    }

    // Usar decisões reais ou defaults se não enviou
    const dec = decisoes[id] || {};
    resultados[id] = processarEquipe(id, dec, estadosAnteriores[id], mercadoInfo);
  }

  callback && callback('Calculando ranking IDC...', 70);

  // 4. Ordenar por IDC
  const ranking = Object.values(resultados)
    .sort((a, b) => b.idc - a.idc)
    .map((r, i) => ({ ...r, posicao: i + 1 }));

  callback && callback('Salvando resultados no Firebase...', 85);

 // 5. Salvar resultados — cada equipe individualmente (evita truncamento)
  for (const [id, res] of Object.entries(resultados)) {
    await dbEscrever(`torneio/resultados/r${rodada}/resultados/${id}`, res);
  }
  await dbEscrever(`torneio/resultados/r${rodada}/meta`, {
    ranking: ranking.map(r => ({ id: r.id, nome: r.nome, idc: r.idc, posicao: r.posicao })),
    processadoEm: new Date().toISOString(),
    rodada,
  });

  // 6. Atualizar ranking geral
  const equipeRanking = {};
  ranking.forEach(r => {
    equipeRanking[r.id] = {
      nome: r.nome, idc: r.idc, caixa: r.caixa,
      rep: r.rep, ms: r.ms, vol: r.vol, margem: r.margem,
      posicao: r.posicao,
    };
  });

  await dbEscrever('torneio/ranking', {
    equipes: equipeRanking,
    rodada,
    atualizadoEm: new Date().toISOString(),
  });

  // 7. Atualizar config com rodada atual
  if (config) {
    await dbEscrever('torneio/config', {
      ...config,
      rodadaAtual: rodada + 1,
      ultimoProcessamento: new Date().toISOString(),
    });
  }

  callback && callback('✅ Rodada processada com sucesso!', 100);
  return { resultados, ranking };
}

// ══════════════════════════════════════════
// INTERFACE — botão no painel do mediador
// ══════════════════════════════════════════
function inicializarBotaoProcessar() {
  // Encontra o botão de processar resultados
  const btns = document.querySelectorAll('button');
  btns.forEach(btn => {
    if (btn.textContent.includes('Processar resultados')) {
      btn.onclick = () => abrirModalProcessamento();
    }
  });
}

function abrirModalProcessamento() {
  // Cria modal de confirmação
  const modal = document.createElement('div');
  modal.id = 'modal-processar';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <h2 style="font-family:'Playfair Display',serif;font-size:22px;color:#1a4a2e;margin-bottom:8px;">⚙️ Processar Rodada 1</h2>
      <p style="font-size:14px;color:#5a7060;margin-bottom:24px;line-height:1.6;">
        O sistema vai calcular automaticamente DRE, fluxo de caixa, reputação e IDC de todas as 8 cooperativas com base nas decisões enviadas.
      </p>
      <div id="progresso-wrap" style="display:none;margin-bottom:20px;">
        <div id="progresso-texto" style="font-size:13px;color:#2d6b45;margin-bottom:8px;font-weight:600;">Iniciando...</div>
        <div style="height:8px;background:#f0ece4;border-radius:4px;overflow:hidden;">
          <div id="progresso-barra" style="height:8px;background:#2d6b45;border-radius:4px;width:0%;transition:width 0.4s ease;"></div>
        </div>
      </div>
      <div id="resultado-modal" style="display:none;"></div>
      <div id="botoes-modal" style="display:flex;gap:10px;">
        <button onclick="document.getElementById('modal-processar').remove()"
          style="flex:1;padding:12px;border:2px solid #e2ddd4;border-radius:8px;background:white;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#5a7060;">
          Cancelar
        </button>
        <button id="btn-confirmar-processar"
          onclick="executarProcessamento()"
          style="flex:2;padding:12px;border:none;border-radius:8px;background:#1a4a2e;color:#fdf6e8;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;">
          ⚙️ Confirmar e processar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function executarProcessamento() {
  const progressoWrap = document.getElementById('progresso-wrap');
  const progressoTexto = document.getElementById('progresso-texto');
  const progressoBarra = document.getElementById('progresso-barra');
  const botoesModal = document.getElementById('botoes-modal');
  const resultadoModal = document.getElementById('resultado-modal');

  progressoWrap.style.display = 'block';
  botoesModal.style.display = 'none';

  const resultado = await processarRodada(1, (msg, pct) => {
    progressoTexto.textContent = msg;
    progressoBarra.style.width = pct + '%';
  });

  if (resultado) {
    const top3 = resultado.ranking.slice(0, 3);
    resultadoModal.style.display = 'block';
    resultadoModal.innerHTML = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px;">🏆 Top 3 desta rodada:</div>
        ${top3.map((r,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #dcfce7;font-size:13px;">
            <span>${['🥇','🥈','🥉'][i]}</span>
            <span style="flex:1;font-weight:600;color:#1a4a2e;">Coop. ${r.nome}</span>
            <span style="font-weight:700;color:#2d6b45;">IDC ${r.idc.toFixed(1)}</span>
          </div>
        `).join('')}
      </div>
      <p style="font-size:13px;color:#5a7060;margin-bottom:16px;">O ranking público foi atualizado automaticamente!</p>
    `;
    botoesModal.innerHTML = `
      <button onclick="document.getElementById('modal-processar').remove();location.reload()"
        style="width:100%;padding:12px;border:none;border-radius:8px;background:#1a4a2e;color:#fdf6e8;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;">
        ✅ Ver resultados atualizados
      </button>
    `;
    botoesModal.style.display = 'block';
  }
}

// ── AUTO-INICIAR ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarBotaoProcessar);
} else {
  inicializarBotaoProcessar();
}
