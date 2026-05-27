'use client';

import { useState, useEffect, useRef } from 'react';

const DEFAULT_DESTINATIONS = [
  { name: '대련', code: 'DLC', emoji: '🏙' },
  { name: '칭다오', code: 'TAO', emoji: '🍺' },
  { name: '웨이하이', code: 'WEH', emoji: '🌊' },
  { name: '연태', code: 'YNT', emoji: '⛵' },
  { name: '하얼빈', code: 'HRB', emoji: '❄️' },
  { name: '샤먼', code: 'XMN', emoji: '🏝' },
  { name: '싼야', code: 'SYX', emoji: '🌴' },
  { name: '하이난', code: 'HAK', emoji: '☀️' },
];

const MAX_DESTINATIONS = 30;

interface Dest { code: string; name: string; emoji: string; }
interface Airport { code: string; name: string; city: string; country: string; }

async function searchAirports(query: string): Promise<Airport[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(query)}&locale=ko&types[]=airport&types[]=city`
    );
    const data = await res.json();
    return (data || []).slice(0, 6).map((item: any) => ({
      code: item.code,
      name: item.name,
      city: item.city_name || item.name,
      country: item.country_name || '',
    }));
  } catch { return []; }
}

function encodeTfs(from: string, to: string, departDate: string, returnDate?: string, adults: number = 1): string {
  function encodeStr(s: string): number[] { return Array.from(new TextEncoder().encode(s)); }
  function encodeSegment(date: string, orig: string, dest: string): number[] {
    const dateBytes = encodeStr(date);
    const origBytes = encodeStr(orig);
    const destBytes = encodeStr(dest);
    const seg = [0x12, dateBytes.length, ...dateBytes,
                 0x6a, 0x07, 0x08, 0x01, 0x12, origBytes.length, ...origBytes,
                 0x72, 0x07, 0x08, 0x01, 0x12, destBytes.length, ...destBytes];
    return [0x1a, seg.length, ...seg];
  }
  const seg1 = encodeSegment(departDate, from, to);
  const seg2 = returnDate ? encodeSegment(returnDate, to, from) : [];
  const header = [0x08, 0x1c, 0x10, 0x02];
  const footer = returnDate
    ? [0x40, 0x01, 0x40, 0x01, 0x48, 0x01, 0x70, 0x01]
    : [0x40, 0x01, 0x48, 0x01, 0x70, 0x01];
  const adultsField = [0x82, 0x01, 0x04, 0x08, adults, 0x10, adults, 0x98, 0x01, 0x01];
  const body = new Uint8Array([...header, ...seg1, ...seg2, ...footer, ...adultsField]);
  let binary = '';
  body.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeURL(from: string, to: string, departDate: string, returnDate?: string, adults: number = 1) {
  return `https://www.google.com/travel/flights/search?tfs=${encodeTfs(from, to, departDate, returnDate, adults)}`;
}

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full">
        <p className="text-sm text-gray-700 mb-5 text-center leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel}
            className="py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={onConfirm}
            className="py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function AirportSearch({ onSelect, onClose, placeholder }: {
  onSelect: (a: Airport) => void; onClose: () => void; placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Airport | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setResults(await searchAirports(query));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={ref} className="relative">
      {pending && (
        <ConfirmModal
          message={`${pending.city} (${pending.code})을(를) 추가하시겠습니까?`}
          onConfirm={() => { onSelect(pending); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-300 rounded-xl px-3 py-2">
        <span className="text-blue-400 text-sm">🔍</span>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-blue-300"
          placeholder={placeholder || '도시 또는 공항 검색...'} />
        {loading && <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-400 rounded-full animate-spin" />}
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
      </div>
      {results.length > 0 && (
        <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((a, i) => (
            <button key={i} onClick={() => setPending(a)}
              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0">
              <div>
                <span className="text-sm font-medium text-gray-800">{a.city}</span>
                <span className="text-xs text-gray-400 ml-1">{a.country}</span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">{a.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const now = new Date();
  const [dests, setDests] = useState<Dest[]>(DEFAULT_DESTINATIONS);
  const [fromAirport, setFromAirport] = useState<Airport>({ code: 'ICN', name: '인천국제공항', city: '서울', country: '대한민국' });
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [showFromSearch, setShowFromSearch] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Dest | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [adults, setAdults] = useState(1);
  const [directOnly, setDirectOnly] = useState(false);

  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const years = [now.getFullYear(), now.getFullYear() + 1];
  const mm = String(month).padStart(2, '0');
  const departDate = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const returnDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  function addDest(airport: Airport) {
    if (dests.find(d => d.code === airport.code)) return;
    if (dests.length >= MAX_DESTINATIONS) return;
    setDests(prev => [...prev, { code: airport.code, name: airport.city, emoji: '🌍' }]);
    setShowAddSearch(false);
  }

  function open(url: string) { window.open(url, '_blank'); }

  return (
    <main className="min-h-screen bg-gray-50">
      {pendingDelete && (
        <ConfirmModal
          message={`${pendingDelete.emoji} ${pendingDelete.name} (${pendingDelete.code})을(를) 삭제하시겠습니까?`}
          onConfirm={() => { setDests(prev => prev.filter(d => d.code !== pendingDelete.code)); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-lg font-bold tracking-tight">
          ✈ Flight<span className="text-blue-500">Finder</span>
        </div>
        <div className="text-xs text-gray-300">Google Flights 연동</div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">

        {/* ① 검색 설정 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

          {/* 출발지 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 font-medium mb-1.5">출발지</label>
            {showFromSearch ? (
              <AirportSearch
                onSelect={a => { setFromAirport(a); setShowFromSearch(false); }}
                onClose={() => setShowFromSearch(false)}
                placeholder="출발 도시 또는 공항 검색..."
              />
            ) : (
              <button onClick={() => setShowFromSearch(true)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left text-gray-700 hover:border-blue-300 transition-colors flex items-center justify-between">
                <span className="font-medium">{fromAirport.city} ({fromAirport.code})</span>
                <span className="text-gray-300 text-xs">변경 →</span>
              </button>
            )}
          </div>

          {/* 인원 + 직항 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">인원</label>
              <select value={adults} onChange={e => setAdults(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}명</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">직항</label>
              <select value={directOnly ? 'true' : 'false'} onChange={e => setDirectOnly(e.target.value === 'true')}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors">
                <option value="false">전체</option>
                <option value="true">직항만</option>
              </select>
            </div>
          </div>

          {/* 연/월 */}
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-2">검색 기준월</label>
            <div className="flex gap-2 mb-2">
              {years.map(y => (
                <button key={y} onClick={() => setYear(y)}
                  className={`px-4 py-1.5 rounded-xl text-sm border font-medium transition-all ${
                    year === y ? 'bg-gray-800 border-gray-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}>
                  {y}년
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {months.map((m, i) => {
                const mn = i + 1;
                const isPast = year === now.getFullYear() && mn < now.getMonth() + 1;
                return (
                  <button key={mn} onClick={() => !isPast && setMonth(mn)} disabled={isPast}
                    className={`py-2 rounded-xl text-sm border font-medium transition-all ${
                      month === mn ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                      : isPast ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-500'
                    }`}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ② 바로가기 그리드 */}
        {dests.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-400 font-semibold mb-3">
              🔗 {fromAirport.code} 출발 · {year}년 {month}월 왕복 바로가기
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dests.map(d => (
                <button key={d.code}
                  onClick={() => open(makeURL(fromAirport.code, d.code, departDate, returnDate, adults))}
                  className="flex items-center justify-between px-3 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group active:scale-95">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{d.emoji}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-700">{d.name}</div>
                      <div className="text-xs text-gray-400">{fromAirport.code} ↔ {d.code}</div>
                    </div>
                  </div>
                  <span className="text-blue-300 group-hover:text-blue-500 transition-colors text-lg">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {dests.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-3xl mb-2">✈️</div>
            <div className="text-sm text-gray-400">아래에서 목적지를 추가해주세요</div>
          </div>
        )}

        {/* ③ 목적지 관리 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs text-gray-400 font-medium">목적지 관리</span>
              <span className={`ml-2 text-xs font-normal ${dests.length >= MAX_DESTINATIONS ? 'text-red-400' : 'text-gray-300'}`}>
                {dests.length}/{MAX_DESTINATIONS}
              </span>
            </div>
            {dests.length < MAX_DESTINATIONS && !showAddSearch && (
              <button onClick={() => setShowAddSearch(true)}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors">
                + 도시 추가
              </button>
            )}
          </div>

          {dests.length >= MAX_DESTINATIONS && (
            <div className="mb-3 text-xs text-red-400 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              최대 {MAX_DESTINATIONS}개까지 등록 가능합니다. 기존 도시를 삭제 후 추가해주세요.
            </div>
          )}

          {showAddSearch && (
            <div className="mb-3">
              <AirportSearch onSelect={addDest} onClose={() => setShowAddSearch(false)} />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {dests.map(d => (
              <div key={d.code}
                className="flex items-center gap-1 pl-2.5 pr-1 py-1.5 bg-blue-500 text-white rounded-xl text-sm font-medium shrink-0">
                <span>{d.emoji} {d.name}</span>
                <button onClick={() => setPendingDelete(d)}
                  className="ml-1 w-5 h-5 rounded-lg bg-blue-400 hover:bg-red-400 flex items-center justify-center text-xs leading-none transition-colors">
                  ✕
                </button>
              </div>
            ))}
            {dests.length === 0 && (
              <div className="text-sm text-gray-300 py-1">+ 도시 추가 버튼으로 목적지를 추가해주세요</div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
