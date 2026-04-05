import * as XLSX from "xlsx";

export interface TripleValue {
  total: number;
  jihi: number;
  hoken: number;
}

export interface ClinicMonthData {
  yearMonth: string;
  fileName: string;
  sheet1: {
    shiharaiGoukei: TripleValue;
    genkin: TripleValue;
    credit: TripleValue;
    qr: TripleValue;
    emoney: TripleValue;
    henkin: TripleValue;
    nyukinGoukei: TripleValue;
    uriaGeGoukei: TripleValue;
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
    shohosenRyo: number;
    sonotaTensu: number;
    gazoShindan: number;
  };
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n);
};

// ラベルを含む行から最初の数値を返す
function findRowValues(rows: unknown[][], labels: string[]): number {
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (labels.some((l) => cell === l || cell.includes(l))) {
        for (let vc = c + 1; vc < Math.min(c + 4, row.length); vc++) {
          const val = toNum(row[vc]);
          if (val !== 0) return val;
        }
        return 0;
      }
    }
  }
  return 0;
}

// ラベル行から total/jihi/hoken の3値を返す（最大値の行を採用）
function findTripleValues(rows: unknown[][], labels: string[]): TripleValue {
  let best: TripleValue = { total: 0, jihi: 0, hoken: 0 };

  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (labels.some((l) => cell === l)) {
        const vals: number[] = [];
        for (let vc = c + 1; vc < row.length && vals.length < 3; vc++) {
          const v = row[vc];
          if (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) {
            vals.push(Math.round(Number(v)));
          }
        }
        if (vals.length >= 1) {
          const candidate: TripleValue = {
            total: vals[0] ?? 0,
            jihi: vals[1] ?? 0,
            hoken: vals[2] ?? 0,
          };
          if (candidate.total > best.total) {
            best = candidate;
          }
        }
      }
    }
  }
  return best;
}

function extractYearMonth(fileName: string, rows: unknown[][]): string {
  const m1 = fileName.match(/(\d{4})年(\d{1,2})月/);
  if (m1) return `${m1[1]}年${m1[2]}月`;
  const m2 = fileName.match(/(\d{4})[_\-](\d{2})/);
  if (m2) return `${m2[1]}年${parseInt(m2[2])}月`;

  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      if (!cell) continue;
      const s = String(cell);
      const md = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}/);
      if (md) return `${md[1]}年${parseInt(md[2])}月`;
      const md2 = s.match(/(\d{4})年(\d{1,2})月/);
      if (md2) return `${md2[1]}年${parseInt(md2[2])}月`;
    }
  }
  return fileName.replace(/\.[^/.]+$/, "");
}

function parseSheet1(ws: XLSX.WorkSheet): ClinicMonthData["sheet1"] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

  return {
    shiharaiGoukei: findTripleValues(rows, ["支払い合計(税込)", "支払合計(税込)", "支払い合計（税込）"]),
    genkin: findTripleValues(rows, ["現金"]),
    credit: findTripleValues(rows, ["クレジットカード", "クレジット"]),
    qr: findTripleValues(rows, ["ＱＲ決済", "QR決済", "QR"]),
    emoney: findTripleValues(rows, ["電子マネー"]),
    henkin: findTripleValues(rows, ["返金対応用", "返金"]),
    nyukinGoukei: findTripleValues(rows, ["入金額合計", "入金合計"]),
    uriaGeGoukei: findTripleValues(rows, ["売り上げ合計(税込)", "売上合計(税込)", "売上合計（税込）"]),
  };
}

function parseHoken(ws: XLSX.WorkSheet): ClinicMonthData["hoken"] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

  return {
    tensuGoukei: findRowValues(rows, ["保険点数合計"]),
    seikyuGoukei: findRowValues(rows, ["保険請求額合計"]),
    madoGuchiGoukei: findRowValues(rows, ["窓口負担額合計"]),
    mishuGoukei: findRowValues(rows, ["未収金合計"]),
    shaHo: findRowValues(rows, ["社保"]),
    kokuHo: findRowValues(rows, ["国保"]),
    rosai: findRowValues(rows, ["労災"]),
    jibaiseki: findRowValues(rows, ["自賠責"]),
    kogai: findRowValues(rows, ["公害"]),
    sonota: findRowValues(rows, ["その他"]),
    shoshinRyo: findRowValues(rows, ["初診料"]),
    saishinRyo: findRowValues(rows, ["再診料"]),
    kanriRyo: findRowValues(rows, ["管理料"]),
    zaitakuRyo: findRowValues(rows, ["在宅料"]),
    chusha: findRowValues(rows, ["皮下・筋肉内注射", "皮下筋肉内注射"]),
    shochi: findRowValues(rows, ["処置行為"]),
    shujutsu: findRowValues(rows, ["手術"]),
    kensa: findRowValues(rows, ["検査"]),
    byori: findRowValues(rows, ["病理診断"]),
    shohosenRyo: findRowValues(rows, ["処方箋料"]),
    sonotaTensu: findRowValues(rows, ["その他（リハビリ", "その他(リハビリ"]),
    gazoShindan: findRowValues(rows, ["画像診断"]),
  };
}

export async function parseClinicExcel(file: File): Promise<ClinicMonthData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const s1Name =
          wb.SheetNames.find((n) => n.toLowerCase() === "sheet1" || n === "Sheet1") ??
          wb.SheetNames.find((n) => !n.includes("保険")) ??
          wb.SheetNames[0];

        const hName = wb.SheetNames.find((n) => n.includes("保険"));

        const ws1 = wb.Sheets[s1Name];
        const wsH = hName ? wb.Sheets[hName] : null;

        const rows1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1, defval: "" }) as unknown[][];
        const yearMonth = extractYearMonth(file.name, rows1);

        resolve({
          yearMonth,
          fileName: file.name,
          sheet1: parseSheet1(ws1),
          hoken: wsH ? parseHoken(wsH) : ({} as ClinicMonthData["hoken"]),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
    reader.readAsArrayBuffer(file);
  });
}
