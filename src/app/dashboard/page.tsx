"use client";
import { useState, useEffect, useCallback } from "react";
import { parseClinicExcel, parseClinicImage, type ClinicMonthData } from "@/lib/clinic-excel-parser";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";

const STORAGE_KEY = "dermapdf_clinic_monthly";

function loadSavedData(): ClinicMonthData[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveData(data: ClinicMonthData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const fmtYen = (n: number) =>
  n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;
const fmtNum = (n: number) => n.toLocaleString();

export default function DashboardPage() {
  const [allData, setAllData] = useState<ClinicMonthData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "sheet1" | "hoken" | "table">("overview");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setAllData(loadSavedData());
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    setLoading(true);
    setError(null);
    const results: ClinicMonthData[] = [];
    for (const file of Array.from(files)) {
      const isPng = file.name.match(/\.(png|jpg|jpeg)$/i);
      const isExcel = file.name.match(/\.(xlsx|xls)$/i);
      if (!isPng && !isExcel) continue;
      try {
        setError(`🤖 「${file.name}」をAIが解析中です（10〜30秒）...`);
        const parsed = isPng ? await parseClinicImage(file) : await parseClinicExcel(file);
        results.push(parsed);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "解析失敗"}`);
      }
    }
    if (results.length > 0) {
      setError(null);
      setAllData((prev) => {
        const merged = [...prev];
        for (const r of results) {
          const idx = merged.findIndex((d) => d.yearMonth === r.yearMonth);
          if (idx >= 0) merged[idx] = r;
          else merged.push(r);
        }
        merged.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
        saveData(merged);
        return merged;
      });
    }
    setLoading(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const chartData = allData.slice(-12).map((d) => ({
    month: d.yearMonth.replace("年", "/").replace("月", ""),
    支払合計: d.sheet1.shiharaiGoukei?.total ?? 0,
    自費: d.sheet1.shiharaiGoukei?.jihi ?? 0,
    保険: d.sheet1.shiharaiGoukei?.hoken ?? 0,
    現金: d.sheet1.genkin?.total ?? 0,
    クレジット: d.sheet1.credit?.total ?? 0,
    QR: d.sheet1.qr?.total ?? 0,
    保険点数: d.hoken.tensuGoukei ?? 0,
    保険請求額: d.hoken.seikyuGoukei ?? 0,
  }));

  const latest = allData[allData.length - 1];
  const prev = allData[allData.length - 2];
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
    >
      {/* D&Dオーバーレイ */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-[#378ADD]/10 border-4 border-dashed border-[#378ADD] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-8 py-6 text-center shadow-lg">
            <div className="text-3xl mb-2">📂</div>
            <div className="text-sm font-medium text-[#378ADD]">ここにドロップして追加</div>
            <div className="text-xs text-gray-400 mt-1">Excel(.xlsx)・画像(PNG/JPEG)対応</div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-[#378ADD] hover:underline">
            ← DermaPDF Pro
          </a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-700">📊 クリニック経営ダッシュボード</span>
          {allData.length > 0 && (
            <span className="text-xs text-gray-400">{allData.length}ヶ月分のデータ</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allData.length > 0 && (
            <button
              onClick={() => {
                if (confirm("全データを削除しますか？")) {
                  setAllData([]);
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              🗑 データリセット
            </button>
          )}
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#378ADD] text-white rounded-lg cursor-pointer hover:bg-[#185FA5] transition-colors">
            📂 月報をアップロード
            <input
              type="file"
              accept=".xlsx,.xls,.png,.jpg,.jpeg"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </label>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* アップロードエリア（初回） */}
        {allData.length === 0 && (
          <div
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer ${
              dragOver ? "border-[#378ADD] bg-[#E6F1FB]" : "border-gray-200 bg-white"
            }`}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">月報Excelをアップロード</h2>
            <p className="text-sm text-gray-400 mb-2">
              Excelまたはスクリーンショット(PNG/JPEG)をアップロード
            </p>
            <p className="text-xs text-gray-400 mb-1">
              AIが自動でデータを読み取ります
            </p>
            <p className="text-xs text-gray-300 mb-6">
              複数ファイルを一度にアップロード可能・データは自動保存されます
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-[#378ADD] text-white rounded-xl cursor-pointer hover:bg-[#185FA5] transition-colors text-sm font-medium">
              📂 ファイルを選択（複数可）
              <input
                type="file"
                accept=".xlsx,.xls,.png,.jpg,.jpeg"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
            {loading && <p className="mt-4 text-sm text-gray-400 animate-pulse">解析中...</p>}
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            <div className="mt-8 bg-gray-50 rounded-xl p-4 max-w-sm mx-auto text-left">
              <p className="text-xs font-medium text-gray-500 mb-2">📋 対応ファイル形式</p>
              <p className="text-xs text-gray-400">・Excel: 2026年3月.xlsx（Sheet1+保険タブ）</p>
              <p className="text-xs text-gray-400">・画像: PNG/JPEGのスクリーンショット</p>
              <p className="text-xs text-gray-400">・Gemini AIが画像を読み取って自動抽出</p>
            </div>
          </div>
        )}

        {/* ダッシュボード */}
        {allData.length > 0 && (
          <>
            {loading && (
              <div className="text-center text-sm text-gray-400 animate-pulse mb-4">解析中...</div>
            )}
            {error && (
              <div className="text-sm text-red-500 mb-4 p-3 bg-red-50 rounded-lg">{error}</div>
            )}

            {/* KPIカード */}
            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: "支払い合計(税込)",
                    value: fmtYen(latest.sheet1.shiharaiGoukei?.total ?? 0),
                    change: prev ? pct(latest.sheet1.shiharaiGoukei?.total, prev.sheet1.shiharaiGoukei?.total) : null,
                  },
                  {
                    label: "自費売上",
                    value: fmtYen(latest.sheet1.shiharaiGoukei?.jihi ?? 0),
                    change: prev ? pct(latest.sheet1.shiharaiGoukei?.jihi, prev.sheet1.shiharaiGoukei?.jihi) : null,
                  },
                  {
                    label: "保険収入",
                    value: fmtYen(latest.sheet1.shiharaiGoukei?.hoken ?? 0),
                    change: prev ? pct(latest.sheet1.shiharaiGoukei?.hoken, prev.sheet1.shiharaiGoukei?.hoken) : null,
                  },
                  {
                    label: "保険請求額",
                    value: fmtYen(latest.hoken.seikyuGoukei ?? 0),
                    change: prev ? pct(latest.hoken.seikyuGoukei, prev.hoken.seikyuGoukei) : null,
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="text-xs text-gray-400 mb-1">{kpi.label}</div>
                    <div className="text-lg font-medium text-gray-800">{kpi.value}</div>
                    <div className="text-xs text-gray-300 mt-0.5">{latest.yearMonth}</div>
                    {kpi.change !== null && (
                      <div className={`text-xs mt-1 ${kpi.change >= 0 ? "text-[#1D9E75]" : "text-[#E24B4A]"}`}>
                        {kpi.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.change)}% 前月比
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* タブ */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {([
                { id: "overview", label: "📈 売上推移" },
                { id: "sheet1", label: "💰 決済内訳" },
                { id: "hoken", label: "🏥 保険内訳" },
                { id: "table", label: "📋 月次一覧" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeTab === tab.id
                      ? "bg-[#378ADD] text-white border-[#378ADD]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#B5D4F4]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 売上推移グラフ */}
            {activeTab === "overview" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                <div className="text-sm font-medium text-gray-700 mb-4">月次売上推移（自費 / 保険）</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                    <Tooltip formatter={(v, name) => [fmtYen(Number(v ?? 0)), String(name)]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="自費" fill="#378ADD" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="保険" fill="#1D9E75" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 決済方法内訳 */}
            {activeTab === "sheet1" && latest && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-sm font-medium text-gray-700 mb-3">決済方法別（{latest.yearMonth}）</div>
                  {[
                    { label: "現金", data: latest.sheet1.genkin },
                    { label: "クレジットカード", data: latest.sheet1.credit },
                    { label: "QR決済", data: latest.sheet1.qr },
                    { label: "電子マネー", data: latest.sheet1.emoney },
                    { label: "返金対応用", data: latest.sheet1.henkin },
                  ].map((item) => (
                    <div key={item.label} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium">{fmtYen(item.data?.total ?? 0)}</span>
                      </div>
                      <div className="flex gap-1 text-[10px] text-gray-400">
                        <span>自費: {fmtYen(item.data?.jihi ?? 0)}</span>
                        <span>・</span>
                        <span>保険: {fmtYen(item.data?.hoken ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-sm font-medium text-gray-700 mb-3">決済方法別 推移</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                      <Tooltip formatter={(v) => fmtYen(Number(v ?? 0))} />
                      <Area type="monotone" dataKey="現金" stroke="#378ADD" fill="#E6F1FB" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="クレジット" stroke="#1D9E75" fill="#E1F5EE" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 保険内訳 */}
            {activeTab === "hoken" && latest && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-sm font-medium text-gray-700 mb-3">保険集計</div>
                  {[
                    { label: "保険点数合計", val: `${fmtNum(latest.hoken.tensuGoukei)}点` },
                    { label: "保険請求額合計", val: fmtYen(latest.hoken.seikyuGoukei) },
                    { label: "窓口負担額合計", val: fmtYen(latest.hoken.madoGuchiGoukei) },
                    { label: "未収金合計", val: fmtYen(latest.hoken.mishuGoukei) },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between py-2 border-b border-gray-50 text-xs last:border-0">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800">{r.val}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-sm font-medium text-gray-700 mb-3">保険請求額内訳</div>
                  {[
                    { label: "社保", val: latest.hoken.shaHo },
                    { label: "国保", val: latest.hoken.kokuHo },
                    { label: "労災", val: latest.hoken.rosai },
                    { label: "自賠責", val: latest.hoken.jibaiseki },
                    { label: "公害", val: latest.hoken.kogai },
                    { label: "その他", val: latest.hoken.sonotaHoken },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between py-2 border-b border-gray-50 text-xs last:border-0">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800">{fmtYen(r.val)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-sm font-medium text-gray-700 mb-3">点数内訳</div>
                  {[
                    { label: "初診料", val: latest.hoken.shoshinRyo },
                    { label: "再診料", val: latest.hoken.saishinRyo },
                    { label: "管理料", val: latest.hoken.kanriRyo },
                    { label: "在宅料", val: latest.hoken.zaitakuRyo },
                    { label: "皮下・筋肉内注射", val: latest.hoken.chusha },
                    { label: "処置行為", val: latest.hoken.shochi },
                    { label: "手術", val: latest.hoken.shujutsu },
                    { label: "検査", val: latest.hoken.kensa },
                    { label: "病理診断", val: latest.hoken.byori },
                    { label: "処方箋料", val: latest.hoken.shohosenRyo },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between py-1.5 border-b border-gray-50 text-xs last:border-0">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800">{fmtNum(r.val)}点</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 月次一覧テーブル */}
            {activeTab === "table" && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                  <div className="text-sm font-medium text-gray-700">
                    月次データ一覧（全{allData.length}ヶ月）
                  </div>
                  <button
                    onClick={() => {
                      const rows = allData.map((d) =>
                        [
                          d.yearMonth,
                          d.sheet1.shiharaiGoukei?.total,
                          d.sheet1.shiharaiGoukei?.jihi,
                          d.sheet1.shiharaiGoukei?.hoken,
                          d.sheet1.genkin?.total,
                          d.sheet1.credit?.total,
                          d.sheet1.qr?.total,
                          d.sheet1.emoney?.total,
                          d.hoken.tensuGoukei,
                          d.hoken.seikyuGoukei,
                          d.hoken.madoGuchiGoukei,
                        ].join(",")
                      );
                      const header = "年月,支払合計,自費,保険,現金,クレジット,QR,電子マネー,保険点数,保険請求額,窓口負担額";
                      const csv = "\uFEFF" + [header, ...rows].join("\n");
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                      a.download = "clinic_monthly.csv";
                      a.click();
                    }}
                    className="text-xs text-[#378ADD] hover:underline"
                  >
                    ⬇️ CSVエクスポート
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400">
                        {["年月", "支払合計", "自費", "保険", "現金", "クレジット", "QR", "電子マネー", "保険請求額", "前月比"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-medium border-b border-gray-100 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...allData].reverse().map((d, i) => {
                        const p = [...allData].reverse()[i + 1];
                        const ch = p ? pct(d.sheet1.shiharaiGoukei?.total, p.sheet1.shiharaiGoukei?.total) : null;
                        return (
                          <tr
                            key={d.yearMonth}
                            className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === 0 ? "bg-[#E6F1FB]/30" : ""}`}
                          >
                            <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${i === 0 ? "text-[#185FA5]" : "text-gray-700"}`}>
                              {d.yearMonth}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.shiharaiGoukei?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.shiharaiGoukei?.jihi ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.shiharaiGoukei?.hoken ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.genkin?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.credit?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.qr?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.sheet1.emoney?.total ?? 0)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtYen(d.hoken.seikyuGoukei ?? 0)}</td>
                            <td
                              className={`px-3 py-2.5 font-medium whitespace-nowrap ${
                                ch === null ? "text-gray-300" : ch >= 0 ? "text-[#1D9E75]" : "text-[#E24B4A]"
                              }`}
                            >
                              {ch === null ? "–" : `${ch >= 0 ? "▲" : "▼"}${Math.abs(ch)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
