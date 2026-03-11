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
    return setLogin(true);
  }

  function logout() {
    return setLogin(false);
  }

  /* =========================
     LOGIC STATE
  ========================= */
  function selectCategory(category) {
    return App.store?.dispatch?.({
      type: "SET_ACTIVE_CATEGORY",
      value:
        category === App.CFG.CATEGORY_ALL
          ? App.CFG.CATEGORY_ALL
          : App.util.normalizeCategory(category)
    });
  }

  function setCalendarMonth(date) {
    return App.store?.dispatch?.({
      type: "SET_CALENDAR_CURSOR",
      value: date
    });
  }

  function startEditingEvent(eventId) {
    return App.store?.dispatch?.({
      type: "SET_EDITING_EVENT_ID",
      value: eventId
    });
  }

  function stopEditingEvent() {
    return App.store?.dispatch?.({
      type: "SET_EDITING_EVENT_ID",
      value: null
    });
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
    return App.store?.dispatch?.({
      type: "SET_PENDING_DEEP_LINK_EVENT_ID",
      value: eventId
    });
  }

  function clearQueuedDeepLink() {
    return App.store?.dispatch?.({
      type: "CLEAR_PENDING_DEEP_LINK_EVENT_ID"
    });
  }

  function highlightPendingPopupEvent(eventId) {
    return App.store?.dispatch?.({
      type: "SET_PENDING_OPEN_EVENT_ID",
      value: eventId
    });
  }

  function clearPendingPopupEvent() {
    return App.store?.dispatch?.({
      type: "CLEAR_PENDING_OPEN_EVENT_ID"
    });
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