'use strict';

// ── QR type definitions ────────────────────────────────────────────────────

const TYPES = [
  { id: 'url',      label: 'Link / URL' },
  { id: 'vcard',    label: 'Contact\n(vCard)' },
  { id: 'wifi',     label: 'Wi-Fi' },
  { id: 'payment',  label: 'Payment' },
  { id: 'applink',  label: 'App\nDownload' },
  { id: 'location', label: 'Location' },
  { id: 'calendar', label: 'Calendar\nEvent' },
  { id: 'totp',     label: 'Auth\n(TOTP)' },
  { id: 'text',     label: 'Plain Text' },
];

// Returns an array of field descriptor objects for each type.
// type: text | url | email | tel | number | password | datetime-local | select | textarea | checkbox
function getFields(typeId) {
  switch (typeId) {
    case 'url':
      return [
        { id:'url', label:'URL', type:'url', placeholder:'https://example.com', required:true, full:true },
      ];

    case 'vcard':
      return [
        { id:'first_name', label:'First Name', type:'text', placeholder:'Jane' },
        { id:'last_name',  label:'Last Name',  type:'text', placeholder:'Doe' },
        { id:'phone',  label:'Phone',        type:'tel',   placeholder:'+1 555-0100' },
        { id:'email',  label:'Email',        type:'email', placeholder:'jane@example.com' },
        { id:'org',    label:'Organization', type:'text',  placeholder:'Acme Corp' },
        { id:'title',  label:'Job Title',    type:'text',  placeholder:'Engineer' },
        { id:'website',label:'Website',      type:'url',   placeholder:'https://example.com' },
        { id:'address',label:'Address',      type:'text',  placeholder:'123 Main St, City, State', full:true },
      ];

    case 'wifi':
      return [
        { id:'ssid',     label:'Network Name (SSID)', type:'text',     required:true, full:true },
        { id:'password', label:'Password',            type:'password', full:true },
        { id:'security', label:'Security Type',       type:'select',
          options:['WPA/WPA2','WEP','None (open)'] },
        { id:'hidden',   label:'Hidden network',      type:'checkbox' },
      ];

    case 'payment':
      return [
        { id:'payment_type', label:'Service', type:'select',
          options:['PayPal','CashApp','Bitcoin','Ethereum'] },
        { id:'identifier', label:'Username / Address', type:'text', required:true, full:true,
          placeholder:'username or wallet address' },
        { id:'amount', label:'Amount (optional)', type:'text', placeholder:'10.00' },
      ];

    case 'applink':
      return [
        { id:'store_url', label:'App Store or Play Store URL', type:'url', required:true, full:true,
          placeholder:'https://apps.apple.com/… or https://play.google.com/…' },
        { id:'_hint', type:'hint',
          text:'Tip: for cross-platform, use a smart-link service (e.g. linktr.ee) and paste that URL above.' },
      ];

    case 'location':
      return [
        { id:'lat', label:'Latitude',  type:'number', placeholder:'37.7749', step:'any', required:true },
        { id:'lon', label:'Longitude', type:'number', placeholder:'-122.4194', step:'any', required:true },
        { id:'_hint', type:'hint', text:'Opens in Google Maps / Apple Maps / native map app on scan.' },
      ];

    case 'calendar':
      return [
        { id:'title',       label:'Event Title',     type:'text',           required:true, full:true },
        { id:'start',       label:'Start',           type:'datetime-local', required:true },
        { id:'end',         label:'End',             type:'datetime-local' },
        { id:'loc',         label:'Location',        type:'text',           full:true },
        { id:'description', label:'Description',     type:'textarea',       full:true },
      ];

    case 'totp':
      return [
        { id:'account', label:'Account / Email', type:'text',     required:true, full:true },
        { id:'secret',  label:'Secret Key',      type:'text',     required:true, full:true,
          placeholder:'BASE32 secret (e.g. JBSWY3DPEHPK3PXP)' },
        { id:'issuer',  label:'Issuer (app name)', type:'text',   placeholder:'MyApp' },
        { id:'_hint',   type:'hint', text:'Scans into authenticator apps (Google Authenticator, Aegis, etc.).' },
      ];

    case 'text':
      return [
        { id:'text', label:'Text Content', type:'textarea', required:true, full:true,
          placeholder:'Up to ~4 000 characters…', maxlength:'4000' },
      ];

    default:
      return [];
  }
}

// ── Data formatters ────────────────────────────────────────────────────────

