// actions.js
(() => {
  "use strict";

  const App = window.App;

  /* =========================
     SESSION
  ========================= */
 function setLogin(isLoggedIn) {
  return App.events?.setLoginState?.(isLoggedIn);
}

async function login() {
  return await App.auth?.login?.();
}

async function logout() {
  return await App.auth?.logout?.();
}
  /* =========================
     LOGIC STATE
  ========================= */
function selectCategory(category) {
  return App.events?.setActiveCategory?.(category);
}

  function setCalendarMonth(date) {
  return App.events?.setCalendarCursor?.(date);
}

  function startEditingEvent(eventId) {
  return App.events?.setEditingEventId?.(eventId);
}

  function stopEditingEvent() {
  return App.events?.setEditingEventId?.(null);
}

function setEditingMode(mode) {
  return App.events?.setEditingMode?.(mode);
}

function setEditingSeriesId(seriesId) {
  return App.events?.setEditingSeriesId?.(seriesId);
}

  function setNearbyCenter(center) {
    return App.events?.setNearbyCenter?.(center);
  }

  function setNearbyEvents(list) {
    return App.events?.setNearbyEvents?.(list);
  }

  /* =========================
     RUNTIME
  ========================= */
  function queueDeepLink(eventId) {
  return App.events?.setPendingDeepLinkEventId?.(eventId);
}

  function clearQueuedDeepLink() {
  return App.events?.clearPendingDeepLinkEventId?.();
} 

  function highlightPendingPopupEvent(eventId) {
  return App.events?.setPendingOpenEventId?.(eventId);
}

 function clearPendingPopupEvent() {
  return App.events?.clearPendingOpenEventId?.();
}

  function setBootReady(flag) {
  return App.events?.setBootReady?.(flag);
}

  /* =========================
     INFRA / TRANSITION
  ========================= */
  function commitAndRender(opts = {}) {
  return App.events?.commit?.(opts);
}

  function saveAndRefresh(opts = {}) {
  return App.events?.saveAndRefresh?.(opts);
}

async function deleteEventFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  if (!App.util?.canManageUI?.()) {
    alert("No tenés permisos para borrar eventos.");
    return { ok: false, error: "FORBIDDEN" };
  }

  const eventId = decodeURIComponent(
    (btn.dataset.deleteEid || btn.dataset.eid || btn.dataset.id || "").trim()
  );

  if (!eventId) {
    return { ok: false, error: "MISSING_ID" };
  }

  const ev = App.events?.findEventById?.(eventId) || null;
  if (!ev) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const title = decodeURIComponent(
    (btn.dataset.deleteTitle || btn.dataset.title || ev.title || "").trim()
  );

  const seriesId = String(ev.seriesId || "").trim();
  const isRecurring = !!seriesId;

  let result = null;

  if (isRecurring) {
    const choice = window.prompt(
      `El evento "${title || "sin título"}" pertenece a una serie.\n\n` +
      `Escribí:\n` +
      `1 = borrar solo este evento\n` +
      `2 = borrar toda la serie`
    );

    if (choice === null) {
      return { ok: false, error: "CANCELLED" };
    }

    const normalizedChoice = String(choice).trim();

    if (normalizedChoice === "2") {
      const confirmSeries = confirm("¿Seguro que querés borrar toda la serie?");
      if (!confirmSeries) {
        return { ok: false, error: "CANCELLED" };
      }

      result = await App.events?.removeSeries?.(seriesId);

      if (!result?.ok) {
        alert("No se pudo borrar la serie.");
        return { ok: false, error: result?.error || "DELETE_SERIES_FAILED" };
      }
    } else if (normalizedChoice === "1") {
      const confirmSingle = confirm("¿Seguro que querés borrar solo este evento?");
      if (!confirmSingle) {
        return { ok: false, error: "CANCELLED" };
      }

      result = await App.events?.removeEvent?.(eventId);

      if (!result?.ok) {
        alert("No se pudo borrar el evento.");
        return { ok: false, error: result?.error || "DELETE_FAILED" };
      }
    } else {
      alert("Opción no válida. Escribí 1 o 2.");
      return { ok: false, error: "INVALID_CHOICE" };
    }
  } else {
    const msg = title
      ? `¿Seguro que querés borrar "${title}"?`
      : "¿Seguro que querés borrar este evento?";

    if (!confirm(msg)) {
      return { ok: false, error: "CANCELLED" };
    }

    result = await App.events?.removeEvent?.(eventId);

    if (!result?.ok) {
      alert("No se pudo borrar el evento.");
      return { ok: false, error: result?.error || "DELETE_FAILED" };
    }
  }

  if (App.state.logic.editingEventId === eventId) {
    App.actions?.stopEditingEvent?.();
    App.actions?.setEditingMode?.(null);
    App.actions?.setEditingSeriesId?.(null);
  }

  if (App.state.runtime.map) {
    App.state.runtime.map.closePopup();
  }

  App.commit?.({
    persist: false,
    purgePast: false,
    rebuildMarkers: true,
    recomputeNearby: true
  });

  return { ok: true, eventId, recurring: isRecurring };
}

async function shareEventFlow(input = {}) {
  const btn = input?.button || null;
  if (!btn) return { ok: false, error: "MISSING_BUTTON" };

  const eventId = decodeURIComponent((btn.dataset.eid || "").trim());
  if (!eventId) return { ok: false, error: "MISSING_ID" };

  const title = decodeURIComponent((btn.dataset.title || "").trim());
  const url = `${location.origin}${location.pathname}#e=${encodeURIComponent(eventId)}`;
  const shareText = title ? `Evento: ${title}\n${url}` : url;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title || "Evento",
        text: shareText,
        url
      });
      return { ok: true, mode: "native" };
    } catch {}
  }

  try {
    await navigator.clipboard.writeText(shareText);
    const prev = btn.textContent;
    btn.textContent = "Link copiado ✅";
    setTimeout(() => {
      btn.textContent = prev || "Compartir";
    }, 1200);
    return { ok: true, mode: "clipboard" };
  } catch {
    window.prompt("Copiá este link:", shareText);
    return { ok: true, mode: "prompt" };
  }
}

  App.actions = {
    setLogin,
    login,
    logout,

    selectCategory,
    setCalendarMonth,

    startEditingEvent,
    stopEditingEvent,

    setEditingMode,
    setEditingSeriesId,

    setNearbyCenter,
    setNearbyEvents,

    queueDeepLink,
    clearQueuedDeepLink,

    highlightPendingPopupEvent,
    clearPendingPopupEvent,

    setBootReady,

    commitAndRender,
    saveAndRefresh,
    deleteEventFlow,
    shareEventFlow
  };
})();