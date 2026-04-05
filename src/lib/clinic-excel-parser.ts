import * as XLSX from "xlsx";

export interface ClinicMonthData {
  yearMonth: string;
  fileName: string;
  sheet1: {
    shiharaiGoukei: { total: number; jihi: number; hoken: number };
    genkin: { total: number; jihi: number; hoken: number };
    credit: { total: number; jihi: number; hoken: number };
    qr: { total: number; jihi: number; hoken: number };
    emoney: { total: number; jihi: number; hoken: number };
    henkin: { total: number; jihi: number; hoken: number };
    nyukinGoukei: { total: number; jihi: number; hoken: number };
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

function sheetToText(ws: XLSX.WorkSheet, sheetName: string): string {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
  const lines: string[] = [`=== シート: ${sheetName} ===`];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nonEmpty = row.filter((v) => v !== "" && v !== null && v !== undefined);
    if (nonEmpty.length > 0) {
      lines.push(`行${i + 1}: ${row.map((v) => v ?? "").join("\t")}`);
    }
  }
  return lines.join("\n");
}

const ZERO3 = { total: 0, jihi: 0, hoken: 0 };

function makeDefaultData(): { sheet1: ClinicMonthData["sheet1"]; hoken: ClinicMonthData["hoken"] } {
  return {
    sheet1: {
      shiharaiGoukei: { ...ZERO3 },
      genkin: { ...ZERO3 },
      credit: { ...ZERO3 },
      qr: { ...ZERO3 },
      emoney: { ...ZERO3 },
      henkin: { ...ZERO3 },
      nyukinGoukei: { ...ZERO3 },
    },
    hoken: {
      tensuGoukei: 0, seikyuGoukei: 0, madoGuchiGoukei: 0, mishuGoukei: 0,
      shaHo: 0, kokuHo: 0, rosai: 0, jibaiseki: 0, kogai: 0, sonota: 0,
      shoshinRyo: 0, saishinRyo: 0, kanriRyo: 0, zaitakuRyo: 0,
      chusha: 0, shochi: 0, shujutsu: 0, kensa: 0, byori: 0,
      shohosenRyo: 0, sonotaTensu: 0, gazoShindan: 0,
    },
  };
}

async function extractWithGemini(
  sheetTexts: Record<string, string>,
  apiKey: string
): Promise<{ yearMonth: string; sheet1: ClinicMonthData["sheet1"]; hoken: ClinicMonthData["hoken"] }> {
  const prompt = `以下はクリニックの月次集計Excelのデータです。
各シートのテキスト表現から、指定の項目を探して数値を抽出してJSON形式で返してください。
数値が見つからない場合は0を返してください。
ラベルの表記が多少異なっても、意味が同じなら抽出してください。

${Object.values(sheetTexts).join("\n\n")}

以下のJSON形式で返してください（他のテキストは一切不要）:
{
  "yearMonth": "YYYY年M月（日付情報から）",
  "sheet1": {
    "shiharaiGoukei": { "total": 0, "jihi": 0, "hoken": 0 },
    "genkin": { "total": 0, "jihi": 0, "hoken": 0 },
    "credit": { "total": 0, "jihi": 0, "hoken": 0 },
    "qr": { "total": 0, "jihi": 0, "hoken": 0 },
    "emoney": { "total": 0, "jihi": 0, "hoken": 0 },
    "henkin": { "total": 0, "jihi": 0, "hoken": 0 },
    "nyukinGoukei": { "total": 0, "jihi": 0, "hoken": 0 }
  },
  "hoken": {
    "tensuGoukei": 0, "seikyuGoukei": 0, "madoGuchiGoukei": 0, "mishuGoukei": 0,
    "shaHo": 0, "kokuHo": 0, "rosai": 0, "jibaiseki": 0, "kogai": 0, "sonota": 0,
    "shoshinRyo": 0, "saishinRyo": 0, "kanriRyo": 0, "zaitakuRyo": 0,
    "chusha": 0, "shochi": 0, "shujutsu": 0, "kensa": 0, "byori": 0,
    "shohosenRyo": 0, "sonotaTensu": 0, "gazoShindan": 0
  }
}

抽出のヒント:
- shiharaiGoukei: 「支払い合計(税込)」または「支払合計」のラベルに隣接する数値（合計/自費/保険の3列）
- genkin: 「現金」ラベルに隣接する数値
- credit: 「クレジットカード」または「クレジット」
- qr: 「QR」または「ＱＲ」
- emoney: 「電子マネー」
- henkin: 「返金」
- nyukinGoukei: 「入金額合計」または「入金合計」
- tensuGoukei: 「保険点数合計」
- seikyuGoukei: 「保険請求額合計」
- madoGuchiGoukei: 「窓口負担額合計」
- mishuGoukei: 「未収金合計」
- shaHo: 「社保」の金額
- kokuHo: 「国保」の金額
- shoshinRyo: 「初診料」の点数
- saishinRyo: 「再診料」の点数
- 小数点以下は切り捨てて整数で返す`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2000 },
      }),
    }
  );

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      ?.map((p: { text: string }) => p.text)
      ?.join("") ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AIからの応答をJSONとして解析できませんでした");

  const parsed = JSON.parse(jsonMatch[0]);
  const defaults = makeDefaultData();

  return {
    yearMonth: parsed.yearMonth || "",
    sheet1: { ...defaults.sheet1, ...parsed.sheet1 },
    hoken: { ...defaults.hoken, ...parsed.hoken },
  };
}

export async function parseClinicExcel(file: File, apiKey: string): Promise<ClinicMonthData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const sheetTexts: Record<string, string> = {};
        for (const name of wb.SheetNames) {
          sheetTexts[name] = sheetToText(wb.Sheets[name], name);
        }

        const extracted = await extractWithGemini(sheetTexts, apiKey);

        resolve({
          yearMonth: extracted.yearMonth || file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          sheet1: extracted.sheet1,
          hoken: extracted.hoken,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みエラー"));
    reader.readAsArrayBuffer(file);
  });
}
