const key = 'theme';

function apply(t:'dark'|'light'){
  const root = document.documentElement;
  if (t==='dark'){ root.classList.add('dark'); } else { root.classList.remove('dark'); }
  localStorage.setItem(key, t);
  window.dispatchEvent(new Event('themechange'));
}

export function getTheme(): 'dark'|'light'{
  if (typeof window==='undefined') return 'light';
  const saved = (localStorage.getItem(key) as any) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');
  return (saved==='dark'?'dark':'light');
}

export function toggleTheme(){
  apply(getTheme()==='dark'?'light':'dark');
}

if (typeof window!=='undefined'){
  apply(getTheme());
}
