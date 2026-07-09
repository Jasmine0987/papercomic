import { useEffect } from "react";

export default function OAuthCallback({ onNavigate }) {
  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      
      if (!code) {
        alert("OAuth failed: no code received");
        window.location.href = "/signup";
        return;
      }
      
      try {
        const res = await fetch("https://papercomic-api.onrender.com/api/auth/google/callback", {
          method: "GET",
          credentials: "include",  // Include cookies for state validation
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "OAuth failed");
        
        localStorage.setItem("pc_token", data.access_token);
        onNavigate("/upload");
      } catch (err) {
        alert(`OAuth error: ${err.message}`);
        window.location.href = "/signup";
      }
    };
    
    processCallback();
  }, [onNavigate]);
  
  return <div>Logging in...</div>;
}