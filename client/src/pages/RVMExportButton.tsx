import { useState } from "react";
export default function RVMExportButton(){
  const [from,setFrom] = useState(()=> new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const [to,setTo] = useState(()=> new Date().toISOString().slice(0,10));
  async function exportCSV(){
    const r = await fetch(`/api/med/reports/rvm?from=${from}&to=${to}`).then(r=> r.json());
    const rows = r.rows||[]; const header = ['When','Animal','Medicine','Dose','Route','Site','Vet','Ref'];
    const csv = [header.join(',')].concat(rows.map((x:any)=> [new Date(x.ts).toISOString(), x.animal_id, JSON.stringify(x.medicine||''), JSON.stringify(x.dose||''), JSON.stringify(x.route||''), JSON.stringify(x.site||''), JSON.stringify(x.approver||''), JSON.stringify(x.approval_ref||'')].join(','))).join('\n');
    const blob = new Blob([csv], { type:'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RVM_${from}_${to}.csv`; a.click();
  }
  function printView(){ window.open(`/health/reports?from=${from}&to=${to}`, '_blank'); }
  return (<div className="flex items-center gap-2">
    <input type="date" className="h-8 rounded-xl border border-border bg-card px-3 text-sm" value={from} onChange={e=> setFrom(e.target.value)} />
    <input type="date" className="h-8 rounded-xl border border-border bg-card px-3 text-sm" value={to} onChange={e=> setTo(e.target.value)} />
    <button className="h-8 px-3 rounded-xl border border-border text-xs" onClick={exportCSV}>Export CSV</button>
    <button className="h-8 px-3 rounded-xl border border-border text-xs" onClick={printView}>Print View</button>
  </div>);
}
