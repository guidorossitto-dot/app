// actions.js
(() => {
  "use strict";

  const App = window.App;

  /* =========================
     SESSION
  ========================= */
  function setLogin(isLoggedIn) {
    return App.events?.setLoginState?.(!!isLoggedIn);
  }

  function login() {
  return App.events?.login?.();
}

function logout() {
  return App.events?.logout?.();
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
    return App.store?.dispatch?.({
      type: "SET_BOOT_READY",
      value: flag
    });
  }

  /* =========================
     INFRA / TRANSITION
  ========================= */
  function commitAndRender(opts = {}) {
    return App.commit?.(opts);
  }

  function saveAndRefresh(opts = {}) {
    return App.commit?.({
      persist: true,
      purgePast: false,
      rebuildMarkers: true,
      recomputeNearby: true,
      ...opts
    });
  }

  App.actions = {
    setLogin,
    login,
    logout,

    selectCategory,
    setCalendarMonth,

    startEditingEvent,
    stopEditingEvent,

    setNearbyCenter,
    setNearbyEvents,

    queueDeepLink,
    clearQueuedDeepLink,

    highlightPendingPopupEvent,
    clearPendingPopupEvent,

    setBootReady,

    commitAndRender,
    saveAndRefresh
  };
})();