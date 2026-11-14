export const monthStart=date=>date.slice(0,7)+'-01';
export function shiftMonths(date,n){const[y,m]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,10)}
export function monthDistance(a,b){const[ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number);return (by-ay)*12+bm-am}
export function rollRange(range,direction){let{start,end}=range;if(direction==='next'){end=shiftMonths(end,3);if(monthDistance(start,end)>12)start=shiftMonths(end,-12)}else{start=shiftMonths(start,-3);if(monthDistance(start,end)>12)end=shiftMonths(start,12)}return{start,end}}
export function weatherFlags(day){return{rain:typeof day?.rain==='number'&&day.rain>20,freeze:typeof day?.low==='number'&&day.low<32}}
// FullCalendar chooses a single horizontal day row for non-whole-week ranges.
// Pad the rendered range to Mondays; validRange still clips the exact job limits.
export function weekAlignedRange(range){const monday=d=>{const date=new Date(d+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10)};const start=monday(range.start);let end=monday(range.end);if(end<range.end){const date=new Date(end+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+7);end=date.toISOString().slice(0,10)}return{start,end}}
