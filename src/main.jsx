import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import App from "./App.jsx";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Root() {
  const [user, setUser]           = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Get current session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      // On sign-in, reload the page so all data loads fresh with the authenticated session
      if(event === "SIGNED_IN") {
        window.location.reload();
      }
      // On sign-out, reload to show auth screen cleanly
      if(event === "SIGNED_OUT") {
        window.location.reload();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div style={{
        minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"#EAE4CE", fontFamily:"Nunito,sans-serif", color:"#5C6E6E", fontSize:16
      }}>
        ✿ Loading Haberdash Haven…
      </div>
    );
  }

  return <App supabase={supabase} user={user} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
