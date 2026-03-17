// app-init.js
(() => {
  "use strict";

  const App = window.App;
  const { state } = App;

  async function hydrateInitialState() {

  const venuesRemote = await App.venues.loadVenuesRemote();

  if (!venuesRemote?.ok) {
    await App.storage?.loadVenues?.();
  }

  const loadedEvents = await App.storage.loadEvents();

  if (loadedEvents?.ok) {
    App.events?.setAllEvents?.(loadedEvents.events || []);
  } else {
    App.events?.setAllEvents?.([]);
  }

  (state.logic.events || []).forEach((ev) => {
    if (!ev?.placeName || !Number.isFinite(ev?.lat) || !Number.isFinite(ev?.lng)) return;

    App.venues.addVenue(
      { name: ev.placeName, address: ev.placeName, lat: ev.lat, lng: ev.lng },
      { persist: false }
    );
  });

  await App.auth?.syncSessionToState?.();
  
  const purged = App.events.purgePastEventsInState();
  if (purged?.changed) {
    console.warn("Hay eventos pasados en estado.");
  }

  App.events.setCalendarCursor(new Date());
}

  function bindUI() {
  App.ui.bindLoginUI();
  App.ui.bindPublicUI();
  App.ui.bindSidebarUI();
  App.ui.bindCalendarUI();
  App.ui.bindCategoryUI();
  App.ui.bindDeleteEventUI();
  App.ui.bindAdminUI();
}

  function initMapState() {
    App.map.bindAdminCategoryChips();
    App.map.initMap(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.setUserLocation(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
    App.map.recomputeNearbyEvents(App.CFG.DEFAULT_LAT, App.CFG.DEFAULT_LNG);
  }

  function startAutoRefresh() {
    setInterval(() => {
      if (state.logic.nearbyCenter) {
  App.map.recomputeNearbyEvents(
    state.logic.nearbyCenter.lat,
    state.logic.nearbyCenter.lng
  );
}

        App.renderAll?.({ rebuildMarkers: false });
    }, App.CFG.REFRESH_MS);
  }

  async function bootAfterMapReady() {
    if (state.runtime.bootReady) return;

    await hydrateInitialState();
      bindUI();
      App.auth?.bindAuthListener?.();
      initMapState();

      App.renderAll({ rebuildMarkers: true });

      App.events?.setBootReady?.(true);

      App.ui.processQueuedDeepLink();
      startAutoRefresh();
  }

  App.init = App.init || {};
  App.init.bootAfterMapReady = bootAfterMapReady;

document.addEventListener("DOMContentLoaded", async () => {
  await App.init.bootAfterMapReady();
  });
})();