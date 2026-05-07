import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import App from "./App.jsx";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function Root() {
  // Three states: "loading" | "auth" | "app"
  const [screen, setScreen] = useState("loading");
  const [user, setUser]     = useState(null);

  useEffect(() => {
    // Check if already logged in from a previous session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setScreen("app");
      } else {
        setScreen("auth"); // No session — show login screen
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setScreen("app");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (screen === "loading") {
    return (
      <div style={{
        minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"#EAE4CE", fontFamily:"Nunito,sans-serif", color:"#5C6E6E", fontSize:16
      }}>
        ✿ Loading Haberdash Haven…
      </div>
    );
  }

  if (screen === "auth") {
    return (
      <App
        supabase={supabase}
        user={null}
        onGuestMode={()=>setScreen("app")}
        onSignIn={(u)=>{ setUser(u); setScreen("app"); }}
      />
    );
  }

  // screen === "app"
  return <App supabase={supabase} user={user} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
