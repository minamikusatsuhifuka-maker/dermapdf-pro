import * as XLSX from "xlsx";

export interface ClinicMonthData {
  yearMonth: string;
  fileName: string;
  sheet1: {
    shiharaiGoukei: { total: number; jihi: number; hoken: number };
    cash: { total: number; jihi: number; hoken: number };
    credit: { total: number; jihi: number; hoken: number };
    qr: { total: number; jihi: number; hoken: number };
    emoney: { total: number; jihi: number; hoken: number };
    refund: { total: number; jihi: number; hoken: number };
  };
  hoken: {
    tensuGoukei: number;
    seikyuGoukei: number;
    madoGuchiGoukei: number;
    mishuGoukei: number;
    shaHo: number;
    kokuHo: number;
    rosai: number;
    jibaiseki: number;
    kogai: number;
    sonota: number;
    shoshinRyo: number;
    saishinRyo: number;
    kanriRyo: number;
    zaitakuRyo: number;
    chusha: number;
    shochi: number;
    shujutsu: number;
    kensa: number;
    byori: number;
    sonotaTensu: number;
    shohosen: number;
  };
}

function extractYearMonthFromFileName(name: string): string {
  const m1 = name.match(/(\d{4})年(\d{1,2})月/);
  if (m1) return `${m1[1]}年${m1[2]}月`;
  const m2 = name.match(/(\d{4})[_\-](\d{2})/);
  if (m2) return `${m2[1]}年${parseInt(m2[2])}月`;
  const m3 = name.match(/(\d{4})(\d{2})/);
  if (m3) return `${m3[1]}年${parseInt(m3[2])}月`;
  return "";
}

function extractYearMonthFromCell(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  const m1 = s.match(/(\d{4})年(\d{1,2})月/);
  if (m1) return `${m1[1]}年${m1[2]}月`;
  const m2 = s.match(/(\d{4})[\/\-](\d{1,2})/);
  if (m2) return `${m2[1]}年${parseInt(m2[2])}月`;
  if (typeof val === "number" && val > 40000) {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}年${d.m}月`;
  }
  return "";
}

function parseSheet1(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  const LABELS = [
    { label: "支払い合計(税込)", key: "shiharaiGoukei", exact: true },
    { label: "現金", key: "cash", exact: false },
    { label: "クレジットカード", key: "credit", exact: false },
    { label: "ＱＲ決済", key: "qr", exact: false },
    { label: "電子マネー", key: "emoney", exact: false },
    { label: "返金対応用", key: "refund", exact: false },
  ];

  const result: Record<string, { total: number; jihi: number; hoken: number }> = {};

  for (const row of data) {
    const cellB = String(row[1] ?? "").trim();
    for (const l of LABELS) {
      const isMatch = l.exact ? cellB === l.label : cellB.includes(l.label);
      if (!isMatch) continue;
      const total = Number(row[2]) || 0;
      const jihi = Number(row[3]) || 0;
      const hoken = Number(row[4]) || 0;
      // 同じラベルが複数行にある場合、total値が最大の行を採用
      if (!result[l.key] || total > result[l.key].total) {
        result[l.key] = { total, jihi, hoken };
      }
    }
  }

  for (const l of LABELS) {
    if (!result[l.key]) result[l.key] = { total: 0, jihi: 0, hoken: 0 };
  }

  return result;
}

function parseHokenSheet(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  const result: Record<string, number> = {};

  const SUMMARY_LABELS = [
    { label: "保険点数合計", key: "tensuGoukei" },
    { label: "保険請求額合計", key: "seikyuGoukei" },
    { label: "窓口負担額合計", key: "madoGuchiGoukei" },
    { label: "未収金合計", key: "mishuGoukei" },
    { label: "社保", key: "shaHo" },
    { label: "国保", key: "kokuHo" },
    { label: "労災", key: "rosai" },
    { label: "自賠責", key: "jibaiseki" },
    { label: "公害", key: "kogai" },
    { label: "その他", key: "sonota" },
  ];

  const TENSU_LABELS = [
    { label: "初診料", key: "shoshinRyo" },
    { label: "再診料", key: "saishinRyo" },
    { label: "管理料", key: "kanriRyo" },
    { label: "在宅料", key: "zaitakuRyo" },
    { label: "皮下・筋肉内注射", key: "chusha" },
    { label: "処置行為", key: "shochi" },
    { label: "手術", key: "shujutsu" },
    { label: "検査", key: "kensa" },
    { label: "病理診断", key: "byori" },
    { label: "その他", key: "sonotaTensu" },
    { label: "処方箋料", key: "shohosen" },
  ];

  for (const row of data) {
    const cellG = String(row[6] ?? "").trim();
    const matchedG = SUMMARY_LABELS.find((l) => cellG.includes(l.label));
    if (matchedG) result[matchedG.key] = Number(row[7]) || 0;

    const cellJ = String(row[9] ?? "").trim();
    const matchedJ = TENSU_LABELS.find((l) => cellJ.includes(l.label));
    if (matchedJ && !result[matchedJ.key]) {
      result[matchedJ.key] = Number(row[10]) || 0;
    }
  }

  for (const l of [...SUMMARY_LABELS, ...TENSU_LABELS]) {
    if (result[l.key] === undefined) result[l.key] = 0;
  }

  return result;
}

export async function parseClinicExcel(file: File): Promise<ClinicMonthData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: false });

        let yearMonth = extractYearMonthFromFileName(file.name);

        const sheet1Name = wb.SheetNames.find((n) => n.toLowerCase() === "sheet1") ?? wb.SheetNames[0];
        const ws1 = wb.Sheets[sheet1Name];

        if (!yearMonth) {
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = ws1[addr];
              if (cell) {
                const ym = extractYearMonthFromCell(cell.v);
                if (ym) {
                  yearMonth = ym;
                  break;
                }
              }
            }
            if (yearMonth) break;
          }
        }

        if (!yearMonth) yearMonth = file.name.replace(/\.[^/.]+$/, "");

        const hokenName = wb.SheetNames.find((n) => n.includes("保険")) ?? "";
        const wsH = hokenName ? wb.Sheets[hokenName] : null;

        const sheet1Data = parseSheet1(ws1);
        const hokenData = wsH ? parseHokenSheet(wsH) : {};

        resolve({
          yearMonth,
          fileName: file.name,
          sheet1: sheet1Data as ClinicMonthData["sheet1"],
          hoken: hokenData as ClinicMonthData["hoken"],
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
    reader.readAsArrayBuffer(file);
  });
}
