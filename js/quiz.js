(function () {
  "use strict";

  var QUESTIONS = [
    {
      kind: "msg",
      channel: "WhatsApp, número desconhecido",
      parts: [["Oi mãe, ", 0], ["troquei de número", 1], ["! Salva esse aqui. Preciso de um favor: ", 0], ["me faz um Pix de R$ 850 agora", 2], ["? ", 0], ["Não consigo atender ligação", 3], [", depois te explico.", 0]],
      answer: "golpe",
      notes: ["Número novo dizendo ser alguém da família.", "Pedido de dinheiro com urgência.", "Evita ligação para você não reconhecer a voz."]
    },
    {
      kind: "msg",
      channel: "SMS de número desconhecido",
      parts: [["CORREIOS: sua encomenda ", 0], ["foi retida", 1], [" por falta de pagamento da taxa de R$ 4,90. Regularize ", 0], ["em até 24h", 2], [": ", 0], ["correios-taxa-entrega.site/r8", 3]],
      answer: "golpe",
      notes: ["Um susto para você agir sem pensar.", "Prazo curto para pressionar.", "O endereço não é o site oficial dos Correios."]
    },
    {
      kind: "msg",
      channel: "SMS do número oficial do banco",
      parts: [["Seu código de verificação é 482913. Não compartilhe este código com ninguém, nem com funcionários do banco.", 0]],
      answer: "seguro",
      notes: ["Não tem link nem pede resposta.", "É o código que você mesmo pediu ao entrar no aplicativo.", "Vira golpe se alguém pedir esse código depois."]
    },
    {
      kind: "call",
      channel: "Ligação da \"central de segurança\"",
      parts: [["Aqui é da central de segurança do seu banco. Identificamos ", 0], ["uma compra suspeita de R$ 2.300", 1], [". Para cancelar, ", 0], ["transfira seu saldo para uma conta de segurança", 2], [" e ", 0], ["me informe o código que vai chegar por SMS", 3], [".", 0]],
      answer: "golpe",
      notes: ["Susto com um valor alto.", "Banco nenhum pede transferência para conta de segurança.", "Código recebido por SMS nunca deve ser passado a ninguém."]
    },
    {
      kind: "app",
      channel: "Notificação no aplicativo oficial do banco",
      parts: [["Sua fatura de outubro está disponível. Confira os detalhes na área de cartões do aplicativo.", 0]],
      answer: "seguro",
      notes: ["Chegou dentro do aplicativo oficial, não por SMS ou WhatsApp.", "Não tem link e não pede dados nem pagamento imediato."]
    }
  ];

  var TOTAL = QUESTIONS.length;
  var TYPING_MS = 800;

  function icon(id, size, extraClass) {
    return '<svg width="' + size + '" height="' + size + '"' + (extraClass ? ' class="' + extraClass + '"' : "") +
      ' aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) {
    reduced = false;
  }

  var state = { idx: 0, picked: null, score: 0, done: false, typing: false, results: [] };
  var timer = null;
  var lastTextKey = "";
  var lastFeedbackKey = "";

  function byId(id) {
    return document.getElementById(id);
  }

  var el = {
    main: byId("quiz-main"),
    done: byId("quiz-done"),
    bar: byId("quiz-bar"),
    progress: byId("quiz-progress"),
    score: byId("quiz-score"),
    iconCall: byId("quiz-icon-call"),
    iconMsg: byId("quiz-icon-msg"),
    iconApp: byId("quiz-icon-app"),
    channel: byId("quiz-channel"),
    typing: byId("quiz-typing"),
    bubble: byId("quiz-bubble"),
    text: byId("quiz-text"),
    btnGolpe: byId("quiz-golpe"),
    btnSeguro: byId("quiz-seguro"),
    feedback: byId("quiz-feedback"),
    finalScore: byId("quiz-final-score"),
    finalMsg: byId("quiz-final-msg"),
    dots: byId("quiz-dots"),
    restart: byId("quiz-restart")
  };

  if (!el.main) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setVisible(node, visible) {
    if (visible) node.removeAttribute("hidden");
    else node.setAttribute("hidden", "");
  }

  function seconds(value) {
    return value.toFixed(2) + "s";
  }

  function partsHtml(question, answered) {
    return question.parts.map(function (part) {
      var text = escapeHtml(part[0]);
      var mark = part[1];
      if (!(answered && mark > 0)) return "<span>" + text + "</span>";
      var delay = 0.1 + (mark - 1) * 0.22;
      return '<span class="mark" style="animation-delay: ' + seconds(delay) + '">' + text + "</span>" +
        '<sup class="mark-num pop" style="animation-delay: ' + seconds(delay + 0.3) + '">' + mark + "</sup>";
    }).join("");
  }

  function feedbackHtml(question, correct, isGolpe, isLast) {
    var title = isGolpe ? "Errou. É golpe." : "Errou. Essa mensagem é segura.";
    if (correct) title = isGolpe ? "Acertou. É golpe." : "Acertou. É seguro.";

    var notes = question.notes.map(function (text, i) {
      var delay = isGolpe ? 0.35 + i * 0.22 : 0.2 + i * 0.1;
      var marker = isGolpe
        ? '<span class="note-num">' + (i + 1) + "</span>"
        : icon("i-check", 16, "note-check");
      return '<li class="rise-in" style="animation-delay: ' + seconds(delay) + '">' +
        marker + "<span>" + escapeHtml(text) + "</span></li>";
    }).join("");

    var count = question.notes.length;
    var lastNote = isGolpe ? 0.35 + (count - 1) * 0.22 : 0.2 + (count - 1) * 0.1;

    return '<div class="feedback-head">' +
      '<span class="feedback-icon">' + icon(correct ? "i-check" : "i-x", 20) + "</span>" +
      '<p class="feedback-title">' + escapeHtml(title) + "</p>" +
      "</div>" +
      '<p class="feedback-sub">' + (isGolpe ? "O que entrega o golpe" : "Por que é segura") + "</p>" +
      '<ul class="feedback-notes">' + notes + "</ul>" +
      '<button type="button" id="quiz-next" class="btn btn-primary rise-in" style="animation-delay: ' + seconds(lastNote + 0.2) + '">' +
      (isLast ? "Ver resultado" : "Próxima mensagem") + " " + icon("i-arrow", 18) + "</button>";
  }

  function finalMessage(score) {
    if (score <= 2) return "Esses golpes enganam muita gente. Veja os sinais de alerta abaixo e tente de novo.";
    if (score < TOTAL) return "Bom resultado. Releia os sinais de alerta para não deixar passar nenhum.";
    return "Você reconheceu todas. Compartilhe esta página com quem pode cair nesses golpes.";
  }

  function styleButton(button, chosen, answered, locked) {
    button.classList.toggle("is-chosen", chosen);
    button.classList.toggle("is-dim", answered && !chosen);
    button.setAttribute("aria-pressed", chosen ? "true" : "false");
    button.disabled = locked;
  }

  function render() {
    var question = QUESTIONS[Math.min(state.idx, TOTAL - 1)];
    var answered = !!state.picked;
    var correct = answered && state.picked === question.answer;
    var isGolpe = question.answer === "golpe";
    var isLast = state.idx === TOTAL - 1;

    setVisible(el.main, !state.done);
    setVisible(el.done, state.done);

    if (state.done) {
      el.finalScore.textContent = state.score + " de " + TOTAL;
      el.finalMsg.textContent = finalMessage(state.score);
      el.dots.innerHTML = state.results.map(function (hit) {
        return '<li class="' + (hit ? "hit" : "miss") + '"></li>';
      }).join("");
      return;
    }

    el.bar.style.width = Math.round(((state.idx + (answered ? 1 : 0)) / TOTAL) * 100) + "%";
    el.progress.textContent = "Mensagem " + (state.idx + 1) + " de " + TOTAL;
    el.score.textContent = "Acertos: " + state.score;

    setVisible(el.iconCall, question.kind === "call");
    setVisible(el.iconMsg, question.kind === "msg");
    setVisible(el.iconApp, question.kind === "app");
    el.channel.textContent = question.channel;

    setVisible(el.typing, state.typing);
    setVisible(el.bubble, !state.typing);

    var textKey = state.idx + ":" + (answered ? 1 : 0);
    if (textKey !== lastTextKey) {
      el.text.innerHTML = partsHtml(question, answered);
      lastTextKey = textKey;
    }

    var locked = answered || state.typing;
    styleButton(el.btnGolpe, state.picked === "golpe", answered, locked);
    styleButton(el.btnSeguro, state.picked === "seguro", answered, locked);

    if (answered) {
      var feedbackKey = state.idx + ":" + state.picked;
      if (feedbackKey !== lastFeedbackKey) {
        el.feedback.innerHTML = feedbackHtml(question, correct, isGolpe, isLast);
        el.feedback.classList.toggle("is-right", correct);
        el.feedback.classList.toggle("is-wrong", !correct);
        lastFeedbackKey = feedbackKey;
      }
      setVisible(el.feedback, true);
    } else {
      setVisible(el.feedback, false);
      lastFeedbackKey = "";
    }
  }

  function setState(patch) {
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) state[key] = patch[key];
    }
    render();
  }

  function focusSoon(node) {
    if (!node) return;
    window.requestAnimationFrame(function () {
      try {
        node.focus({ preventScroll: true });
      } catch (e) {
        node.focus();
      }
    });
  }

  function goTo(idx, extra, moveFocus) {
    if (timer) clearTimeout(timer);
    var typing = !reduced;
    var patch = { idx: idx, picked: null, typing: typing };
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) patch[key] = extra[key];
      }
    }
    setState(patch);
    if (typing) {
      timer = setTimeout(function () {
        timer = null;
        setState({ typing: false });
        if (moveFocus) focusSoon(el.btnGolpe);
      }, TYPING_MS);
    } else if (moveFocus) {
      focusSoon(el.btnGolpe);
    }
  }

  function choose(option) {
    if (state.picked || state.typing) return;
    var right = option === QUESTIONS[state.idx].answer;
    setState({
      picked: option,
      score: state.score + (right ? 1 : 0),
      results: state.results.concat([right])
    });
    focusSoon(byId("quiz-next"));
  }

  function next() {
    if (state.idx === TOTAL - 1) {
      setState({ done: true });
      focusSoon(el.finalScore);
    } else {
      goTo(state.idx + 1, null, true);
    }
  }

  el.btnGolpe.addEventListener("click", function () {
    choose("golpe");
  });
  el.btnSeguro.addEventListener("click", function () {
    choose("seguro");
  });
  el.feedback.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.closest && target.closest("#quiz-next")) next();
  });
  el.restart.addEventListener("click", function () {
    goTo(0, { score: 0, done: false, results: [] }, true);
  });

  render();

  /* Compartilhar a página ------------------------------------------------ */

  var shareBtn = byId("share-btn");
  var shareStatus = byId("share-status");

  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var url = window.location.href.split("#")[0];
      var data = {
        title: "Golpe ou não?",
        text: "Faça o teste e aprenda a reconhecer golpes por WhatsApp, SMS e ligação.",
        url: url
      };

      function say(message) {
        if (shareStatus) shareStatus.textContent = message;
      }

      if (navigator.share) {
        navigator.share(data).catch(function () {});
        return;
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () {
          say("Link copiado. Agora é só colar na conversa.");
        }, function () {
          window.open("https://wa.me/?text=" + encodeURIComponent(data.text + " " + url), "_blank", "noopener");
        });
        return;
      }
      window.open("https://wa.me/?text=" + encodeURIComponent(data.text + " " + url), "_blank", "noopener");
    });
  }
})();
