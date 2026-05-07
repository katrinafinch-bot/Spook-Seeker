import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import App from "./App.jsx";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Root() {
  const [user, setUser]         = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // If user signs out, exit guest mode and show auth screen
      if(_event === "SIGNED_OUT") setGuestMode(false);
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

  // Show app if logged in OR in guest mode
  if (user || guestMode) {
    return <App
      supabase={supabase}
      user={user}
      onGuestMode={()=>setGuestMode(true)}
      onSignIn={(u)=>{ setUser(u); setGuestMode(false); }}
    />;
  }

  // No session, not guest — show auth screen via App
  return <App
    supabase={supabase}
    user={null}
    onGuestMode={()=>setGuestMode(true)}
    onSignIn={(u)=>{ setUser(u); setGuestMode(false); }}
  />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
