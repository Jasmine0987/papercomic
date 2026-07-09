import { useEffect } from "react";

export default function OAuthCallback({ onNavigate }) {
  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      
      if (!code) {
        alert("OAuth failed");
        onNavigate("/signup");
        return;
      }
      
      try {
        const res = await fetch("https://papercomic-api.onrender.com/api/auth/google/callback?" + params, {
          method: "GET",
          credentials: "include",
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);
        
        localStorage.setItem("pc_token", data.access_token);
        onNavigate("/upload");
      } catch (err) {
        alert("OAuth error: " + err.message);
        onNavigate("/signup");
      }
    };
    
    processCallback();
  }, [onNavigate]);
  
  return <div style={{ textAlign: "center", padding: "40px", fontSize: "18px" }}>Logging in...</div>;
}