function escapeWifi(s) {
  return (s || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/"/g,'\\"');
}

function fmtDateTime(dt) {
  if (!dt) return '';
  const [date, time = '0000'] = dt.split('T');
  const d = date.replace(/-/g, '');
  const t = (time.replace(/:/g, '') + '00').slice(0, 6);
  return `${d}T${t}`;
}

function formatQRData(typeId, fields) {
  switch (typeId) {
    case 'url':
      return fields.url || '';

    case 'vcard': {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      const fn = [fields.first_name, fields.last_name].filter(Boolean).join(' ');
      if (fn) {
        lines.push(`FN:${fn}`);
        lines.push(`N:${fields.last_name||''};${fields.first_name||''};;;`);
      }
      if (fields.phone)   lines.push(`TEL;TYPE=CELL:${fields.phone}`);
      if (fields.email)   lines.push(`EMAIL:${fields.email}`);
      if (fields.org)     lines.push(`ORG:${fields.org}`);
      if (fields.title)   lines.push(`TITLE:${fields.title}`);
      if (fields.website) lines.push(`URL:${fields.website}`);
      if (fields.address) lines.push(`ADR:;;${fields.address};;;;`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }

    case 'wifi': {
      const sec = (fields.security || 'WPA/WPA2').replace('/WPA2','').replace('None (open)','nopass');
      const ssid = escapeWifi(fields.ssid);
      const pass = sec === 'nopass' ? '' : escapeWifi(fields.password);
      const hidden = fields.hidden ? 'true' : 'false';
      return `WIFI:T:${sec};S:${ssid};P:${pass};H:${hidden};;`;
    }

    case 'payment': {
      const svc = (fields.payment_type || 'PayPal').toLowerCase();
      const id  = (fields.identifier || '').trim();
      const amt = (fields.amount || '').trim();
      if (svc === 'paypal')
        return `https://paypal.me/${id}${amt ? '/'+amt : ''}`;
      if (svc === 'cashapp')
        return `https://cash.app/$${id.replace(/^\$/,'')}${amt ? '/'+amt : ''}`;
      if (svc === 'bitcoin')
        return `bitcoin:${id}${amt ? '?amount='+amt : ''}`;
      if (svc === 'ethereum')
        return `ethereum:${id}${amt ? '?value='+amt : ''}`;
      return id;
    }

    case 'applink':
      return fields.store_url || '';

    case 'location':
      return `geo:${fields.lat},${fields.lon}`;

    case 'calendar': {
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//QR Generator//EN',
        'BEGIN:VEVENT',
        `SUMMARY:${fields.title || ''}`,
        `DTSTART:${fmtDateTime(fields.start)}`,
      ];
      if (fields.end)         lines.push(`DTEND:${fmtDateTime(fields.end)}`);
      if (fields.loc)         lines.push(`LOCATION:${fields.loc}`);
      if (fields.description) lines.push(`DESCRIPTION:${fields.description}`);
      lines.push('END:VEVENT', 'END:VCALENDAR');
      return lines.join('\r\n');
    }

    case 'totp': {
      const account = encodeURIComponent(fields.account || '');
      const issuer  = (fields.issuer || '').trim();
      const secret  = (fields.secret || '').toUpperCase().replace(/\s/g, '');
      const label   = issuer ? `${encodeURIComponent(issuer)}:${account}` : account;
      let uri = `otpauth://totp/${label}?secret=${secret}`;
      if (issuer) uri += `&issuer=${encodeURIComponent(issuer)}`;
      return uri;
    }

    case 'text':
      return fields.text || '';

    default:
      return '';
  }
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function makeField(f) {
  if (f.type === 'hint') {
    const p = document.createElement('p');
    p.className = 'field-hint full';
    p.textContent = f.text;
    return p;
  }

  const wrap = document.createElement('div');
  wrap.className = 'field-group' + (f.full ? ' full' : '');

  if (f.type === 'checkbox') {
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.id = `f-${f.id}`;
    inp.dataset.id = f.id;
    const lbl = document.createElement('label');
    lbl.htmlFor = inp.id;
    lbl.textContent = f.label;
    row.append(inp, lbl);
    wrap.append(row);
    return wrap;
  }

  const lbl = document.createElement('label');
  lbl.htmlFor = `f-${f.id}`;
  lbl.textContent = f.label;
  wrap.appendChild(lbl);

  let inp;
  if (f.type === 'select') {
    inp = document.createElement('select');
    (f.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      inp.appendChild(o);
    });
  } else if (f.type === 'textarea') {
    inp = document.createElement('textarea');
    if (f.placeholder) inp.placeholder = f.placeholder;
    if (f.maxlength)   inp.maxLength = f.maxlength;
  } else {
    inp = document.createElement('input');
    inp.type = f.type;
    if (f.placeholder) inp.placeholder = f.placeholder;
    if (f.step)        inp.step = f.step;
    if (f.maxlength)   inp.maxLength = f.maxlength;
  }

  inp.id = `f-${f.id}`;
  inp.dataset.id = f.id;
  if (f.required) inp.required = true;
  wrap.appendChild(inp);
  return wrap;
}

function readFields(typeId) {
  const fields = {};
  getFields(typeId).forEach(f => {
    if (f.type === 'hint') return;
    const el = document.getElementById(`f-${f.id}`);
    if (!el) return;
    fields[f.id] = f.type === 'checkbox' ? el.checked : el.value;
  });
  return fields;
}

function validateFields(typeId) {
  const fields = getFields(typeId).filter(f => f.required);
  for (const f of fields) {
    const el = document.getElementById(`f-${f.id}`);
    if (!el) continue;
    const val = f.type === 'checkbox' ? el.checked : el.value.trim();
    if (!val) return `"${f.label}" is required.`;
  }
  return null;
}

// ── State ──────────────────────────────────────────────────────────────────

let currentType = 'url';
let previewTimer = null;

// ── Render ─────────────────────────────────────────────────────────────────

function renderTabs() {
  const container = document.getElementById('type-tabs');
  container.innerHTML = '';
  TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'type-tab' + (t.id === currentType ? ' active' : '');
    btn.textContent = t.label;
    btn.dataset.type = t.id;
    btn.addEventListener('click', () => selectType(t.id));
    container.appendChild(btn);
  });
}

