//auth-service.js
(() => {
  "use strict";

  const App = window.App = window.App || {};

  async function syncSessionToState() {
  if (!App.supabase?.auth) {
    return { ok: false, error: "SUPABASE_AUTH_NOT_READY" };
  }

  const { data: sessionData, error: sessionError } = await App.supabase.auth.getSession();

  if (sessionError) {
    App.store?.dispatch?.({
      type: "SET_LOGIN_STATE",
      value: false
    });

    return { ok: false, error: sessionError };
  }

  const isLoggedIn = !!sessionData?.session?.user;

console.log("[AUTH] session check:", {
  session: sessionData?.session,
  isLoggedIn
});

App.store?.dispatch?.({
  type: "SET_LOGIN_STATE",
  value: isLoggedIn
});

return {
  ok: true,
  isLoggedIn,
  user: sessionData?.session?.user || null
};
}

  async function login() {
  if (!App.supabase?.auth) {
    return { ok: false, error: "SUPABASE_AUTH_NOT_READY" };
  }

  const email = window.prompt("Email admin:");
  if (!email) return { ok: false, error: "MISSING_EMAIL" };

  const password = window.prompt("Contraseña:");
  if (!password) return { ok: false, error: "MISSING_PASSWORD" };

  console.log("[AUTH] intentando login...", { email });

  const { data, error } = await App.supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  console.log("[AUTH] login response:", { data, error });

  if (error) {
    console.error("Error de login:", error);
    return { ok: false, error };
  }

  return await syncSessionToState();
}

 async function logout() {
  if (!App.supabase?.auth) {
    return { ok: false, error: "SUPABASE_AUTH_NOT_READY" };
  }

  console.log("[AUTH] intentando logout...");

  const { error } = await App.supabase.auth.signOut({ scope: "local" });

  console.log("[AUTH] logout response:", { error });

  if (error) {
    console.error("Error de logout:", error);
    return { ok: false, error };
  }

  const sync = await syncSessionToState();

  console.log("[AUTH] post-logout sync:", sync);

  if (!sync?.ok) {
    App.store?.dispatch?.({
      type: "SET_LOGIN_STATE",
      value: false
    });
  }

  return { ok: true };
}

 function bindAuthListener() {
  if (!App.supabase?.auth) return;

  App.supabase.auth.onAuthStateChange((_event, _session) => {
    setTimeout(async () => {
      await syncSessionToState();

      App.commit?.({
        persist: false,
        purgePast: false,
        rebuildMarkers: true,
        recomputeNearby: true
      });
    }, 0);
  });
}

  App.auth = {
    login,
    logout,
    syncSessionToState,
    bindAuthListener
  };
})();