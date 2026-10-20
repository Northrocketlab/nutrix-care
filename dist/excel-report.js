(function(root){
 'use strict';
 const encoder=new TextEncoder();
 const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 function zip(files){
  const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  const chunks=[],central=[];let offset=0;
  for(const [path,source] of files){
   const name=encoder.encode(path),data=encoder.encode(source);let crc=0xffffffff;for(const b of data)crc=table[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
   const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
   const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46);
   chunks.push(local,data);central.push(entry);offset+=local.length+data.length;
  }
  const directoryLength=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directoryLength,true);e.setUint32(16,offset,true);
  const output=new Uint8Array(offset+directoryLength+22);let at=0;for(const part of [...chunks,...central,end]){output.set(part,at);at+=part.length;}return output;
 }
 function sheet(rows){
  const columns=rows[0].length,last=column(columns-1),lastRow=rows.length;
  const widths=Array.from({length:columns},(_,i)=>Math.min(48,Math.max(14,...rows.slice(0,250).map(r=>Array.from(String(r[i]??'')).length+3))));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
   `<dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>`+
   rows.map((row,r)=>`<row r="${r+1}"${r===0?' ht="32" customHeight="1"':''}>${row.map((value,c)=>{const ref=column(c)+(r+1),style=r===0?1:2;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')+
   `</sheetData><autoFilter ref="A1:${last}${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
 }
 const styles='<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174E45"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 function tables(state,{now=new Date(),revision=null,source='ฐานข้อมูลกลาง',operator=''}={}){
  const animals=state.animals||[],tasks=state.tasks||[],events=state.events||[];
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const when=v=>{if(!v)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}).format(d);};
  const name=id=>animals.find(a=>a.id===id)?.name||'';
  const medicationRows=animals.flatMap(a=>(a.medications||[]).map(m=>[root.Care.animalCode(a),a.name,a.kennel,m.name,m.dose,m.frequency,m.start,m.end,m.active?'ใช้อยู่':'หยุดใช้แล้ว',m.instructions,m.operator,when(m.time),when(m.stoppedAt),m.stoppedBy,m.stopReason]));
  return [
   ['สรุปรายงาน',[['รายการ','ข้อมูล'],['รายงาน','Nutrix Care — รายงานสำหรับเปิดอ่าน'],['ส่งออกเมื่อ (เวลาไทย)',when(now.toISOString())],['แหล่งข้อมูล',source],['รุ่นข้อมูล',revision??''],['ผู้ส่งออก',operator],['จำนวนสัตว์',animals.length],['กรงทั้งหมด',root.Care.kennels.length],['งานค้าง',tasks.filter(t=>!t.done).length],['งานเสร็จ',tasks.filter(t=>t.done).length],['รายการยาใช้อยู่',medicationRows.filter(r=>r[8]==='ใช้อยู่').length],['วันที่ในทะเบียน','วันเกิด/วันนัดเป็น ค.ศ. YYYY-MM-DD'],['ขอบเขต','ข้อมูลทั้งหมดที่บันทึกไว้ ณ เวลาส่งออก รวมประวัติย้อนหลัง'],['หมายเหตุ','รายงานนี้ใช้เปิดอ่าน ไม่ใช่ไฟล์กู้ฐานข้อมูล และการแก้ใน Excel ไม่เปลี่ยนข้อมูลบนเว็บ']]],
   ['ทะเบียนสัตว์',[['รหัสสัตว์','ชื่อ','ชนิด','พันธุ์','เพศ','วันเกิด (ค.ศ.)','อายุ ณ วันส่งออก','ช่วงวัย','รหัสกรง','สถานะสุขภาพ','อาการที่ต้องสังเกต','ยาที่ใช้อยู่ (รายการ)','ตำแหน่งตัวอย่าง'],...animals.map(a=>[root.Care.animalCode(a),a.name,a.species,a.breed,a.sex,a.birth,root.Care.age(a.birth,date),a.stage,a.kennel,a.status,a.symptoms,(a.medications||[]).filter(m=>m.active).map(m=>m.name).join('\n'),a.placementExample?'ใช่ — รอยืนยัน':''])]],
   ['รายการยา',[['รหัสสัตว์','ชื่อสัตว์','กรงปัจจุบัน','ชื่อยา','ขนาดและหน่วย','ความถี่หรือเวลา','วันเริ่ม','วันสิ้นสุดตามแผน','สถานะยา','วิธีให้หรือคำสั่งเพิ่มเติม','ผู้บันทึก','เวลาบันทึก','เวลาหยุดยา','ผู้บันทึกหยุดยา','เหตุผลหยุดยา'],...medicationRows]],
   ['ตรวจรายเดือน',[['รหัสสัตว์','ชื่อสัตว์','กรงปัจจุบัน','เดือนที่ตรวจ (ค.ศ.)','สภาพขน','ความยาวเล็บ','ความสะอาดหู','หมายเหตุ','ผู้ตรวจ','เวลาบันทึก'],...animals.flatMap(a=>(a.checks||[]).map(c=>[root.Care.animalCode(a),a.name,a.kennel,c.month,c.coat,c.nails,c.ears,c.note,c.operator,when(c.time)]))]],
   ['งานดูแล',[['รหัสงาน','รหัสสัตว์','ชื่อสัตว์','สิ่งที่ต้องทำ','วันที่ต้องทำ','ผู้รับผิดชอบ','สถานะ','ผู้สร้างงาน','เวลาสร้าง','ผู้ทำเสร็จ','เวลาทำเสร็จ'],...tasks.map(t=>[t.id,animals.find(a=>a.id===t.animalId)?root.Care.animalCode(animals.find(a=>a.id===t.animalId)):'',name(t.animalId),t.title,t.due,t.assignee,t.done?'เสร็จแล้ว':'ค้าง',t.createdBy,when(t.time),t.completedBy,when(t.completedAt)])]],
   ['ข้อสังเกต',[['รหัสสัตว์','ชื่อสัตว์','กรงปัจจุบัน','ข้อสังเกต','ผู้บันทึก','เวลาบันทึก'],...animals.flatMap(a=>(a.notes||[]).map(n=>[root.Care.animalCode(a),a.name,a.kennel,n.text,n.operator,when(n.time)]))]],
   ['ประวัติกิจกรรม',[['รหัสกิจกรรม','รายละเอียด','ผู้บันทึก','เวลาในรายการ','เวลาบันทึกเซิร์ฟเวอร์','รหัสบัญชีผู้บันทึก'],...events.map(e=>[e.id,e.text,e.operator,when(e.time),when(e.recordedAt),e.actorId])]]
  ];
 }
 function build(state,options={}){
  const sheets=tables(state,options),files=[];
  const base='http://schemas.openxmlformats.org/';
  files.push(['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="${base}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
  files.push(['_rels/.rels',`<?xml version="1.0"?><Relationships xmlns="${base}package/2006/relationships"><Relationship Id="rId1" Type="${base}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  files.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${base}spreadsheetml/2006/main" xmlns:r="${base}officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map(([name],i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`]);
  files.push(['xl/_rels/workbook.xml.rels',`<?xml version="1.0"?><Relationships xmlns="${base}package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${base}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${base}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(['xl/styles.xml',styles]);sheets.forEach(([,rows],i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheet(rows)]));return zip(files);
 }
 root.CareReport={build,tables};if(typeof module!=='undefined')module.exports=root.CareReport;
})(globalThis);
