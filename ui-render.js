// ui-render.js
(() => {
  "use strict";

  const App = window.App = window.App || {};
  App.ui = App.ui || {};

  function renderLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminView = document.getElementById("adminView");

    if (!loginBtn || !logoutBtn || !adminView) return;

    const isAdmin = !!App.events?.isAdminMode?.();
    const isLoggedIn = !!App.state?.logic?.isLoggedIn;

    if (!isAdmin) {
      loginBtn.hidden = true;
      logoutBtn.hidden = true;
      adminView.hidden = true;
      return;
    }

    loginBtn.hidden = isLoggedIn;
    logoutBtn.hidden = !isLoggedIn;
    adminView.hidden = !isLoggedIn;
  }

  function bindLoginUI() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!loginBtn || !logoutBtn) return;

    loginBtn.addEventListener("click", () => {
      App.actions?.login?.();
      App.ui?.renderLoginUI?.();
    });

    logoutBtn.addEventListener("click", () => {
      App.actions?.logout?.();
      App.ui?.renderLoginUI?.();
    });

    renderLoginUI();
  }

  App.ui.renderLoginUI = renderLoginUI;
  App.ui.bindLoginUI = bindLoginUI;
})();