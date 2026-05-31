// firebase-equipe.js — CítrusSim
// Popula as abas Financeiro, Contábil e Comércio Exterior
// com dados reais do Firebase após o processamento de cada rodada.
//
// COMO USAR: adicione ao final do painel-equipe.html, antes de </body>:
//   <script src="firebase-equipe.js"></script>

(function () {
  'use strict';

  const DB = 'https://citrussim-fatec-default-rtdb.firebaseio.com';

  // ── Utilitários ────────────────────────────────────────────────────────────

  function coopId() {
    try { return JSON.parse(localStorage.getItem('citrussim_sessao'))?.coopId || null; }
    catch (e) { return null; }
  }

  function rodadaAtual() {
    // Usa o badge já existente no HTML para saber a rodada
    const badge = document.getElementById('badge-rodada');
    if (badge) {
      const m = badge.textContent.match(/\d+/);
      if (m) return parseInt(m[0]);
    }
    return 1;
  }

  async function dbLerEquipe(caminho) {
    try {
      const res = await fetch(`${DB}/${caminho}.json`);
      return await res.json();
    } catch (e) { return null; }
  }

  function fmt(v, casas = 0) {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  function fmtR(v, casas = 0) {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    const abs = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return (n < 0 ? '−R$' : 'R$') + abs;
  }

  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return (n >= 0 ? '' : '−') + Math.abs(n).toFixed(1) + '%';
  }

  function cor(v, limites) {
    // limites: [[limite, classe], ...] do maior para o menor
    if (v === null || v === undefined) return 'cor-cinza';
    const n = parseFloat(v);
    for (const [lim, cls] of limites) {
      if (n >= lim) return cls;
    }
    return limites[limites.length - 1][1];
  }

  // ── CSS injetado uma única vez ─────────────────────────────────────────────

  function injetarCSS() {
    if (document.getElementById('fe-css')) return;
    const style = document.createElement('style');
    style.id = 'fe-css';
    style.textContent = `
      /* firebase-equipe.js — estilos das abas Financeiro, Contábil, Comércio */

      .fe-aviso-aguarda {
        background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px;
        padding: 28px 24px; text-align: center; color: #92400e;
      }
      .fe-aviso-aguarda .fe-icone { font-size: 40px; margin-bottom: 10px; }
      .fe-aviso-aguarda h3 { font-family: 'Playfair Display', serif; font-size: 18px; margin-bottom: 6px; }
      .fe-aviso-aguarda p  { font-size: 13px; line-height: 1.6; max-width: 380px; margin: 0 auto; }

      /* Cards de indicadores (topo das abas) */
      .fe-ind-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
      .fe-ind-card { background: var(--branco); border-radius: 12px; padding: 16px 18px; border: 1px solid var(--borda); }
      .fe-ind-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--texto-suave); margin-bottom: 4px; }
      .fe-ind-valor { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--verde-escuro); line-height: 1; margin-bottom: 3px; }
      .fe-ind-valor.negativo { color: var(--vermelho); }
      .fe-ind-valor.neutro   { color: var(--laranja); }
      .fe-ind-sub { font-size: 11px; color: var(--texto-suave); }

      /* Tabela DRE */
      .fe-dre-wrap { overflow-x: auto; }
      .fe-dre { width: 100%; border-collapse: collapse; font-size: 13px; }
      .fe-dre th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--texto-suave); border-bottom: 2px solid var(--borda); }
      .fe-dre td { padding: 10px 12px; border-bottom: 1px solid var(--fundo); }
      .fe-dre tr:last-child td { border-bottom: none; }
      .fe-dre tr.total td { font-weight: 700; font-size: 14px; border-top: 2px solid var(--borda); border-bottom: 2px solid var(--borda); }
      .fe-dre tr.subtotal td { font-weight: 600; background: var(--fundo); }
      .fe-dre tr.destaque td { background: #f0fdf4; font-weight: 700; color: var(--verde-escuro); }
      .fe-dre tr.negativo td { background: #fef2f2; color: var(--vermelho); font-weight: 600; }
      .fe-dre .td-val { text-align: right; font-family: 'DM Sans', sans-serif; font-variant-numeric: tabular-nums; }
      .fe-dre .td-pct { text-align: right; color: var(--texto-suave); font-size: 12px; }
      .fe-dre .indent { padding-left: 28px; color: var(--texto-suave); }

      /* Badge colorido inline */
      .fe-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
      .fe-badge.verde  { background: #dcfce7; color: #166534; }
      .fe-badge.amarelo{ background: #fef9c3; color: #854d0e; }
      .fe-badge.vermelho{ background: #fee2e2; color: #991b1b; }
      .fe-badge.cinza  { background: #f1f5f9; color: #64748b; }

      /* Barra de progresso P&D */
      .fe-pd-barra-wrap { height: 8px; background: #f0ece4; border-radius: 4px; overflow: hidden; margin-top: 6px; }
      .fe-pd-barra { height: 8px; background: var(--verde-medio); border-radius: 4px; transition: width 0.8s ease; }

      /* Tabela FC */
      .fe-fc-linha { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--fundo); font-size: 13px; }
      .fe-fc-linha:last-child { border-bottom: none; }
      .fe-fc-linha.total { font-weight: 700; font-size: 15px; border-top: 2px solid var(--borda); padding-top: 12px; margin-top: 4px; }
      .fe-fc-entrada { color: #166534; font-weight: 600; }
      .fe-fc-saida   { color: var(--vermelho); font-weight: 600; }
      .fe-fc-neutro  { color: var(--texto-suave); }

      /* Comércio Exterior — bloqueado */
      .fe-bloqueado { background: var(--branco); border: 2px dashed var(--borda); border-radius: 14px; padding: 40px 24px; text-align: center; }
      .fe-bloqueado .fe-lock { font-size: 44px; margin-bottom: 12px; }
      .fe-bloqueado h3 { font-family: 'Playfair Display', serif; font-size: 19px; color: var(--verde-escuro); margin-bottom: 8px; }
      .fe-bloqueado p  { font-size: 13px; color: var(--texto-suave); line-height: 1.6; max-width: 360px; margin: 0 auto 16px; }

      /* Comércio Exterior — desbloqueado */
      .fe-cert-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
      .fe-cert-card { background: var(--branco); border-radius: 12px; padding: 18px; border: 1px solid var(--borda); }
      .fe-cert-card h4 { font-size: 13px; font-weight: 700; color: var(--verde-escuro); margin-bottom: 6px; }
      .fe-cert-card p  { font-size: 12px; color: var(--texto-suave); line-height: 1.5; }
      .fe-cert-prog { margin-top: 10px; }
      .fe-cert-prog-label { display: flex; justify-content: space-between; font-size: 11px; color: var(--texto-suave); margin-bottom: 4px; }

      @media (max-width: 860px) {
        .fe-ind-grid { grid-template-columns: repeat(2, 1fr); }
        .fe-cert-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── ABA FINANCEIRO ─────────────────────────────────────────────────────────

  async function popularFinanceiro(resultado, config) {
    const aba = document.getElementById('aba-financeiro');
    if (!aba) return;

    // Busca o card existente (formulário de decisões) — vem depois dos dados
    const cardDecisoes = aba.querySelector('.card');

    // Remove bloco de dados anterior se já existia
    const anterior = document.getElementById('fe-fin-dados');
    if (anterior) anterior.remove();

    const wrap = document.createElement('div');
    wrap.id = 'fe-fin-dados';

    if (!resultado) {
      // Antes do processamento: mostra estado inicial e aviso
      const juros = config?.parametros?.juros || 2.0;
      wrap.innerHTML = `
        <div class="fe-aviso-aguarda" style="margin-bottom:20px;">
          <div class="fe-icone">🏦</div>
          <h3>Aguardando processamento da Rodada 1</h3>
          <p>Após a mediadora processar a rodada, você verá aqui seu extrato financeiro real. Por enquanto, confira seu estado inicial abaixo.</p>
        </div>
        <div class="fe-ind-grid">
          <div class="fe-ind-card">
            <div class="fe-ind-label">💰 Caixa Inicial</div>
            <div class="fe-ind-valor">R$50.000</div>
            <div class="fe-ind-sub">Capital disponível</div>
          </div>
          <div class="fe-ind-card">
            <div class="fe-ind-label">🏛️ Capital Social</div>
            <div class="fe-ind-valor">R$20.000</div>
            <div class="fe-ind-sub">Intocável</div>
          </div>
          <div class="fe-ind-card">
            <div class="fe-ind-label">📈 Taxa de Crédito</div>
            <div class="fe-ind-valor">${juros}% a.m.</div>
            <div class="fe-ind-sub">Máximo R$30.000</div>
          </div>
        </div>
      `;
    } else {
      // Após processamento
      const caixa   = resultado.caixa;
      const fc      = resultado.fc || {};
      const dre     = resultado.dre || {};
      const rodada  = resultado.rodada || rodadaAtual();

      const corCaixa = caixa >= 20000 ? 'verde' : caixa >= 0 ? 'amarelo' : 'vermelho';

      wrap.innerHTML = `
        <div class="card" style="margin-bottom:18px;">
          <div class="card-titulo">📊 Situação Financeira — Rodada ${rodada}</div>
          <div class="fe-ind-grid">
            <div class="fe-ind-card">
              <div class="fe-ind-label">💰 Caixa Final</div>
              <div class="fe-ind-valor ${caixa < 0 ? 'negativo' : ''}">${fmtR(caixa)}</div>
              <div class="fe-ind-sub">
                <span class="fe-badge ${corCaixa}">
                  ${caixa >= 20000 ? '✅ Saudável' : caixa >= 0 ? '⚠️ Atenção' : '🔴 Negativo'}
                </span>
              </div>
            </div>
            <div class="fe-ind-card">
              <div class="fe-ind-label">📥 Receita Recebida</div>
              <div class="fe-ind-valor">${fmtR(fc.recebAgora)}</div>
              <div class="fe-ind-sub">Entradas desta rodada</div>
            </div>
            <div class="fe-ind-card">
              <div class="fe-ind-label">📤 Total de Saídas</div>
              <div class="fe-ind-valor negativo">${fmtR((fc.pagCompra||0)+(fc.saidaFolha||0)+(fc.saidaMktPd||0)+(fc.saidaImp||0))}</div>
              <div class="fe-ind-sub">Compras + custos + impostos</div>
            </div>
          </div>

          <div style="font-size:13px;font-weight:700;color:var(--verde-escuro);margin:18px 0 10px;">🔄 Fluxo de Caixa Direto</div>
          <div>
            <div class="fe-fc-linha">
              <span>Caixa inicial</span>
              <span class="fe-fc-neutro">${fmtR(fc.caixaInicial)}</span>
            </div>
            <div class="fe-fc-linha">
              <span>🟢 Receita recebida ${dre.receitaBruta ? '('+Math.round((fc.recebAgora/dre.receitaBruta)*100)+'% do total)' : ''}</span>
              <span class="fe-fc-entrada">+ ${fmtR(fc.recebAgora)}</span>
            </div>
            <div class="fe-fc-linha">
              <span>🔴 Pagamento de compras</span>
              <span class="fe-fc-saida">− ${fmtR(fc.pagCompra)}</span>
            </div>
            <div class="fe-fc-linha">
              <span>🔴 Folha + energia + RH</span>
              <span class="fe-fc-saida">− ${fmtR(fc.saidaFolha)}</span>
            </div>
            <div class="fe-fc-linha">
              <span>🔴 Marketing + P&D</span>
              <span class="fe-fc-saida">− ${fmtR(fc.saidaMktPd)}</span>
            </div>
            <div class="fe-fc-linha">
              <span>🔴 Impostos + IR</span>
              <span class="fe-fc-saida">− ${fmtR(fc.saidaImp)}</span>
            </div>
            <div class="fe-fc-linha total">
              <span>💰 Caixa final</span>
              <span class="${caixa >= 0 ? 'fe-fc-entrada' : 'fe-fc-saida'}">${fmtR(caixa)}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Insere ANTES do card de decisões (que já existe no HTML)
    if (cardDecisoes) {
      aba.insertBefore(wrap, cardDecisoes);
    } else {
      const titulo = aba.querySelector('.pag-titulo');
      titulo ? titulo.after(wrap) : aba.prepend(wrap);
    }
  }

  // ── ABA CONTÁBIL & DRE ─────────────────────────────────────────────────────

  async function popularContabil(resultado) {
    const aba = document.getElementById('aba-contabil');
    if (!aba) return;

    // Substitui o conteúdo inteiro da aba
    const rodada = resultado?.rodada || rodadaAtual();

    if (!resultado || !resultado.dre) {
      aba.innerHTML = `
        <div class="pag-titulo">📊 Contábil & DRE</div>
        <div class="pag-sub">Demonstrativos financeiros da sua cooperativa</div>
        <div class="fe-aviso-aguarda">
          <div class="fe-icone">📊</div>
          <h3>Aguardando processamento</h3>
          <p>Após a mediadora processar a Rodada 1, você verá aqui a DRE completa, balanço patrimonial e indicadores contábeis da sua cooperativa.</p>
        </div>
      `;
      return;
    }

    const d   = resultado.dre;
    const rec = d.receitaBruta || 0;

    // Função para % da receita bruta
    const pct = v => rec > 0 ? fmtPct((v / rec) * 100) : '—';

    // Classificar margem
    const ml = parseFloat(d.margemLiq) || 0;
    const corMargem = ml >= 15 ? 'verde' : ml >= 0 ? 'amarelo' : 'vermelho';
    const labelMargem = ml >= 15 ? '✅ Ótima' : ml >= 0 ? '⚠️ Apertada' : '🔴 Prejuízo';

    aba.innerHTML = `
      <div class="pag-titulo">📊 Contábil & DRE</div>
      <div class="pag-sub">Demonstração do Resultado — Rodada ${rodada}</div>

      <div class="fe-ind-grid" style="margin-bottom:20px;">
        <div class="fe-ind-card">
          <div class="fe-ind-label">💰 Receita Bruta</div>
          <div class="fe-ind-valor">${fmtR(d.receitaBruta)}</div>
          <div class="fe-ind-sub">${fmt(resultado.vendido)} cx × R$${fmt(resultado.vendido && d.receitaBruta ? (d.receitaBruta/resultado.vendido) : 0, 2)}/cx</div>
        </div>
        <div class="fe-ind-card">
          <div class="fe-ind-label">📈 Lucro Líquido</div>
          <div class="fe-ind-valor ${ml < 0 ? 'negativo' : ''}">${fmtR(d.lucroLiq)}</div>
          <div class="fe-ind-sub"><span class="fe-badge ${corMargem}">${labelMargem}</span></div>
        </div>
        <div class="fe-ind-card">
          <div class="fe-ind-label">📊 Margem Líquida</div>
          <div class="fe-ind-valor ${ml < 0 ? 'negativo' : ml < 5 ? 'neutro' : ''}">${fmtPct(d.margemLiq)}</div>
          <div class="fe-ind-sub">Sobre receita bruta</div>
        </div>
      </div>

      <div class="card">
        <div class="card-titulo">📋 DRE — Demonstração do Resultado do Exercício</div>
        <div class="fe-dre-wrap">
          <table class="fe-dre">
            <thead>
              <tr>
                <th>Conta</th>
                <th class="td-val">Valor (R$)</th>
                <th class="td-pct">% Rec. Bruta</th>
              </tr>
            </thead>
            <tbody>
              <tr class="subtotal">
                <td>Receita Bruta de Vendas</td>
                <td class="td-val">${fmtR(d.receitaBruta)}</td>
                <td class="td-pct">100%</td>
              </tr>
              <tr>
                <td class="indent">(−) Impostos sobre vendas (12%)</td>
                <td class="td-val">(${fmtR(d.impostos)})</td>
                <td class="td-pct">${pct(d.impostos)}</td>
              </tr>
              <tr class="subtotal">
                <td>= Receita Líquida</td>
                <td class="td-val">${fmtR(d.receitaLiq)}</td>
                <td class="td-pct">${pct(d.receitaLiq)}</td>
              </tr>
              <tr>
                <td class="indent">(−) CMV — Custo das Mercadorias Vendidas</td>
                <td class="td-val">(${fmtR(d.cmv)})</td>
                <td class="td-pct">${pct(d.cmv)}</td>
              </tr>
              <tr class="subtotal">
                <td>= Lucro Bruto</td>
                <td class="td-val">${fmtR(d.lucroBruto)}</td>
                <td class="td-pct">${pct(d.lucroBruto)}</td>
              </tr>
              <tr>
                <td class="indent">(−) Despesas Operacionais</td>
                <td class="td-val">(${fmtR(d.despesasOp)})</td>
                <td class="td-pct">${pct(d.despesasOp)}</td>
              </tr>
              <tr class="subtotal">
                <td>= EBIT (Resultado antes do IR)</td>
                <td class="td-val">${fmtR(d.ebit)}</td>
                <td class="td-pct">${pct(d.ebit)}</td>
              </tr>
              <tr>
                <td class="indent">(−) Imposto de Renda (15%)</td>
                <td class="td-val">(${fmtR(d.ir)})</td>
                <td class="td-pct">${pct(d.ir)}</td>
              </tr>
              <tr class="${ml >= 0 ? 'destaque' : 'negativo'} total">
                <td>= Lucro Líquido</td>
                <td class="td-val">${fmtR(d.lucroLiq)}</td>
                <td class="td-pct">${fmtPct(d.margemLiq)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-titulo">📦 Indicadores Operacionais — Rodada ${rodada}</div>
        <div class="fe-ind-grid" style="grid-template-columns:repeat(3,1fr);">
          <div class="fe-ind-card">
            <div class="fe-ind-label">📦 Produção</div>
            <div class="fe-ind-valor">${fmt(resultado.produzido)} cx</div>
            <div class="fe-ind-sub">Capacidade: ${fmt(resultado.capacidade)} cx</div>
          </div>
          <div class="fe-ind-card">
            <div class="fe-ind-label">🛒 Vendido</div>
            <div class="fe-ind-valor">${fmt(resultado.vendido)} cx</div>
            <div class="fe-ind-sub">
              Aproveit.: ${resultado.capacidade > 0 ? Math.round((resultado.vendido/resultado.capacidade)*100) : 0}%
            </div>
          </div>
          <div class="fe-ind-card">
            <div class="fe-ind-label">🏭 Estoque Restante</div>
            <div class="fe-ind-valor ${resultado.estoqueRest > 200 ? 'negativo' : ''}">${fmt(resultado.estoqueRest)} cx</div>
            <div class="fe-ind-sub">${resultado.estoqueRest > 0 ? 'Custo de armazenagem' : 'Sem estoque parado'}</div>
          </div>
        </div>
      </div>
    `;
  }

  // ── ABA COMÉRCIO EXTERIOR ─────────────────────────────────────────────────

  async function popularComercio(resultado, decisoesHistorico) {
    const aba = document.getElementById('aba-comercio');
    if (!aba) return;

    // Calcular investimento acumulado em P&D (todas as rodadas)
    let pdAcumulado = 0;
    let pdLinhas = new Set();

    if (decisoesHistorico) {
      Object.values(decisoesHistorico).forEach(rodDecisoes => {
        const id = coopId();
        if (!id) return;
        const dec = rodDecisoes[id];
        if (!dec) return;
        if (dec.pd) pdAcumulado += parseFloat(dec.pd) || 0;
        if (dec.pd_linha) pdLinhas.add(dec.pd_linha);
      });
    }

    // Também pega P&D da última decisão salva localmente
    try {
      const local = JSON.parse(localStorage.getItem('citrussim_decisoes_r1'));
      if (local?.pd) pdAcumulado += parseFloat(local.pd) || 0;
      if (local?.pd_linha) pdLinhas.add(local.pd_linha);
    } catch (e) {}

    // Certificação de exportação requer P&D linha L2 ou L3
    const temCertLinhas = pdLinhas.has('L2') || pdLinhas.has('L3');
    // Meta: R$5.000 em P&D na linha correta para certificação básica
    const META_PD_CERT = 5000;
    const progresso = Math.min(100, Math.round((pdAcumulado / META_PD_CERT) * 100));
    const certificada = temCertLinhas && pdAcumulado >= META_PD_CERT;

    if (!resultado && !temCertLinhas) {
      // Sem processamento e sem P&D — tela bloqueada
      aba.innerHTML = `
        <div class="pag-titulo">🌍 Comércio Exterior</div>
        <div class="pag-sub">Exportação, certificação e câmbio</div>
        <div class="fe-bloqueado">
          <div class="fe-lock">🔒</div>
          <h3>Módulo bloqueado</h3>
          <p>Para exportar, sua cooperativa precisa obter <strong>Certificação de Qualidade</strong> via P&D. Invista na <strong>Linha 2 (Processo e Qualidade)</strong> ou <strong>Linha 3 (Mercado e Produto)</strong> na aba P&D & Portfólio.</p>
          <div style="background:#f0fdf4;border-radius:10px;padding:14px 20px;display:inline-block;font-size:13px;color:#166534;font-weight:600;">
            💡 Meta: R$5.000 em P&D nas linhas L2 ou L3
          </div>
        </div>
      `;
      return;
    }

    // P&D em andamento mas ainda não certificada, ou já certificada
    const rodada = resultado?.rodada || rodadaAtual();

    aba.innerHTML = `
      <div class="pag-titulo">🌍 Comércio Exterior</div>
      <div class="pag-sub">Exportação, certificação e câmbio — Rodada ${rodada}</div>

      ${ !certificada ? `
      <div class="alerta aviso" style="margin-bottom:18px;">
        <span>🔬</span>
        <div>
          <strong>Certificação em andamento.</strong>
          Você investiu ${fmtR(pdAcumulado)} em P&D. Continue investindo nas linhas L2 ou L3 para obter a certificação de exportação.
        </div>
      </div>
      ` : `
      <div class="alerta sucesso" style="margin-bottom:18px;">
        <span>✅</span>
        <div><strong>Certificação obtida!</strong> Sua cooperativa está apta a exportar.</div>
      </div>
      ` }

      <div class="card">
        <div class="card-titulo">🏅 Status de Certificação</div>
        <div class="fe-cert-grid">
          <div class="fe-cert-card">
            <h4>🔬 P&D Acumulado</h4>
            <p>Linhas ativas: ${ pdLinhas.size > 0 ? [...pdLinhas].join(', ') : 'Nenhuma' }</p>
            <div class="fe-cert-prog">
              <div class="fe-cert-prog-label">
                <span>${fmtR(pdAcumulado)} investidos</span>
                <span>${progresso}% da meta</span>
              </div>
              <div class="fe-pd-barra-wrap">
                <div class="fe-pd-barra" style="width:${progresso}%;background:${certificada?'#16a34a':'var(--laranja)'}"></div>
              </div>
            </div>
          </div>
          <div class="fe-cert-card">
            <h4>📜 Certificação de Exportação</h4>
            <p>${ certificada
              ? '✅ Certificado ISO 9001 obtido. Acesso ao mercado internacional liberado.'
              : `⏳ Aguardando ${fmtR(META_PD_CERT - pdAcumulado)} adicionais em P&D (L2 ou L3).`
            }</p>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-titulo">🌐 Mercados de Exportação</div>
        <table class="fe-dre">
          <thead>
            <tr>
              <th>Destino</th>
              <th>Câmbio (R$/US$)</th>
              <th>Preço FOB</th>
              <th>Volume est.</th>
              <th>Requisito</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>🇺🇸 Estados Unidos</td>
              <td class="td-val">R$5,80</td>
              <td class="td-val">US$8,50/cx</td>
              <td class="td-val">500–1.000 cx</td>
              <td>${ certificada ? '<span class="fe-badge verde">✅ Liberado</span>' : '<span class="fe-badge cinza">🔒 Requer cert.</span>' }</td>
            </tr>
            <tr>
              <td>🇪🇺 União Europeia</td>
              <td class="td-val">R$6,20</td>
              <td class="td-val">€7,80/cx</td>
              <td class="td-val">300–800 cx</td>
              <td>${ certificada ? '<span class="fe-badge verde">✅ Liberado</span>' : '<span class="fe-badge cinza">🔒 Requer cert.</span>' }</td>
            </tr>
            <tr>
              <td>🇨🇳 China</td>
              <td class="td-val">R$0,80</td>
              <td class="td-val">¥60/cx</td>
              <td class="td-val">1.000–2.000 cx</td>
              <td><span class="fe-badge amarelo">⚠️ Negociação</span></td>
            </tr>
          </tbody>
        </table>
        <div class="alerta info" style="margin-top:14px;">
          <span>💡</span>
          <div>Exportação será ativada como decisão na <strong>Rodada 3</strong>, após a certificação. Os valores acima são projeções para planejamento estratégico.</div>
        </div>
      </div>
    `;
  }

  // ── ATUALIZAR RANKING MINI DA ABA INÍCIO ──────────────────────────────────

  async function atualizarRankingMiniInicio(rankingEquipes, meuId) {
    const wrap = document.querySelector('#aba-inicio .ranking-mini');
    if (!wrap || !rankingEquipes) return;

    const equipes = Object.entries(rankingEquipes)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => (b.idc || 0) - (a.idc || 0));

    const posClasses = ['rp1', 'rp2', 'rp3'];
    const maxIdc = equipes[0]?.idc || 100;
    const minhaPos = equipes.findIndex(e => e.id === meuId);

    // Mostra top 3 + a minha se não estiver no top 3
    const exibir = new Set([0, 1, 2, minhaPos >= 0 ? minhaPos : -1].filter(i => i >= 0));

    const linhas = equipes.map((e, i) => {
      if (!exibir.has(i)) return '';
      const euClass = e.id === meuId ? 'rp-eu' : (posClasses[i] || 'rpn');
      const nomeClass = e.id === meuId ? 'eu' : '';
      const barra = maxIdc > 0 ? Math.round((e.idc / maxIdc) * 100) : 50;
      const barraColor = e.id === meuId ? 'var(--laranja)' : 'var(--verde-claro)';
      const nome = e.nome || e.id;
      return `
        <div class="rank-linha">
          <span class="rank-pos ${euClass}">${i + 1}</span>
          <span class="rank-nome ${nomeClass}">${e.id === meuId ? '★ ' : ''}${nome}</span>
          <div class="rank-barra-wrap"><div class="rank-barra" style="width:${barra}%;background:${barraColor}"></div></div>
          <span class="rank-idc" style="${e.id === meuId ? 'color:var(--laranja)' : ''}">${e.idc ? e.idc.toFixed(1) : '—'}</span>
        </div>
      `;
    }).join('');

    wrap.innerHTML = `
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--texto-suave);margin-bottom:14px;">🏆 Ranking — Rodada Atual</div>
      ${linhas || '<div style="color:#aaa;font-size:13px;padding:10px 0;">Aguardando processamento da Rodada 1</div>'}
    `;
  }

  // ── INICIALIZAÇÃO PRINCIPAL ───────────────────────────────────────────────

  async function iniciar() {
    injetarCSS();

    const id = coopId();
    if (!id) {
      console.log('firebase-equipe.js: coopId não encontrado na sessão.');
      return;
    }

    const rodada = rodadaAtual();

    // Busca em paralelo: resultado da rodada + ranking + decisões anteriores
    const [resultado, rankingEquipes, decisoesR1] = await Promise.all([
      dbLerEquipe(`torneio/resultados/r${rodada}/resultados/${id}`),
      dbLerEquipe('torneio/ranking/equipes'),
      dbLerEquipe(`torneio/rodadas/r${rodada}/decisoes`),
    ]);

    // Monta histórico de decisões por rodada (para P&D acumulado)
    const decisoesHistorico = decisoesR1 ? { [`r${rodada}`]: decisoesR1 } : null;

    // Popula as 3 abas
    await Promise.all([
      popularFinanceiro(resultado, await dbLerEquipe('torneio/config')),
      popularContabil(resultado),
      popularComercio(resultado, decisoesHistorico),
    ]);

    // Atualiza ranking mini da aba Início
    await atualizarRankingMiniInicio(rankingEquipes, id);

    console.log(`🌿 firebase-equipe.js iniciado — coop: ${id} — rodada: ${rodada}`);
  }

  // Aguarda o DOM e os outros scripts (firebase.js, nav.js)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    // Pequeno delay para garantir que firebase.js já carregou
    setTimeout(iniciar, 100);
  }

})();
