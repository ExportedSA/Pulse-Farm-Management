/* In your Header component file:
import GlobalSearch from "@/components/global/Search";
<button className="h-8 px-3 rounded-xl border border-border text-xs" onClick={()=> window.dispatchEvent(new KeyboardEvent('keydown', { key:'k', metaKey:true }))}>Search (⌘K)</button>
<GlobalSearch />
*/
