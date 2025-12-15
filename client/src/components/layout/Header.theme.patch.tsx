/* In your Header right controls:
import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "@/theme/darkmode";
export function HeaderThemeToggle(){
  const [t,setT] = useState(getTheme());
  useEffect(()=>{ const cb = ()=> setT(getTheme()); window.addEventListener('themechange', cb); return ()=> window.removeEventListener('themechange', cb); }, []);
  return <button className="h-8 px-3 rounded-xl border border-border text-xs" onClick={()=> toggleTheme()}>{t==='dark'?'Light':'Dark'}</button>;
}
*/
