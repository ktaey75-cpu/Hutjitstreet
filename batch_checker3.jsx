import { useState, useRef } from "react";

const MONTH_CODE = {J:1,F:2,M:3,A:4,Y:5,U:6,L:7,G:8,S:9,O:10,N:11,D:12};
const MONTH_KR = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function calcExpiry(year, month, day) {
  let exp = new Date(year, month-1, day);
  exp.setFullYear(exp.getFullYear()+3);
  exp.setDate(exp.getDate()-1);
  return { year: exp.getFullYear(), month: exp.getMonth()+1, isDay1: day===1 };
}

function parseBatchNo(val) {
  val = val.toUpperCase().trim();
  if(val.length < 5) return null;
  const year = 2000 + parseInt(val.substring(0,2));
  const month = MONTH_CODE[val.substring(2,3)];
  const day = parseInt(val.substring(3,5));
  const bulk = val.substring(5);
  if(!month || isNaN(day) || day<1 || day>31) return null;
  return { year, month, day, bulk };
}

export default function App() {
  const [tab, setTab] = useState('photo');
  const [imgSrc, setImgSrc] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedBatch, setDetectedBatch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [photoExpiry, setPhotoExpiry] = useState(null);
  const [pvYear, setPvYear] = useState('');
  const [pvMonth, setPvMonth] = useState('');
  const [manualBatch, setManualBatch] = useState('');
  const [manualExpiry, setManualExpiry] = useState(null);
  const [vYear, setVYear] = useState('');
  const [vMonth, setVMonth] = useState('');
  const [history, setHistory] = useState([]);
  const fileRef = useRef();

  // 사진 로드
  const loadImage = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setImgSrc(ev.target.result);
      setDetectedBatch('');
      setErrorMsg('');
      setPhotoExpiry(null);
      setPvYear(''); setPvMonth('');
      analyzeImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (dataUrl) => {
    setAnalyzing(true);
    setErrorMsg('');
    try {
      const base64 = dataUrl.split(',')[1];
      const mediaType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: `이미지에서 배치번호(Batch No)를 찾아주세요.
형식: 숫자2자리+알파벳1자리+숫자5자리 (예: 26A01301)
배치번호만 답하세요. 없으면 "없음"` }
            ]
          }]
        })
      });
      const data = await resp.json();
      const text = ((data.content||[]).find(b=>b.type==='text')?.text||'').trim().toUpperCase().replace(/\s/g,'');
      
      if(!text || text.includes('없음')) {
        setErrorMsg('배치번호를 찾지 못했습니다. 더 선명하게 다시 촬영해주세요.');
      } else {
        const match = text.match(/[0-9]{2}[A-Z][0-9]{5}/);
        const batch = match ? match[0] : text;
        setDetectedBatch(batch);
        const parsed = parseBatchNo(batch);
        if(parsed) {
          const exp = calcExpiry(parsed.year, parsed.month, parsed.day);
          setPhotoExpiry({ ...parsed, ...exp });
        }
      }
    } catch(err) {
      setErrorMsg('오류: ' + err.message);
    }
    setAnalyzing(false);
  };

  const resetPhoto = () => {
    setImgSrc(null); setDetectedBatch(''); setErrorMsg('');
    setPhotoExpiry(null); setPvYear(''); setPvMonth('');
    if(fileRef.current) fileRef.current.value='';
  };

  const saveHistory = (batch, cy, cm, py, pm, ok) => {
    if(!batch) return;
    const entry = { batch, cy, cm, py: parseInt(py), pm: parseInt(pm), ok,
      time: new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) };
    setHistory(prev => {
      const filtered = prev.filter(h=>h.batch!==batch);
      return [entry, ...filtered].slice(0,30);
    });
  };

  // 검수 판정
  const photoVerify = () => {
    if(!photoExpiry || !pvYear || !pvMonth) return null;
    return parseInt(pvYear)===photoExpiry.year && parseInt(pvMonth)===photoExpiry.month;
  };
  const manualVerify = () => {
    if(!manualExpiry || !vYear || !vMonth) return null;
    return parseInt(vYear)===manualExpiry.year && parseInt(vMonth)===manualExpiry.month;
  };

  const pv = photoVerify();
  const mv = manualVerify();

  // 검수 결과 저장 트리거
  const handlePvChange = (y, m) => {
    setPvYear(y); setPvMonth(m);
    if(photoExpiry && y && m) {
      const ok = parseInt(y)===photoExpiry.year && parseInt(m)===photoExpiry.month;
      saveHistory(detectedBatch, photoExpiry.year, photoExpiry.month, y, m, ok);
    }
  };
  const handleVChange = (y, m) => {
    setVYear(y); setVMonth(m);
    if(manualExpiry && y && m) {
      const ok = parseInt(y)===manualExpiry.year && parseInt(m)===manualExpiry.month;
      saveHistory(manualBatch, manualExpiry.year, manualExpiry.month, y, m, ok);
    }
  };

  const s = {
    body: { background:'#0d1117', minHeight:'100vh', color:'#e6edf3', fontFamily:'sans-serif', padding:'16px', paddingBottom:'60px' },
    h1: { textAlign:'center', fontSize:'20px', fontWeight:900, padding:'16px 0 4px' },
    sub: { textAlign:'center', fontSize:'11px', color:'#8b949e', letterSpacing:'2px', marginBottom:'20px' },
    tabs: { display:'flex', background:'#161b22', border:'1px solid #21262d', borderRadius:'10px', padding:'4px', marginBottom:'16px', gap:'4px' },
    tab: (active) => ({ flex:1, padding:'10px', textAlign:'center', fontSize:'13px', fontWeight:700, borderRadius:'7px', cursor:'pointer', border:'none', fontFamily:'sans-serif', background: active?'#58a6ff':'transparent', color: active?'#0d1117':'#8b949e', transition:'all 0.2s' }),
    card: { background:'#161b22', border:'1px solid #21262d', borderRadius:'12px', padding:'18px', marginBottom:'12px' },
    cardTitle: { fontSize:'11px', color:'#8b949e', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px', borderBottom:'1px solid #21262d', paddingBottom:'10px' },
    uploadArea: { border:'2px dashed #21262d', borderRadius:'12px', padding:'30px 20px', textAlign:'center', cursor:'pointer', marginBottom:'12px' },
    input: { width:'100%', background:'#0d1117', border:'1px solid #21262d', borderRadius:'8px', color:'#e6edf3', fontFamily:'monospace', fontSize:'20px', fontWeight:700, padding:'12px 14px', outline:'none', marginBottom:'8px' },
    resultBox: (show) => ({ borderRadius:'12px', padding:'20px', textAlign:'center', border: show?'2px solid rgba(88,166,255,0.4)':'2px solid #21262d', marginBottom:'12px', display: show?'block':'none' }),
    rDate: { fontFamily:'monospace', fontSize:'42px', fontWeight:700, color:'#58a6ff', letterSpacing:'2px' },
    rSub: { fontSize:'13px', color:'#8b949e', marginTop:'6px' },
    warnBadge: { display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(247,129,102,0.15)', border:'1px solid rgba(247,129,102,0.4)', borderRadius:'20px', padding:'5px 12px', fontSize:'12px', color:'#f78166', fontWeight:700, marginTop:'8px' },
    verifyBox: (state) => ({
      borderRadius:'12px', padding:'18px', textAlign:'center', fontWeight:700, fontSize:'18px', marginTop:'8px',
      border: state==='ok'?'2px solid #3fb950': state==='ng'?'2px solid #f85149':'2px solid #21262d',
      background: state==='ok'?'rgba(63,185,80,0.1)': state==='ng'?'rgba(248,81,73,0.1)':'transparent',
      color: state==='ok'?'#3fb950': state==='ng'?'#f85149':'#8b949e',
    }),
    btn: (type) => ({ width:'100%', padding:'13px', borderRadius:'10px', border: type==='sec'?'1px solid #21262d':'none', fontFamily:'sans-serif', fontSize:'14px', fontWeight:700, cursor:'pointer', marginBottom:'8px', background: type==='pri'?'#58a6ff': type==='sec'?'#161b22':'rgba(248,81,73,0.15)', color: type==='pri'?'#0d1117': type==='sec'?'#e6edf3':'#f85149' }),
    parsedGrid: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px', marginTop:'10px' },
    parsedItem: (dim) => ({ background:'#0d1117', borderRadius:'8px', padding:'10px 12px', borderLeft:`3px solid ${dim?'#484f58':'#58a6ff'}` }),
    parsedLabel: { fontSize:'10px', color:'#8b949e', letterSpacing:'1px', marginBottom:'4px' },
    parsedVal: (dim) => ({ fontFamily:'monospace', fontSize: dim?'14px':'18px', fontWeight:700, color: dim?'#8b949e':'#58a6ff' }),
    monthGrid: { display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'4px', marginTop:'8px' },
    monthCell: { background:'#0d1117', borderRadius:'6px', padding:'6px 4px', textAlign:'center' },
    histItem: (ok) => ({ background:'#0d1117', borderRadius:'8px', padding:'10px 12px', borderLeft:`3px solid ${ok?'#3fb950':'#f85149'}`, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }),
    row: { display:'flex', gap:'10px', marginBottom:'12px' },
    field: { flex:1 },
    fieldLabel: { fontSize:'12px', color:'#8b949e', marginBottom:'6px', display:'block' },
    spinner: { width:'32px', height:'32px', border:'3px solid #21262d', borderTopColor:'#58a6ff', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' },
    detected: { background:'#0d1117', border:'1px solid #58a6ff', borderRadius:'10px', padding:'14px 16px', marginBottom:'12px' },
    detectedVal: { fontFamily:'monospace', fontSize:'24px', fontWeight:700, color:'#58a6ff' },
    errBox: { background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:'8px', padding:'12px', fontSize:'13px', color:'#f85149', marginBottom:'12px' },
    img: { width:'100%', borderRadius:'10px', marginBottom:'12px', maxHeight:'280px', objectFit:'contain' },
  };

  const manualParsed = parseBatchNo(manualBatch);
  if(manualParsed && (!manualExpiry || manualExpiry._raw !== manualBatch)) {
    const exp = calcExpiry(manualParsed.year, manualParsed.month, manualParsed.day);
    setManualExpiry({ ...manualParsed, ...exp, _raw: manualBatch });
  }
  if(!manualParsed && manualExpiry) setManualExpiry(null);

  return (
    <div style={s.body}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <h1 style={s.h1}>📦 배치번호 검수기</h1>
      <div style={s.sub}>BATCH NO · EXPIRY DATE CHECKER</div>

      <div style={s.tabs}>
        {['photo','manual','history'].map((t,i)=>
          <button key={t} style={s.tab(tab===t)} onClick={()=>setTab(t)}>
            {['📷 사진검수','✏️ 직접입력','📋 이력'][i]}
          </button>
        )}
      </div>

      {/* 사진검수 탭 */}
      {tab==='photo' && (
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>사진 업로드</div>
            {!imgSrc && (
              <div style={s.uploadArea} onClick={()=>fileRef.current?.click()}>
                <div style={{fontSize:'40px',marginBottom:'8px'}}>📸</div>
                <div style={{fontSize:'14px',fontWeight:700}}>사진 업로드 / 카메라 촬영</div>
                <div style={{fontSize:'12px',color:'#8b949e',marginTop:'4px'}}>배치번호가 잘 보이도록 찍어주세요</div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  onChange={loadImage} style={{display:'none'}} />
              </div>
            )}
            {imgSrc && <img src={imgSrc} style={s.img} alt="preview" />}
            {analyzing && (
              <div style={{textAlign:'center',padding:'20px',color:'#8b949e'}}>
                <div style={s.spinner}></div>
                AI가 배치번호를 인식 중입니다...
              </div>
            )}
            {errorMsg && <div style={s.errBox}>{errorMsg}</div>}
            {detectedBatch && !analyzing && (
              <div style={s.detected}>
                <div style={{fontSize:'11px',color:'#8b949e',marginBottom:'6px'}}>감지된 배치번호</div>
                <div style={s.detectedVal}>{detectedBatch}</div>
              </div>
            )}
            {imgSrc && <button style={s.btn('sec')} onClick={resetPhoto}>🔄 다시 업로드</button>}
          </div>

          {photoExpiry && (
            <>
              <div style={{...s.card, border:'1px solid rgba(88,166,255,0.4)'}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'#8b949e',letterSpacing:'2px',marginBottom:'8px'}}>정답 사용기한</div>
                  <div style={s.rDate}>{photoExpiry.year} · {String(photoExpiry.month).padStart(2,'0')}</div>
                  <div style={s.rSub}>{photoExpiry.year}년 {MONTH_KR[photoExpiry.month]}</div>
                  {photoExpiry.isDay1 && <div style={s.warnBadge}>⚠ 1일 제조 → 전달 말일 적용</div>}
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>인쇄된 사용기한 확인</div>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>년도</label>
                    <input style={s.input} type="number" placeholder="2029" inputMode="numeric"
                      value={pvYear} onChange={e=>handlePvChange(e.target.value, pvMonth)} />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>월</label>
                    <input style={s.input} type="number" placeholder="03" min="1" max="12" inputMode="numeric"
                      value={pvMonth} onChange={e=>handlePvChange(pvYear, e.target.value)} />
                  </div>
                </div>
                <div style={s.verifyBox(pv===null?'idle':pv?'ok':'ng')}>
                  {pv===null && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>🔍</span>인쇄된 사용기한을 입력하세요</>}
                  {pv===true && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>✅</span>정상<div style={{fontSize:'13px',marginTop:'4px',opacity:0.8}}>{photoExpiry.year}년 {String(photoExpiry.month).padStart(2,'0')}월 일치</div></>}
                  {pv===false && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>❌</span>오류 감지<div style={{fontSize:'13px',marginTop:'4px',opacity:0.8}}>정답: {photoExpiry.year}년 {String(photoExpiry.month).padStart(2,'0')}월 / 입력: {pvYear}년 {String(pvMonth).padStart(2,'0')}월</div></>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 직접입력 탭 */}
      {tab==='manual' && (
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>배치번호 입력</div>
            <input style={s.input} type="text" placeholder="26A01301" maxLength={10}
              value={manualBatch} onChange={e=>setManualBatch(e.target.value.toUpperCase())} />
            {manualParsed && (
              <div style={s.parsedGrid}>
                {[
                  {label:'제조년도', val:manualParsed.year+'년', dim:false},
                  {label:'제조월', val:MONTH_KR[manualParsed.month], dim:false},
                  {label:'제조일', val:manualParsed.day+'일', dim:false},
                  {label:'벌크번호', val:manualParsed.bulk||'-', dim:true},
                ].map(({label,val,dim})=>(
                  <div key={label} style={s.parsedItem(dim)}>
                    <div style={s.parsedLabel}>{label}</div>
                    <div style={s.parsedVal(dim)}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {manualExpiry && (
            <div style={{...s.card, border:'1px solid rgba(88,166,255,0.4)'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'11px',color:'#8b949e',letterSpacing:'2px',marginBottom:'8px'}}>정답 사용기한</div>
                <div style={s.rDate}>{manualExpiry.year} · {String(manualExpiry.month).padStart(2,'0')}</div>
                <div style={s.rSub}>{manualExpiry.year}년 {MONTH_KR[manualExpiry.month]}</div>
                {manualExpiry.isDay1 && <div style={s.warnBadge}>⚠ 1일 제조 → 전달 말일 적용</div>}
              </div>
            </div>
          )}

          <div style={s.card}>
            <div style={s.cardTitle}>인쇄된 사용기한 확인</div>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.fieldLabel}>년도</label>
                <input style={s.input} type="number" placeholder="2029" inputMode="numeric"
                  value={vYear} onChange={e=>handleVChange(e.target.value, vMonth)} />
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>월</label>
                <input style={s.input} type="number" placeholder="03" min="1" max="12" inputMode="numeric"
                  value={vMonth} onChange={e=>handleVChange(vYear, e.target.value)} />
              </div>
            </div>
            <div style={s.verifyBox(mv===null?'idle':mv?'ok':'ng')}>
              {mv===null && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>🔍</span>배치번호와 인쇄된 날짜를 입력하세요</>}
              {mv===true && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>✅</span>정상<div style={{fontSize:'13px',marginTop:'4px',opacity:0.8}}>{manualExpiry?.year}년 {String(manualExpiry?.month||0).padStart(2,'0')}월 일치</div></>}
              {mv===false && <><span style={{fontSize:'28px',display:'block',marginBottom:'6px'}}>❌</span>오류 감지<div style={{fontSize:'13px',marginTop:'4px',opacity:0.8}}>정답: {manualExpiry?.year}년 {String(manualExpiry?.month||0).padStart(2,'0')}월 / 입력: {vYear}년 {String(vMonth).padStart(2,'0')}월</div></>}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>월 코드표</div>
            <div style={s.monthGrid}>
              {[['J','1월'],['F','2월'],['M','3월'],['A','4월'],['Y','5월'],['U','6월'],
                ['L','7월'],['G','8월'],['S','9월'],['O','10월'],['N','11월'],['D','12월']].map(([c,n])=>(
                <div key={c} style={s.monthCell}>
                  <div style={{fontFamily:'monospace',fontSize:'16px',fontWeight:700,color:'#58a6ff'}}>{c}</div>
                  <div style={{fontSize:'10px',color:'#8b949e',marginTop:'2px'}}>{n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 이력 탭 */}
      {tab==='history' && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:'#8b949e',letterSpacing:'2px',textTransform:'uppercase'}}>검수 이력</div>
            <button style={{...s.btn('danger'), width:'auto', padding:'6px 14px', marginBottom:0, fontSize:'12px'}}
              onClick={()=>setHistory([])}>초기화</button>
          </div>
          {history.length===0
            ? <div style={{textAlign:'center',color:'#8b949e',fontSize:'13px',padding:'16px'}}>검수 이력이 없습니다</div>
            : history.map((h,i)=>(
              <div key={i} style={s.histItem(h.ok)}>
                <div>
                  <div style={{fontFamily:'monospace',fontSize:'14px',fontWeight:700}}>{h.batch}</div>
                  <div style={{fontSize:'11px',color:'#8b949e',marginTop:'2px'}}>
                    정답 {h.cy}·{String(h.cm).padStart(2,'0')}
                    {!h.ok && ` / 인쇄 ${h.py}·${String(h.pm).padStart(2,'0')}`}
                    {' · '}{h.time}
                  </div>
                </div>
                <div style={{fontSize:'20px'}}>{h.ok?'✅':'❌'}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
