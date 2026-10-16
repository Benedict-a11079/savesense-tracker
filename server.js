const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seed = {
  transactions: [],
  goals: [],
  budgets: [],
  settings: { currency: 'INR', monthlyIncome: 0 }
};
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));

function readStore() {
  try { return { ...seed, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { return structuredClone(seed); }
}
function writeStore(store) {
  const temp = DB_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function id() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function number(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
function validDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)); }
function fail(res, message, status=400) { return res.status(status).json({ error: message }); }

app.get('/api/state', (req, res) => res.json(readStore()));

app.patch('/api/settings', (req, res) => {
  const s = readStore();
  const { currency, monthlyIncome } = req.body || {};
  if (currency && !['INR','USD','EUR','GBP','SGD','AED'].includes(currency)) return fail(res, 'Unsupported currency');
  if (monthlyIncome !== undefined && !number(monthlyIncome)) return fail(res, 'Monthly income must be a non-negative number');
  s.settings = { ...s.settings, ...(currency ? {currency} : {}), ...(monthlyIncome !== undefined ? {monthlyIncome} : {}) };
  writeStore(s); res.json(s.settings);
});

app.post('/api/transactions', (req, res) => {
  const b = req.body || {};
  if (!['income','expense','saving'].includes(b.type)) return fail(res, 'Choose income, expense, or saving');
  if (!number(b.amount) || b.amount <= 0) return fail(res, 'Amount must be greater than zero');
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.trim().length > 100) return fail(res, 'Title is required (max 100 characters)');
  if (!validDate(b.date)) return fail(res, 'Use a valid date');
  const s = readStore();
  const item = { id: id(), title: b.title.trim(), type: b.type, amount: b.amount, category: String(b.category || 'Other').slice(0,50), date: b.date, note: String(b.note || '').slice(0,300), createdAt: new Date().toISOString() };
  s.transactions.unshift(item); writeStore(s); res.status(201).json(item);
});
app.put('/api/transactions/:id', (req, res) => {
  const s = readStore(), i = s.transactions.findIndex(x => x.id === req.params.id);
  if (i < 0) return fail(res, 'Transaction not found', 404);
  const b = req.body || {};
  if (!['income','expense','saving'].includes(b.type)) return fail(res, 'Invalid type');
  if (!number(b.amount) || b.amount <= 0 || !validDate(b.date) || typeof b.title !== 'string' || !b.title.trim()) return fail(res, 'Check title, amount and date');
  s.transactions[i] = { ...s.transactions[i], title: b.title.trim().slice(0,100), type:b.type, amount:b.amount, category:String(b.category||'Other').slice(0,50), date:b.date, note:String(b.note||'').slice(0,300) };
  writeStore(s); res.json(s.transactions[i]);
});
app.delete('/api/transactions/:id', (req, res) => {
  const s = readStore(), before = s.transactions.length;
  s.transactions = s.transactions.filter(x => x.id !== req.params.id);
  if (before === s.transactions.length) return fail(res, 'Transaction not found', 404);
  writeStore(s); res.json({ ok:true });
});

app.post('/api/goals', (req, res) => {
  const b = req.body || {};
  if (!b.name || typeof b.name !== 'string' || !b.name.trim()) return fail(res, 'Goal name is required');
  if (!number(b.target) || b.target <= 0) return fail(res, 'Target must be greater than zero');
  const s = readStore();
  const goal = { id:id(), name:b.name.trim().slice(0,80), target:b.target, saved:0, deadline:validDate(b.deadline)?b.deadline:null, color:['violet','blue','green','orange','pink'][Math.floor(Math.random()*5)], createdAt:new Date().toISOString() };
  s.goals.unshift(goal); writeStore(s); res.status(201).json(goal);
});
app.patch('/api/goals/:id/contribute', (req, res) => {
  const s = readStore(), g = s.goals.find(x => x.id === req.params.id);
  if (!g) return fail(res, 'Goal not found', 404);
  const amount = req.body && req.body.amount;
  if (!number(amount) || amount <= 0) return fail(res, 'Contribution must be greater than zero');
  g.saved = Math.round((g.saved + amount) * 100) / 100;
  const t = { id:id(), title:`Contribution: ${g.name}`, type:'saving', amount, category:'Goal contribution', date:new Date().toISOString().slice(0,10), note:'Savings goal contribution', goalId:g.id, createdAt:new Date().toISOString() };
  s.transactions.unshift(t); writeStore(s); res.json(g);
});
app.delete('/api/goals/:id', (req, res) => {
  const s = readStore(), n=s.goals.length;
  s.goals=s.goals.filter(x=>x.id!==req.params.id);
  if(n===s.goals.length) return fail(res,'Goal not found',404);
  writeStore(s); res.json({ok:true});
});

app.put('/api/budgets/:month/:category', (req, res) => {
  const { month, category } = req.params, amount = req.body && req.body.amount;
  if (!/^\d{4}-\d{2}$/.test(month) || !category || !number(amount) || amount <= 0) return fail(res, 'Enter a valid month, category and budget amount');
  const s=readStore(), key=decodeURIComponent(category);
  const old=s.budgets.find(x=>x.month===month && x.category===key);
  if(old) old.amount=amount; else s.budgets.push({id:id(),month,category:key,amount});
  writeStore(s); res.json({month,category:key,amount});
});
app.delete('/api/budgets/:id', (req,res)=>{
  const s=readStore(), n=s.budgets.length; s.budgets=s.budgets.filter(x=>x.id!==req.params.id);
  if(n===s.budgets.length) return fail(res,'Budget not found',404);
  writeStore(s); res.json({ok:true});
});
app.get('/api/export', (req,res) => {
  const s=readStore();
  const rows=[['Date','Title','Type','Category','Amount','Note'],...s.transactions.map(t=>[t.date,t.title,t.type,t.category,t.amount,t.note])];
  const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="savesense-transactions.csv"');
  res.send('\uFEFF'+csv);
});
app.post('/api/restore', (req,res) => {
  const b=req.body||{};
  if(!Array.isArray(b.transactions)||!Array.isArray(b.goals)||!Array.isArray(b.budgets)||!b.settings) return fail(res,'Invalid SaveSense backup');
  if(b.transactions.length>20000||b.goals.length>2000||b.budgets.length>5000) return fail(res,'Backup is too large');
  const clean={transactions:b.transactions,goals:b.goals,budgets:b.budgets,settings:{...seed.settings,...b.settings}};
  writeStore(clean); res.json({ok:true});
});
app.get('/api/health', (req,res)=>res.json({ok:true, app:'SaveSense'}));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, ()=>console.log(`SaveSense running at http://localhost:${PORT}`));
