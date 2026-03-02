function actualizarGraficos(){

  // 🔒 Protección general
  if (!charts || Object.keys(charts).length === 0) return;
  if (!window.dataTabla) return;

  const fi = document.getElementById('fechaInicio')?.valueAsDate;
  const ff = document.getElementById('fechaFin')?.valueAsDate;

  let datos = window.dataTabla.filter(d=>{
    if(!d.fechaJS || isNaN(d.fechaJS)) return false;
    if(!fi || !ff) return true;
    return cmpFecha(d.fechaJS,fi)>=0 && cmpFecha(d.fechaJS,ff)<=0;
  });

  for(const k in filtrosActivos){
    if(filtrosActivos[k] && k!=='_DESCRIPCION_NORM'){
      datos = datos.filter(d=>
        d[k] &&
        d[k].toString().trim().toUpperCase() ===
        filtrosActivos[k].toString().trim().toUpperCase()
      );
    }
  }

  for(const k in exclusiones){
    const ex = exclusiones[k];
    if(ex?.size){
      datos = datos.filter(d=>{
        const v=d[k]?d[k].toString().trim().toUpperCase():'';
        return !ex.has(v);
      });
    }
  }

  datos = datos.filter(d=>d.VHLO && d.VHLO.toString().trim()!=="");

  if(filtrosActivos['_DESCRIPCION_NORM']){
    datos = datos.filter(d=>getDescripcion(d)===filtrosActivos['_DESCRIPCION_NORM']);
  }

  // ─────────── GRAFICOS DE BARRAS ───────────
  [
    {key:'familia',campo:'FAMILIA AVERIA'},
    {key:'origen',campo:'ORIGEN AVISO'},
    {key:'familiaVeh',campo:'FAMILIA'},
    {key:'vhlo',campo:'VHLO'}
  ]
  .forEach(({key,campo})=>{

    const c = charts[key];
    if(!c || !c.data || !c.data.datasets?.length) return; // 🔒 protección

    const cnt={};
    datos.forEach(d=>{
      const v=d[campo];
      if(v && v!=='****'){
        const vn=v.toString().trim().toUpperCase();
        cnt[vn]=(cnt[vn]||0)+1;
      }
    });

    const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
    const labels=sorted.map(e=>e[0]);
    const values=sorted.map(e=>e[1]);
    const cols=genColores(labels.length);

    const fv=filtrosActivos[campo]?.toString().trim().toUpperCase();
    const bg=labels.map((l,i)=>fv && l!==fv ? cols[i]+'55' : cols[i]);

    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.data.datasets[0].backgroundColor = bg;
    c.update();
  });

  // ─────────── DESCRIPCIÓN ───────────
  if(charts.descripcion?.data?.datasets?.length){

    const cntD={};
    datos.forEach(d=>{
      const v=getDescripcion(d);
      if(v && v!=='****') cntD[v]=(cntD[v]||0)+1;
    });

    const sortedD=Object.entries(cntD).sort((a,b)=>b[1]-a[1]).slice(0,30);
    const labelsD=sortedD.map(e=>e[0]);
    const valuesD=sortedD.map(e=>e[1]);
    const colsD=genColores(labelsD.length);

    const fvD=filtrosActivos['_DESCRIPCION_NORM'];

    charts.descripcion.data.labels=labelsD;
    charts.descripcion.data.datasets[0].data=valuesD;
    charts.descripcion.data.datasets[0].backgroundColor=
      labelsD.map((l,i)=>fvD && l!==fvD ? colsD[i]+'55' : colsD[i]);

    charts.descripcion.update();
  }

  // ─────────── TURNO ───────────
  if(charts.turno?.data?.datasets?.length){

    const ctT={};
    datos.forEach(d=>{
      const v=d['TURNO'];
      if(v && v!=='****') ctT[v]=(ctT[v]||0)+1;
    });

    charts.turno.data.labels=Object.keys(ctT);
    charts.turno.data.datasets[0].data=Object.values(ctT);
    charts.turno.data.datasets[0].backgroundColor=genColores(Object.keys(ctT).length);
    charts.turno.update();
  }

  // ─────────── EVOLUCIÓN ───────────
  if(charts.evolucion){

    const evol={};

    datos.forEach(d=>{
      if(!d.fechaJS) return;

      const mes=`${d.fechaJS.getFullYear()}-${String(d.fechaJS.getMonth()+1).padStart(2,'0')}`;

      if(!evol[mes]) evol[mes]={};

      const fam=d['FAMILIA AVERIA'];
      if(fam && fam!=='****'){
        evol[mes][fam]=(evol[mes][fam]||0)+1;
      }
    });

    const lEv=Object.keys(evol).sort();
    const fams=[...new Set(datos.map(d=>d['FAMILIA AVERIA']).filter(f=>f && f!=='****'))];
    const cEv=genColores(fams.length);

    charts.evolucion.data.labels=lEv;
    charts.evolucion.data.datasets=fams.map((fam,i)=>({
      label:fam,
      data:lEv.map(l=>evol[l]?.[fam] || 0),
      borderColor:cEv[i],
      backgroundColor:cEv[i]+'22',
      fill:false,
      tension:0.3,
      pointRadius:3
    }));

    charts.evolucion.update();
  }

  // ─────────── TABLA ───────────
  if(tablaDT){
    tablaDT.clear();
    tablaDT.rows.add(datos);
    tablaDT.draw();
  }

  // ─────────── KPIs ───────────
  document.getElementById('totalAverias').textContent =
    datos.length.toLocaleString('es-ES');

  const dias=new Set(
    datos.filter(d=>d.fechaJS)
         .map(d=>d.fechaJS.toDateString())
  ).size;

  document.getElementById('promedioDiario').textContent =
    dias ? (datos.length/dias).toFixed(1) : '0';

  const vc={};
  datos.forEach(d=>{
    if(d.VHLO && d.VHLO!=='****')
      vc[d.VHLO]=(vc[d.VHLO]||0)+1;
  });

  document.getElementById('vehiculoTop').textContent =
    Object.keys(vc).length
      ? Object.keys(vc).reduce((a,b)=>vc[a]>vc[b]?a:b)
      : '-';
}