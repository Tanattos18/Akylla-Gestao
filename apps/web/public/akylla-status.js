/* global window, document, fetch, URL, AbortController, setTimeout, clearTimeout */
/*
 * Akylla — status do site do cliente (2026-10-27).
 *
 * Colar no site do cliente (antes de </body>):
 *   <script src="https://app.akyllagestao.com.br/akylla-status.js" data-site="CHAVE" defer></script>
 *
 * Consulta GET /api/public/site-status/CHAVE (somente leitura, sem dados
 * pessoais) e:
 *   - "ativo": não faz nada;
 *   - "aviso": mostra uma faixa discreta de pagamento pendente (fechável);
 *   - "pausado"/"inativo": cobre a página com o aviso de site suspenso.
 * FALHA ABERTA: qualquer erro, demora (> 4 s) ou chave desconhecida deixa o
 * site exatamente como está. Nunca envia cookies nem dados do visitante.
 */
(function () {
  "use strict";
  try {
    var script = document.currentScript || document.querySelector("script[data-site][src*='akylla-status']");
    if (!script) return;
    var key = script.getAttribute("data-site");
    if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) return;
    var origin = new URL(script.src, window.location.href).origin;
    if (typeof fetch !== "function") return;

    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 4000);

    fetch(origin + "/api/public/site-status/" + encodeURIComponent(key), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        clearTimeout(timer);
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (!data || typeof data.status !== "string") return;
        var message = typeof data.message === "string" ? data.message : "";
        if (data.status === "aviso") return showBanner(message);
        if (data.status === "pausado" || data.status === "inativo") return showSuspended(message);
      })
      .catch(function () {
        clearTimeout(timer);
      });
  } catch {
    // falha aberta: o site segue normal
  }

  function onReady(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function showBanner(text) {
    onReady(function () {
      try {
        var bar = document.createElement("div");
        bar.setAttribute("role", "status");
        bar.style.cssText =
          "position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#fff7ed;color:#7c2d12;" +
          "border-top:1px solid #fdba74;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
          "padding:10px 44px 10px 16px;text-align:center;box-shadow:0 -2px 8px rgba(0,0,0,.08)";
        bar.textContent = text || "Pagamento pendente.";
        var close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Fechar aviso");
        close.textContent = "×";
        close.style.cssText =
          "position:absolute;right:12px;top:50%;transform:translateY(-50%);border:0;background:transparent;" +
          "color:#7c2d12;font-size:20px;cursor:pointer;line-height:1";
        close.onclick = function () {
          bar.remove();
        };
        bar.appendChild(close);
        document.body.appendChild(bar);
      } catch {
        // falha aberta
      }
    });
  }

  function showSuspended(text) {
    onReady(function () {
      try {
        var overlay = document.createElement("div");
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-live", "assertive");
        overlay.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;background:#f8fafc;display:flex;align-items:center;" +
          "justify-content:center;padding:24px;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a";
        var box = document.createElement("div");
        box.style.cssText =
          "max-width:440px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;" +
          "box-shadow:0 10px 30px rgba(15,23,42,.08)";
        var title = document.createElement("h1");
        title.textContent = "Site temporariamente suspenso";
        title.style.cssText = "font-size:20px;margin:0 0 12px;font-weight:600";
        var body = document.createElement("p");
        body.textContent = text || "Este site está temporariamente suspenso.";
        body.style.cssText = "margin:0;color:#475569";
        box.appendChild(title);
        box.appendChild(body);
        overlay.appendChild(box);
        document.documentElement.style.overflow = "hidden";
        document.body.appendChild(overlay);
      } catch {
        // falha aberta
      }
    });
  }
})();