function renderForm(typeId) {
  const container = document.getElementById('qr-form');
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  getFields(typeId).forEach(f => grid.appendChild(makeField(f)));
  container.appendChild(grid);

  // Live preview on any input change
  container.querySelectorAll('input,select,textarea').forEach(el => {
    el.addEventListener('input', schedulePreview);
    el.addEventListener('change', schedulePreview);
  });
}

function selectType(typeId) {
  currentType = typeId;
  renderTabs();
  renderForm(typeId);
  clearPreview();
  hideError();
}

// ── Preview ────────────────────────────────────────────────────────────────

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
}

function clearPreview() {
  const img = document.getElementById('preview-img');
  const ph  = document.getElementById('preview-placeholder');
  img.hidden = true;
  ph.hidden = false;
  document.getElementById('download-btn').disabled = true;
}

async function updatePreview() {
  const fields = readFields(currentType);
  const qrData = formatQRData(currentType, fields);
  if (!qrData.trim()) { clearPreview(); return; }

  const payload = {
    data: qrData,
    fg_color: document.getElementById('fg-color').value,
    bg_color: document.getElementById('bg-color').value,
    error_correction: document.getElementById('ec-level').value,
  };

  try {
    const res = await fetch('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { clearPreview(); return; }

    const img = document.getElementById('preview-img');
    const ph  = document.getElementById('preview-placeholder');
    img.src = json.image;
    img.hidden = false;
    ph.hidden = true;
    document.getElementById('download-btn').disabled = false;
    hideError();
  } catch (_) {
    clearPreview();
  }
}

// ── Download ───────────────────────────────────────────────────────────────

async function downloadZip() {
  hideError();
  const validationError = validateFields(currentType);
  if (validationError) { showError(validationError); return; }

  const fields = readFields(currentType);
  const qrData = formatQRData(currentType, fields);
  if (!qrData.trim()) { showError('Please fill in the required fields.'); return; }

  const filename = (document.getElementById('filename').value.trim() || 'qrcode');

  const payload = {
    data: qrData,
    fg_color: document.getElementById('fg-color').value,
    bg_color: document.getElementById('bg-color').value,
    error_correction: document.getElementById('ec-level').value,
    filename,
  };

  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.textContent = 'Generating…';

  try {
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      showError(json.error || 'Generation failed.');
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${filename}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download ZIP (3 PNG + SVG)';
  }
}

function showError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.hidden = false;
}

function hideError() {
  document.getElementById('form-error').hidden = true;
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  renderForm(currentType);

  document.getElementById('download-btn').addEventListener('click', downloadZip);

  // Re-preview when customize options change
  ['fg-color', 'bg-color', 'ec-level'].forEach(id => {
    document.getElementById(id).addEventListener('change', schedulePreview);
  });
});
