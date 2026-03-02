document.addEventListener("DOMContentLoaded", function(){

const PALETA=['#00d4aa','#7c6fe0','#ff6b6b','#ffd166','#06d6a0','#118ab2','#ef476f','#f78c6b','#88d498','#c77dff','#48cae4','#f4a261','#e76f51','#2ec4b6','#e9c46a','#a8dadc','#457b9d','#e63946','#2a9d8f','#f3722c'];
const genColores=n=>Array.from({length:n},(_,i)=>PALETA[i%PALETA.length]);

let charts={},filtrosActivos={},exclusiones={},modoOscuro=true,tablaDT;
let historial=[],historialIdx=-1;

const getLegendColor=()=>modoOscuro?'#e0e0f0':'#1a1a2e';
const getGridColor=()=>modoOscuro?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)';

function guardarEstado(){
 try{
  const ex={}; for(const k in exclusiones) ex[k]=[...exclusiones[k]];
  localStorage.setItem('ct_filtros',JSON.stringify(filtrosActivos));
  localStorage.setItem('ct_excl',JSON.stringify(ex));
 }catch(e){}
}
function cargarEstado(){
 try{
  const f=localStorage.getItem('ct_filtros');
  const e=localStorage.getItem('ct_excl');
  if(f) filtrosActivos=JSON.parse(f);
  if(e){const r=JSON.parse(e);for(const k in r) exclusiones[k]=new Set(r[k]);}
 }catch(e){}
}

const toggleModo=document.getElementById('toggleModo');
if(toggleModo){
 toggleModo.addEventListener('click',()=>{
  modoOscuro=!modoOscuro;
  document.body.classList.toggle('light-mode',!modoOscuro);
  toggleModo.textContent=modoOscuro?'☀ Modo claro':'🌙 Modo oscuro';
  Object.values(charts).forEach(c=>{
   if(!c) return;
   if(c.options?.plugins?.legend?.labels) c.options.plugins.legend.labels.color=getLegendColor();
   if(c.options?.scales) Object.values(c.options.scales).forEach(s=>{
    if(s.ticks) s.ticks.color=getLegendColor();
    if(s.grid) s.grid.color=getGridColor();
   });
   c.update();
  });
  if(tablaDT) tablaDT.draw(false);
 });
}

function pushHistorial(){
 historial=historial.slice(0,historialIdx+1);
 historial.push(JSON.parse(JSON.stringify(filtrosActivos)));
 historialIdx=historial.length-1;
 guardarEstado();
}

function renderTags(){
 const cont=document.getElementById('filtrosActivos');
 if(!cont) return;
 cont.innerHTML='';
 Object.entries(filtrosActivos).forEach(([k,v])=>{
  if(!v) return;
  const t=document.createElement('span');
  t.className='filtro-tag';
  t.textContent=`${k}: ${v} ✕`;
  t.onclick=()=>{delete filtrosActivos[k];pushHistorial();renderTags();actualizarGraficos();};
  cont.appendChild(t);
 });
}

fetch('resumen_full.json')
.then(r=>r.json())
.then(data=>{
 const normStr=s=>s.toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const CAMPOS_NORM=['FAMILIA AVERIA','FAMILIA','ORIGEN AVISO','TURNO','VHLO','TIPO ORDEN'];
 data.forEach(d=>{
  CAMPOS_NORM.forEach(k=>{if(d[k]) d[k]=normStr(d[k]);});
  if(d['FECHA AVISO']){
   const p=d['FECHA AVISO'].split('/').map(Number);
   if(p.length===3){
    const f=new Date(p[2],p[1]-1,p[0]);
    if(!isNaN(f)) d.fechaJS=f;
   }
  }
 });
 window.dataTabla=data;
 cargarEstado();
 inicializarFechas();
 inicializarTabla();
 crearGraficos();
 renderTags();
 actualizarGraficos();
})
.catch(e=>console.error('Error JSON:',e));

function inicializarFechas(){
 const fi=document.getElementById('fechaInicio');
 const ff=document.getElementById('fechaFin');
 if(!fi||!ff||!window.dataTabla) return;
 const fechas=window.dataTabla.filter(d=>d.fechaJS).map(d=>d.fechaJS);
 if(!fechas.length) return;
 fi.valueAsDate=new Date(Math.min(...fechas));
 ff.valueAsDate=new Date(Math.max(...fechas));
 fi.addEventListener('change',actualizarGraficos);
 ff.addEventListener('change',actualizarGraficos);
}

function crearGraficos(){
 const ctxFamilia=document.getElementById('graficoFamilia');
 if(ctxFamilia){
  charts.familia=new Chart(ctxFamilia.getContext('2d'),{
   type:'bar',
   data:{labels:[],datasets:[{label:'Familia Avería',data:[],backgroundColor:[]}]},
   options:{responsive:true}
  });
 }
 const ctxTurno=document.getElementById('graficoTurno');
 if(ctxTurno){
  charts.turno=new Chart(ctxTurno.getContext('2d'),{
   type:'doughnut',
   data:{labels:[],datasets:[{data:[],backgroundColor:[]}]},
   options:{responsive:true}
  });
 }
 const ctxEvol=document.getElementById('graficoEvolucion');
 if(ctxEvol){
  charts.evolucion=new Chart(ctxEvol.getContext('2d'),{
   type:'line',
   data:{labels:[],datasets:[]},
   options:{responsive:true}
  });
 }
}

function inicializarTabla(){
 if(!window.dataTabla) return;
 if(!$.fn.DataTable) return;

 tablaDT=$('#tablaAverias').DataTable({
  data:[],
  columns:[
   {title:'Vehículo',data:'VHLO'},
   {title:'Familia Veh.',data:'FAMILIA'},
   {title:'Familia Avería',data:'FAMILIA AVERIA'},
   {title:'Fecha Aviso',data:'FECHA AVISO'},
   {title:'Turno',data:'TURNO'},
   {title:'Origen Aviso',data:'ORIGEN AVISO'}
  ],
  pageLength:25
 });

 const btnAleatorio=document.getElementById('btnAleatorio');
 if(btnAleatorio){
  btnAleatorio.addEventListener('click',()=>{
   if(!tablaDT) return;
   const data=tablaDT.rows().data().toArray();
   for(let i=data.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [data[i],data[j]]=[data[j],data[i]];
   }
   tablaDT.clear().rows.add(data).draw();
  });
 }
}

function actualizarGraficos(){
 if(!charts||!window.dataTabla) return;

 const fi=document.getElementById('fechaInicio')?.valueAsDate;
 const ff=document.getElementById('fechaFin')?.valueAsDate;

 let datos=window.dataTabla.filter(d=>{
  if(!d.fechaJS) return false;
  if(!fi||!ff) return true;
  return d.fechaJS>=fi && d.fechaJS<=ff;
 });

 datos=datos.filter(d=>d.VHLO);

 if(charts.familia){
  const cnt={};
  datos.forEach(d=>{
   const v=d['FAMILIA AVERIA'];
   if(v) cnt[v]=(cnt[v]||0)+1;
  });
  charts.familia.data.labels=Object.keys(cnt);
  charts.familia.data.datasets[0].data=Object.values(cnt);
  charts.familia.data.datasets[0].backgroundColor=genColores(Object.keys(cnt).length);
  charts.familia.update();
 }

 if(charts.turno){
  const cnt={};
  datos.forEach(d=>{
   const v=d['TURNO'];
   if(v) cnt[v]=(cnt[v]||0)+1;
  });
  charts.turno.data.labels=Object.keys(cnt);
  charts.turno.data.datasets[0].data=Object.values(cnt);
  charts.turno.data.datasets[0].backgroundColor=genColores(Object.keys(cnt).length);
  charts.turno.update();
 }

 if(charts.evolucion){
  const evol={};
  datos.forEach(d=>{
   if(!d.fechaJS) return;
   const mes=`${d.fechaJS.getFullYear()}-${d.fechaJS.getMonth()+1}`;
   evol[mes]=(evol[mes]||0)+1;
  });
  charts.evolucion.data.labels=Object.keys(evol);
  charts.evolucion.data.datasets=[{
   label:'Averías',
   data:Object.values(evol),
   borderColor:'#00d4aa',
   fill:false
  }];
  charts.evolucion.update();
 }

 if(tablaDT){
  tablaDT.clear().rows.add(datos).draw();
 }

 const total=document.getElementById('totalAverias');
 if(total) total.textContent=datos.length;
}

});