/**
 * APIレスポンスを安全にパースするヘルパー
 * response.ok でない場合も text() で取得してからJSONパースを試みる
 */
export async function safeApiCall<T extends { success?: boolean; error?: string }>(
  url: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      success: false,
      error: "サーバーエラーが発生しました",
    } as T;
  }
}
