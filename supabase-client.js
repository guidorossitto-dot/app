(() => {
  "use strict";

  const App = window.App = window.App || {};

  const SUPABASE_URL = "https://dsyfwwmqvefnaasdjuho.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzeWZ3d21xdmVmbmFhc2RqdWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzc1MjYsImV4cCI6MjA4ODgxMzUyNn0.PNhXVU7-5wx2r4bwa166Bnd34TO6Nu7IRf7J4loNlss";

  const { createClient } = window.supabase;

  App.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
})();