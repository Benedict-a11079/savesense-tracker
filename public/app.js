const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let state = {transactions:[],goals:[],budgets:[],settings:{currency:'INR',monthlyIncome:0}};
let cashChart, categoryChart, reportChart;
const colors = ['#39855f','#f29a83','#8c7bd7','#6eb6c6','#edc46d','#e28ab0','#7fa3e4','#9cc17b','#c29c83','#a2a8a3'];
const categoryIcons = {'Food & dining':'◉','Transport':'↗','Shopping':'◇','Bills & utilities':'▤','Housing':'⌂','Health':'✚','Education':'▣','Entertainment':'♫','Salary':'↙','Freelance':'✳','Investment':'↗','Goal contribution':'◎','Other':'•'};
const today = () => new Date().toISOString().slice(0,10);
const monthKey = (d=today()) => d.slice(0,7);
const monthLabel = key => new Date(key+'-02').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:state.settings.currency||'INR',maximumFractionDigits:0}).format(Number(n)||0);
const escapeHtml = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = arr => arr.reduce((a,b)=>a+Number(b.amount||0),0);
const txMonth = (m,type) => state.transactions.filter(t=>t.date.startsWith(m)&&(!type||t.type===type));
const setNotice = (msg,type='success') => {const n=$('#notice');n.textContent=msg;n.className='notice '+type;setTimeout(()=>n.classList.add('hidden'),3500)};
async function api(url,options={}) {
  const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data= res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text();
  if(!res.ok) throw new Error(data.error||'Something went wrong');
  return data;
}
async function load(){try{state=await api('/api/state');renderAll()}catch(e){setNotice('Could not load your data: '+e.message,'error')}}
function showView(view){
  $$('.view').forEach(v=>v.classList.add('hidden'));$('#view-'+view).classList.remove('hidden');
  $$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const titles={overview:'Good things are growing.',transactions:'Your money, in motion.',goals:'Every goal starts somewhere.',budgets:'Give every rupee a job.',reports:'Your money tells a story.',settings:'Your setup, your way.'};
  $('#page-title').innerHTML=escapeHtml(titles[view]||'SaveSense')+' <span>✳</span>';
  if(view==='reports') renderReports();
  if(view==='budgets') renderBudgets();
  if(view==='goals') renderGoals();
  if(view==='transactions') renderTransactions();
}
function renderAll(){ $('#month-label').textContent=monthLabel(monthKey()); $('#today-label').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();renderOverview();renderTransactions();renderGoals();renderBudgets();renderReports();renderSettings();fillMonthFilter(); }
function renderOverview(){
 const m=monthKey(), inc=sum(txMonth(m,'income')), exp=sum(txMonth(m,'expense')), saved=sum(txMonth(m,'saving'));
 const allInc=sum(state.transactions.filter(t=>t.type==='income')), allExp=sum(state.transactions.filter(t=>t.type==='expense')), allSav=sum(state.transactions.filter(t=>t.type==='saving'));
 $('#total-balance').textContent=money(allInc-allExp-allSav);
 $('#month-income').textContent=money(inc);$('#month-expense').textContent=money(exp);$('#month-saved').textContent=money(saved);
 const rate=inc?Math.max(0,Math.min(100,Math.round((saved/ inc)*100))):0;
 $('#savings-rate').textContent=rate+'% savings rate';$('#savings-rate-line').style.width=rate+'%';
 $('#donut-total').textContent=money(exp);
 const cats={};txMonth(m,'expense').forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
 const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
 if(categoryChart)categoryChart.destroy();
 categoryChart=new Chart($('#category-chart'),{type:'doughnut',data:{labels:sorted.map(x=>x[0]),datasets:[{data:sorted.map(x=>x[1]),backgroundColor:colors,borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'76%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}}}});
 $('#category-legend').innerHTML=sorted.length?sorted.slice(0,4).map(([name,val],i)=>`<div class="cat-row"><i class="cat-dot" style="background:${colors[i]}"></i><span>${escapeHtml(name)}</span><b>${money(val)}</b></div>`).join(''):'<div class="empty-state">Add expenses to see your breakdown.</div>';
 renderCashChart(Number($('#chart-period').value||6));
 $('#overview-goals').innerHTML=state.goals.length?state.goals.slice(0,3).map(g=>{const p=Math.min(100,Math.round(g.saved/g.target*100));return `<div><div class="goal-line-head"><b>${escapeHtml(g.name)}</b><span>${p}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><div class="goal-line-meta"><span>${money(g.saved)} saved</span><span>${money(g.target)} goal</span></div></div>`}).join(''):'<div class="empty-state">Create your first goal and give your savings a purpose.</div>';
 $('#recent-transactions').innerHTML=state.transactions.slice(0,5).map(transactionRow).join('')||'<div class="empty-state">No transactions yet. Add your first one.</div>';
}
function monthsBack(n){const a=[];const d=new Date();d.setDate(1);for(let i=n-1;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);a.push(x.toISOString().slice(0,7))}return a}
function renderCashChart(count=6){
 const months=monthsBack(count);if(cashChart)cashChart.destroy();
 cashChart=new Chart($('#cashflow-chart'),{type:'bar',data:{labels:months.map(m=>new Date(m+'-02').toLocaleDateString('en-IN',{month:'short'})),datasets:[{label:'Income',data:months.map(m=>sum(txMonth(m,'income'))),backgroundColor:'#39855f',borderRadius:4,barPercentage:.52},{label:'Expenses',data:months.map(m=>sum(txMonth(m,'expense'))),backgroundColor:'#f29a83',borderRadius:4,barPercentage:.52}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#9ba29c',font:{size:10}},border:{display:false}},y:{grid:{color:'#f0f2ee'},ticks:{color:'#9ba29c',font:{size:9},callback:v=>v>=1000?(v/1000)+'k':v},border:{display:false}}}}});
}
function transactionRow(t,actions=false){
 const icon=t.type==='income'?'↙':t.type==='saving'?'◎':'↗';
 const amount=(t.type==='income'?'+':t.type==='saving'?'↗ ':'−')+money(t.amount);
 return `<div class="transaction-row"><div class="transaction-symbol ${t.type}">${icon}</div><div class="transaction-info"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.category)} · ${new Date(t.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</small></div><div class="transaction-amount ${t.type}">${amount}</div>${actions?`<div class="table-actions"><button class="icon-btn" data-edit-tx="${t.id}">Edit</button><button class="icon-btn" data-delete-tx="${t.id}">×</button></div>`:''}</div>`;
}
function fillMonthFilter(){const sel=$('#filter-month');if(!sel)return;const old=sel.value;const ms=[...new Set(state.transactions.map(t=>t.date.slice(0,7)))].sort().reverse();sel.innerHTML='<option value="all">All months</option>'+ms.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');if(ms.includes(old))sel.value=old}
function renderTransactions(){
 const q=($('#transaction-search')?.value||'').toLowerCase(),type=$('#filter-type')?.value||'all',month=$('#filter-month')?.value||'all';
 const arr=state.transactions.filter(t=>(type==='all'||t.type===type)&&(month==='all'||t.date.startsWith(month))&&[t.title,t.category,t.note].some(x=>String(x||'').toLowerCase().includes(q)));
 $('#transaction-table').innerHTML=arr.map(t=>`<tr><td>${escapeHtml(t.title)}${t.note?`<div class="muted small">${escapeHtml(t.note)}</div>`:''}</td><td>${escapeHtml(t.category)}</td><td>${new Date(t.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td><td><span class="type-pill ${t.type}">${t.type}</span></td><td class="right">${money(t.amount)}</td><td><div class="table-actions"><button class="icon-btn" data-edit-tx="${t.id}">Edit</button><button class="icon-btn" data-delete-tx="${t.id}">Delete</button></div></td></tr>`).join('');
 $('#transaction-empty').classList.toggle('hidden',arr.length>0);
}
function renderGoals(){
 const goals=state.goals;$('#goals-total-saved').textContent=money(sum(goals.map(g=>({amount:g.saved}))));$('#goals-total-target').textContent=money(sum(goals.map(g=>({amount:g.target}))));$('#goals-completed').textContent=goals.filter(g=>g.saved>=g.target).length;
 $('#goals-list').innerHTML=goals.map((g,i)=>{const p=Math.min(100,Math.round(g.saved/g.target*100));const left=Math.max(0,g.target-g.saved);return `<article class="goal-card"><div class="goal-card-top"><div class="goal-emoji">${['✈','⌂','💻','🎓','🚲','✦'][i%6]}</div><button class="goal-menu" data-delete-goal="${g.id}" title="Delete goal">⋯</button></div><h3>${escapeHtml(g.name)}</h3><div class="goal-deadline">${g.deadline?'Target date: '+new Date(g.deadline+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Your future, on your terms'}</div><div class="goal-progress"><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div></div><div class="goal-figures"><b>${money(g.saved)}</b><span>of ${money(g.target)}</span></div><div class="goal-percent">${p}% complete · ${left?money(left)+' to go':'Goal reached! 🎉'}</div><div class="goal-actions"><button class="primary-btn" data-contribute="${g.id}">＋ Add money</button></div></article>`}).join('')||'<div class="panel empty-state budget-empty">No savings goals yet. Create one for a trip, gadget, education, or emergency fund.</div>';
}
function renderBudgets(){
 const m=monthKey(),bs=state.budgets.filter(b=>b.month===m),total=sum(bs),spent=b=>sum(txMonth(m,'expense').filter(t=>t.category===b.category));
 $('#budget-total').textContent=money(total);$('#budget-caption').textContent=bs.length?`${money(sum(bs.map(b=>({amount:Math.max(0,b.amount-spent(b))})) ))} remaining across ${bs.length} categories`:'Set category limits to get started.';
 $('#budgets-list').innerHTML=bs.map((b,i)=>{const used=spent(b),p=Math.round(used/b.amount*100),over=used>b.amount;return `<article class="budget-card"><div class="budget-card-head"><div class="budget-cat-icon">${categoryIcons[b.category]||'•'}</div><div><b>${escapeHtml(b.category)}</b><small>${monthLabel(b.month)}</small></div><button class="icon-btn" data-delete-budget="${b.id}">Remove</button></div><div class="budget-amounts"><b>${money(used)} <span style="font-weight:400">spent</span></b><span>of ${money(b.amount)}</span></div><div class="budget-track"><i class="${over?'over':''}" style="width:${Math.min(100,p)}%"></i></div><div class="budget-status ${over?'over':''}">${over?'Over budget by '+money(used-b.amount):money(b.amount-used)+' left'} · ${p}% used</div></article>`}).join('')||'<div class="panel empty-state budget-empty">No budgets for this month. Set a limit for food, shopping, transport or any category you want to manage.</div>';
}
function renderReports(){
 const inc=sum(state.transactions.filter(t=>t.type==='income')),exp=sum(state.transactions.filter(t=>t.type==='expense')),sav=sum(state.transactions.filter(t=>t.type==='saving'));
 $('#report-income').textContent=money(inc);$('#report-expense').textContent=money(exp);$('#report-savings').textContent=money(sav);$('#report-count').textContent=state.transactions.length;
 const months=monthsBack(6);if(reportChart)reportChart.destroy();
 reportChart=new Chart($('#report-chart'),{type:'line',data:{labels:months.map(m=>new Date(m+'-02').toLocaleDateString('en-IN',{month:'short'})),datasets:[{label:'Income',data:months.map(m=>sum(txMonth(m,'income'))),borderColor:'#39855f',backgroundColor:'#39855f12',fill:true,tension:.35},{label:'Expenses',data:months.map(m=>sum(txMonth(m,'expense'))),borderColor:'#f29a83',backgroundColor:'#f29a8312',fill:true,tension:.35},{label:'Savings',data:months.map(m=>sum(txMonth(m,'saving'))),borderColor:'#8c7bd7',backgroundColor:'#8c7bd712',fill:true,tension:.35}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:8,boxHeight:8,font:{size:10},usePointStyle:true}}},scales:{x:{grid:{display:false},ticks:{color:'#9ba29c',font:{size:10}},border:{display:false}},y:{grid:{color:'#f0f2ee'},ticks:{color:'#9ba29c',font:{size:9}},border:{display:false}}}}});
 const cats={};state.transactions.filter(t=>t.type==='expense').forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);const max=entries[0]?.[1]||1;
 $('#report-categories').innerHTML=entries.map(([c,v],i)=>`<div><div class="report-cat-head"><b>${escapeHtml(c)}</b><span>${money(v)}</span></div><div class="report-bar"><i style="width:${v/max*100}%;background:${colors[i%colors.length]}"></i></div></div>`).join('')||'<div class="empty-state">No expense data to report yet.</div>';
 const month=monthKey(),mi=sum(txMonth(month,'income')),me=sum(txMonth(month,'expense')),ms=sum(txMonth(month,'saving')),budget=state.budgets.filter(b=>b.month===month),over=budget.filter(b=>sum(txMonth(month,'expense').filter(t=>t.category===b.category))>b.amount);
 const insight=[];
 if(!state.transactions.length)insight.push('Start by adding income and expenses. Your reports will become more useful as you build a history.');
 else {insight.push(mi?`This month you have recorded ${money(mi)} in income and ${money(me)} in expenses.`:`You have ${state.transactions.length} recorded transactions. Add income to calculate a monthly savings rate.`);if(mi)insight.push(`Your recorded savings rate this month is ${Math.round(ms/mi*100)}%. A small, consistent amount is a good place to start.`);if(over.length)insight.push(`Heads up: ${over.map(b=>b.category).join(', ')} ${over.length===1?'is':'are'} over budget this month.`);if(entries[0])insight.push(`${entries[0][0]} is your largest recorded all-time expense category at ${money(entries[0][1])}.`);if(state.goals.length)insight.push(`${state.goals.filter(g=>g.saved>=g.target).length} of ${state.goals.length} savings goals completed.`)}
 $('#insights').innerHTML=insight.map(x=>`<div class="insight-item">• ${escapeHtml(x)}</div>`).join('');
}
function renderSettings(){$('#currency').value=state.settings.currency||'INR';$('#monthly-income').value=state.settings.monthlyIncome||''}
function openModal(id){$('#'+id).classList.remove('hidden')}
function closeModal(id){$('#'+id).classList.add('hidden')}
function openTransaction(t=null){
 $('#transaction-form').reset();$('#transaction-id').value=t?.id||'';$('#transaction-modal-title').textContent=t?'Edit transaction':'Add transaction';
 $('#tx-title').value=t?.title||'';$('#tx-type').value=t?.type||'expense';$('#tx-amount').value=t?.amount||'';$('#tx-category').value=t?.category||'Food & dining';$('#tx-date').value=t?.date||today();$('#tx-note').value=t?.note||'';openModal('transaction-modal');setTimeout(()=>$('#tx-title').focus(),50);
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
$('#add-transaction-top').onclick=()=>openTransaction();$('#add-transaction-page').onclick=()=>openTransaction();
$('#add-goal').onclick=()=>{$('#goal-form').reset();openModal('goal-modal')};
$('#add-budget').onclick=()=>{$('#budget-form').reset();openModal('budget-modal')};
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
$('#chart-period').addEventListener('change',e=>renderCashChart(Number(e.target.value)));
['transaction-search','filter-type','filter-month'].forEach(id=>$('#'+id).addEventListener(id==='transaction-search'?'input':'change',renderTransactions));
$('#transaction-form').addEventListener('submit',async e=>{
 e.preventDefault();const id=$('#transaction-id').value;const payload={title:$('#tx-title').value,type:$('#tx-type').value,amount:Number($('#tx-amount').value),category:$('#tx-category').value,date:$('#tx-date').value,note:$('#tx-note').value};
 try{await api(id?'/api/transactions/'+id:'/api/transactions',{method:id?'PUT':'POST',body:JSON.stringify(payload)});closeModal('transaction-modal');await load();setNotice(id?'Transaction updated':'Transaction added successfully')}catch(err){setNotice(err.message,'error')}
});
$('#goal-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/goals',{method:'POST',body:JSON.stringify({name:$('#goal-name').value,target:Number($('#goal-target').value),deadline:$('#goal-deadline').value})});closeModal('goal-modal');await load();showView('goals');setNotice('Savings goal created')}catch(err){setNotice(err.message,'error')}});
$('#contribute-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/goals/'+$('#contribute-id').value+'/contribute',{method:'PATCH',body:JSON.stringify({amount:Number($('#contribute-amount').value)})});closeModal('contribute-modal');await load();setNotice('Contribution added to your goal')}catch(err){setNotice(err.message,'error')}});
$('#budget-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/budgets/'+monthKey()+'/'+encodeURIComponent($('#budget-category').value),{method:'PUT',body:JSON.stringify({amount:Number($('#budget-amount').value)})});closeModal('budget-modal');await load();setNotice('Monthly budget saved')}catch(err){setNotice(err.message,'error')}});
$('#settings-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/settings',{method:'PATCH',body:JSON.stringify({currency:$('#currency').value,monthlyIncome:Number($('#monthly-income').value||0)})});await load();setNotice('Preferences saved')}catch(err){setNotice(err.message,'error')}});
document.addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-tx]');if(edit){const t=state.transactions.find(x=>x.id===edit.dataset.editTx);if(t)openTransaction(t);return}
 const del=e.target.closest('[data-delete-tx]');if(del){if(!confirm('Delete this transaction? This cannot be undone.'))return;try{await api('/api/transactions/'+del.dataset.deleteTx,{method:'DELETE'});await load();setNotice('Transaction deleted')}catch(err){setNotice(err.message,'error')}return}
 const contrib=e.target.closest('[data-contribute]');if(contrib){const g=state.goals.find(x=>x.id===contrib.dataset.contribute);$('#contribute-id').value=g.id;$('#contribute-name').textContent=g.name;$('#contribute-amount').value='';openModal('contribute-modal');return}
 const dg=e.target.closest('[data-delete-goal]');if(dg){if(!confirm('Delete this savings goal? Recorded transactions will remain.'))return;try{await api('/api/goals/'+dg.dataset.deleteGoal,{method:'DELETE'});await load();setNotice('Goal deleted')}catch(err){setNotice(err.message,'error')}return}
 const db=e.target.closest('[data-delete-budget]');if(db){if(!confirm('Remove this budget?'))return;try{await api('/api/budgets/'+db.dataset.deleteBudget,{method:'DELETE'});await load();setNotice('Budget removed')}catch(err){setNotice(err.message,'error')}}
});
$('#backup-data').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='savesense-backup-'+today()+'.json';a.click();URL.revokeObjectURL(url)};
$('#restore-file').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{const obj=JSON.parse(await file.text());if(!Array.isArray(obj.transactions)||!Array.isArray(obj.goals)||!Array.isArray(obj.budgets)||!obj.settings)throw new Error('This file does not look like a SaveSense backup.');
 if(!confirm('Restore this backup? It will replace your current local data.'))return;
 // Restore is intentionally implemented through a server endpoint in the local-only app.
 await api('/api/restore',{method:'POST',body:JSON.stringify(obj)});await load();setNotice('Backup restored successfully');
 }catch(err){setNotice(err.message,'error')}finally{e.target.value=''}
});
load();
