/* فلترة ذكية لبطاقات الفعاليات — تعتمد على نص البطاقة فقط
 * تدعم: بحث حر + مفاتيح: type: , city: , time: , date: , free:/paid:
 * وتعمل مع واجهة الفلاتر (chips/select/date) أعلاه.
 */

(() => {
  // عناصر الواجهة
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const q = $('#q');
  const clearBtn = $('#clear');
  const countEl = $('#count');
  const noResultsEl = $('#no-results');

  const typeChipsWrap = $('#type-chips');
  const citySel = $('#city');
  const timeMorning = $('#time-morning');
  const timeEvening = $('#time-evening');
  const freeChip = $('#free-chip');
  const paidChip = $('#paid-chip');
  const dateInput = $('#date');
  const monthSel = $('#month');
  const dayInput = $('#day');
  const resetAllBtn = $('#reset-all');

  // البطاقات
  const cards = $$('main article');
  const total = cards.length;

  // خرائط مساعدة
  const AR_DIGITS = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  const MONTHS_AR = {
    'يناير':1,'فبراير':2,'مارس':3,
    'ابريل':4,'أبريل':4,'ابربل':4, // معالجة أخطاء شائعة
    'مايو':5,'يونيو':6,'يوليو':7,
    'اغسطس':8,'أغسطس':8,
    'سبتمبر':9,'اكتوبر':10,'أكتوبر':10,
    'نوفمبر':11,'ديسمبر':12
  };
  const MONTHS_CANON = {
    8:['اغسطس','أغسطس'],
    9:['سبتمبر'],
    10:['اكتوبر','أكتوبر'],
    11:['نوفمبر'],
    12:['ديسمبر']
  };
  const CITIES = ['الدمام','الخبر','الظهران','القطيف','الجبيل الصناعية','الجبيل','النعيرية','حفر الباطن'];
  const TYPE_SYNONYMS = {
    'ترفيه': ['ترفيه','تسلية','تسلية وترفيه','entertainment'],
    'رياضة': ['رياضة','sport','sports'],
    'مغامرات': ['مغامرات','adventure'],
    'ثقافة': ['ثقافة','ثقافة وتراث','تراث','culture','heritage'],
    'أعمال': ['فعاليات الأعمال','أعمال','business'],
    'طبيعة': ['طبيعة','طبيعة ومغامرات','nature']
  };

  // Helpers
  function normalize(str) {
    if (!str) return '';
    let s = str.toString();
    s = s.replace(/[٠-٩]/g, d => AR_DIGITS[d] || d);                // أرقام عربية -> لاتينية
    s = s.replace(/[\u0617-\u061A\u064B-\u0652]/g, '');             // إزالة التشكيل
    s = s.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, ' ')  // رموز -> مسافة
         .replace(/\s+/g,' ').trim();
    return s;
  }
  const includes = (hay, needle) => normalize(hay).includes(normalize(needle));

  function extractDates(raw) {
    // نلتقط "التاريخ:" أو "الفترة:" وأي أرقام/أشهر/سنوات
    const days = new Set();
    const months = new Set();
    const years = new Set();
    let hasRange = false;

    // أرقام الأيام
    const dayMatches = raw.match(/\b(\d{1,2})\b/g);
    if (dayMatches) dayMatches.forEach(d => {
      const n = parseInt(d,10);
      if (n>=1 && n<=31) days.add(n);
    });

    // الأشهر العربية
    Object.keys(MONTHS_AR).forEach(name => {
      if (new RegExp(name).test(raw)) months.add(name);
    });

    // سنوات
    const yearMatches = raw.match(/\b(20\d{2})\b/g);
    if (yearMatches) yearMatches.forEach(y => years.add(parseInt(y,10)));

    // مدى؟
    if (/[-–—]\s*\d/.test(raw) || /إلى|حتى/.test(raw)) hasRange = true;

    return { days, months, years, hasRange };
  }

  function detectTypes(text) {
    const found = [];
    for (const [canon, arr] of Object.entries(TYPE_SYNONYMS)) {
      if (arr.some(a => includes(text, a)) || includes(text, canon)) {
        found.push(canon);
      }
    }
    return [...new Set(found)];
  }

  function detectCity(text) {
    for (const c of CITIES) { if (includes(text, c)) return c; }
    return '';
  }

  function detectTimeOfDay(raw) {
    const hasMorning = /صباح/.test(raw);
    const hasEvening = /مساء/.test(raw);
    return hasMorning && hasEvening ? 'كِلاهما' : (hasMorning ? 'صباح' : (hasEvening ? 'مساء' : ''));
  }

  function detectCharge(raw) {
    const isFree = /مجاني|الدخول مجان/.test(raw);
    const isPaid = /يوجد رسوم|رسوم/.test(raw);
    return isFree ? 'مجاني' : (isPaid ? 'مدفوع' : '');
  }

  function indexCard(card) {
    const raw = card.textContent || '';
    const norm = normalize(raw);
    const titleEl = card.querySelector('h3');
    const title = titleEl ? titleEl.textContent.trim() : '';
    const types = detectTypes(raw);
    const city = detectCity(raw);
    const timeOfDay = detectTimeOfDay(raw);
    const charge = detectCharge(raw);
    const dateInfo = extractDates(raw);
    return { card, raw, norm, title, types, city, timeOfDay, charge, dateInfo };
  }

  const INDEX = cards.map(indexCard);

  // تعامل مع أزرار chip (نضيف/نزيل تحديد مرئي)
  function toggleChip(btn) {
    btn.classList.toggle('ring-2');
    btn.classList.toggle('ring-sky-500');
    btn.classList.toggle('bg-sky-50');
    btn.classList.toggle('text-sky-700');
    btn.classList.toggle('border-sky-300');
    btn.classList.toggle('shadow-sm');
    btn.classList.toggle('aria-pressed');
  }
  // تهيئة ستايل chip (Tailwind utilities)
  function primeChips() {
    $$('.chip').forEach(btn => {
      btn.classList.add(
        'rounded-xl','border','border-slate-300','bg-white','px-3','py-1.5','text-sm',
        'hover:bg-slate-50','transition','select-none'
      );
      btn.setAttribute('aria-pressed','false');
    });
  }
  primeChips();

  // محلّل استعلام نصي: كلمات + key:value
  function parseQuery(input) {
    const tokens = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = re.exec(input))) tokens.push(m[1] || m[2]);

    const filters = { type: [], city: [], time: [], date: [], charge: [] };
    const terms = [];

    const keyMap = {
      'type':'type','النوع':'type','فئة':'type',
      'city':'city','المدينة':'city','الموقع':'city','مكان':'city',
      'time':'time','وقت':'time','الفترة':'time','فترة':'time',
      'date':'date','تاريخ':'date','يوم':'date','month':'date','شهر':'date',
      'free':'charge','paid':'charge','رسوم':'charge','مجاني':'charge'
    };

    tokens.forEach(tok => {
      if (tok.includes(':')) {
        let [k, ...rest] = tok.split(':');
        const v = rest.join(':').trim();
        const kCanon = keyMap[k.trim()] || k.trim();
        if (!v) return;
        if (kCanon === 'charge') {
          const lv = v.toLowerCase();
          if (k === 'free') filters.charge.push(lv==='yes'||lv==='true'?'مجاني':'مدفوع');
          else if (k === 'paid' || k === 'رسوم') filters.charge.push(lv==='yes'||lv==='true'?'مدفوع':'مجاني');
          else filters.charge.push(v);
        } else {
          filters[kCanon]?.push(v);
        }
      } else {
        const t = tok.trim();
        if (/^مجاني$/i.test(t)) filters.charge.push('مجاني');
        else if (/^مدفوع|رسوم$/i.test(t)) filters.charge.push('مدفوع');
        else if (/^صباح/.test(t)) filters.time.push('صباح');
        else if (/^مساء/.test(t)) filters.time.push('مساء');
        else terms.push(t);
      }
    });

    return { terms, filters };
  }

  function matchType(cardTypes, qVal) {
    const v = normalize(qVal);
    for (const [canon, arr] of Object.entries(TYPE_SYNONYMS)) {
      if (normalize(canon) === v) return cardTypes.includes(canon);
      if (arr.some(a => normalize(a) === v)) return cardTypes.includes(canon);
    }
    return cardTypes.some(t => normalize(t).includes(v));
  }

  function matchDate(card, qdate) {
    // يدعم: YYYY-MM-DD | "12" | "سبتمبر" | "12-سبتمبر"
    const { raw, norm, dateInfo } = card;
    const s = normalize(qdate);

    // ISO: 2025-09-12
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const m = s.match(iso);
    if (m) {
      const yyyy = +m[1], mm = +m[2], dd = +m[3];
      const monthNames = Object.entries(MONTHS_AR).filter(([,num]) => num===mm).map(([n])=>n);
      const dayHit = new RegExp(`\\b${dd}\\b`).test(raw);
      const monthHit = monthNames.some(n => new RegExp(n).test(raw));
      const yearHit = new RegExp(`\\b${yyyy}\\b`).test(raw);
      return dayHit && monthHit && yearHit;
    }

    // شهر عربي فقط
    for (const [name] of Object.entries(MONTHS_AR)) {
      if (s.includes(normalize(name))) return new RegExp(name).test(raw);
    }

    // يوم فقط
    if (/^\d{1,2}$/.test(s)) {
      const dd = parseInt(s,10);
      return new RegExp(`\\b${dd}\\b`).test(raw);
    }

    // 12-سبتمبر أو سبتمبر-12
    const parts = s.split(/[-\/\s]/).filter(Boolean);
    if (parts.length === 2) {
      const [a,b] = parts;
      const day = /^\d{1,2}$/.test(a) ? parseInt(a,10) : (/^\d{1,2}$/.test(b) ? parseInt(b,10) : null);
      const monName = Object.keys(MONTHS_AR).find(n => s.includes(normalize(n)));
      if (day && monName) {
        return new RegExp(`\\b${day}\\b`).test(raw) && new RegExp(monName).test(raw);
      }
    }

    // افتراضي: كنص حر
    return norm.includes(s);
  }

  function uiState() {
    const selectedTypes = [];
    $$('#type-chips button').forEach(b => {
      if (b.classList.contains('ring-sky-500')) selectedTypes.push(b.dataset.type);
    });

    const city = citySel.value || '';

    const time = [];
    if (timeMorning.classList.contains('ring-sky-500')) time.push('صباح');
    if (timeEvening.classList.contains('ring-sky-500')) time.push('مساء');

    const charge = [];
    if (freeChip.classList.contains('ring-sky-500')) charge.push('مجاني');
    if (paidChip.classList.contains('ring-sky-500')) charge.push('مدفوع');

    const dateFilters = [];
    if (dateInput.value) dateFilters.push(dateInput.value); // ISO
    if (monthSel.value) dateFilters.push(monthSel.value);   // شهر
    if (dayInput.value) dateFilters.push(dayInput.value);   // يوم

    return { selectedTypes, city, time, charge, dateFilters };
  }

  function applyFilters() {
    const { terms, filters } = parseQuery(q.value || '');
    const ui = uiState();

    // دمج فلاتر النص مع واجهة المستخدم (AND)
    const all = {
      terms,
      type: [...filters.type, ...ui.selectedTypes],
      city: [...filters.city, ...(ui.city ? [ui.city] : [])],
      time: [...filters.time, ...ui.time],
      charge: [...filters.charge, ...ui.charge],
      date: [...filters.date, ...ui.dateFilters]
    };

    let shown = 0;

    INDEX.forEach(info => {
      const { card, norm, raw, types, city, timeOfDay, charge } = info;

      // 1) الكلمات الحرة: لازم كلها تتواجد
      let ok = all.terms.every(t => norm.includes(normalize(t)));

      // 2) النوع
      if (ok && all.type.length) {
        ok = all.type.every(v => matchType(types, v));
      }

      // 3) المدينة
      if (ok && all.city.length) {
        ok = all.city.every(v => {
          const nv = normalize(v);
          return city ? normalize(city).includes(nv) : norm.includes(nv);
        });
      }

      // 4) الوقت
      if (ok && all.time.length) {
        ok = all.time.every(v => {
          const nv = normalize(v);
          if (!timeOfDay) return /صباح|مساء/.test(nv) ? false : norm.includes(nv);
          if (nv.includes('صباح')) return timeOfDay === 'صباح' || timeOfDay === 'كِلاهما';
          if (nv.includes('مساء')) return timeOfDay === 'مساء' || timeOfDay === 'كِلاهما';
          return norm.includes(nv);
        });
      }

      // 5) الرسوم
      if (ok && all.charge.length) {
        ok = all.charge.every(v => {
          const nv = normalize(v);
          if (nv.includes('مجاني') || nv === 'free' || nv === 'yes' || nv === 'true') return charge === 'مجاني';
          if (nv.includes('مدفوع') || nv.includes('رسوم') || nv === 'paid') return charge === 'مدفوع';
          return norm.includes(nv);
        });
      }

      // 6) التاريخ
      if (ok && all.date.length) {
        ok = all.date.every(v => matchDate(info, v));
      }

      card.classList.toggle('hidden', !ok);
      shown += ok ? 1 : 0;
    });

    countEl.textContent = `النتائج: ${shown} من ${total}`;
    noResultsEl.classList.toggle('hidden', shown !== 0);
  }

  // أحداث واجهة المستخدم
  q?.addEventListener('input', applyFilters);
  clearBtn?.addEventListener('click', () => { q.value=''; applyFilters(); q.focus(); });

  // نوع (chips)
  typeChipsWrap?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    toggleChip(btn);
    applyFilters();
  });

  // الوقت/الرسوم
  [timeMorning, timeEvening, freeChip, paidChip].forEach(btn => {
    btn?.addEventListener('click', () => { toggleChip(btn); applyFilters(); });
  });

  // المدينة/التاريخ
  citySel?.addEventListener('change', applyFilters);
  dateInput?.addEventListener('change', applyFilters);
  monthSel?.addEventListener('change', applyFilters);
  dayInput?.addEventListener('input', applyFilters);

  // إعادة الضبط
  resetAllBtn?.addEventListener('click', () => {
    // نص
    q.value = '';
    // نوع
    $$('#type-chips button').forEach(b => {
      b.classList.remove('ring-2','ring-sky-500','bg-sky-50','text-sky-700','border-sky-300','shadow-sm','aria-pressed');
    });
    // مدينة
    citySel.value = '';
    // وقت/رسوم
    [timeMorning,timeEvening,freeChip,paidChip].forEach(b => {
      b.classList.remove('ring-2','ring-sky-500','bg-sky-50','text-sky-700','border-sky-300','shadow-sm','aria-pressed');
    });
    // تاريخ
    dateInput.value = '';
    monthSel.value = '';
    dayInput.value = '';
    applyFilters();
  });

  // تشغيل أولي
  applyFilters();
})();
