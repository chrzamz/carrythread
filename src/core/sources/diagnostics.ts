import type { Locale } from '../contracts'

/** Pure data: safe to import in the renderer without any filesystem dependencies. */
export const SOURCE_DIAGNOSTICS: Record<string, readonly [string, string, string]> = {
  'Untitled session': ['无标题会话', 'Sesión sin título', '無題のセッション'],
  'Operation cancelled.': ['操作已取消。', 'Operación cancelada.', '操作をキャンセルしました。'],
  'Source not found.': ['未找到来源。', 'No se encontró la fuente.', 'ソースが見つかりません。'],
  'Permission denied.': ['没有读取权限。', 'Permiso denegado.', '読み取り権限がありません。'],
  'Symbolic links are not scanned.': ['不扫描符号链接。', 'No se exploran enlaces simbólicos.', 'シンボリックリンクは読み取りません。'],
  'Source is busy; try again.': ['来源正忙，请稍后重试。', 'La fuente está ocupada; inténtalo de nuevo.', 'ソースが使用中です。再試行してください。'],
  'Operation timed out.': ['操作超时。', 'La operación agotó el tiempo de espera.', '操作がタイムアウトしました。'],
  'Connection failed.': ['连接失败。', 'Falló la conexión.', '接続に失敗しました。'],
  'Invalid data format.': ['数据格式无效。', 'Formato de datos no válido.', 'データ形式が無効です。'],
  'Operation failed.': ['操作失败。', 'La operación falló.', '操作に失敗しました。'],
  'Some records have an unsupported shape and were skipped.': ['部分记录格式不受支持，已跳过。', 'Se omitieron registros con un formato no compatible.', '未対応の形式のレコードをスキップしました。'],
  'Invalid JSON file.': ['JSON 文件格式无效。', 'Archivo JSON no válido.', 'JSON ファイルが無効です。'],
  'A JSONL record exceeded the size limit.': ['一条 JSONL 记录超过大小限制。', 'Un registro JSONL superó el límite de tamaño.', 'JSONL レコードがサイズ制限を超えました。'],
  'An incomplete final JSONL record is waiting for more data.': ['JSONL 最后一条记录尚未写完，等待补齐。', 'El último registro JSONL está incompleto; se esperan más datos.', 'JSONL の最終レコードは書き込み途中です。'],
  'Invalid JSONL records were skipped.': ['已跳过格式无效的 JSONL 记录。', 'Se omitieron registros JSONL no válidos.', '無効な JSONL レコードをスキップしました。'],
  'Choose a specific history directory, not the home or filesystem root.': ['请选择具体的历史记录目录，不要选择用户主目录或文件系统根目录。', 'Elige un directorio de historial específico, no la carpeta personal ni la raíz.', 'ホームやルートではなく、履歴の専用フォルダーを選択してください。'],
  'Credential and configuration paths are not imported.': ['不导入凭证和配置路径。', 'No se importan rutas de credenciales ni de configuración.', '認証情報と設定のパスは取り込みません。'],
  'Directory depth limit reached.': ['已达到目录深度限制。', 'Se alcanzó el límite de profundidad de directorios.', 'フォルダーの深さ制限に達しました。'],
  'Symbolic links were skipped.': ['已跳过符号链接。', 'Se omitieron los enlaces simbólicos.', 'シンボリックリンクをスキップしました。'],
  'Unsupported source file type.': ['不支持这种来源文件类型。', 'Tipo de archivo de origen no compatible.', 'このソースファイル形式は未対応です。'],
  'File limit reached; coverage is incomplete.': ['已达到文件数量限制，覆盖不完整。', 'Se alcanzó el límite de archivos; la cobertura es parcial.', 'ファイル数の上限に達したため、読み取り範囲は不完全です。'],
  'A path outside the selected source was skipped.': ['已跳过选定来源范围外的路径。', 'Se omitió una ruta fuera de la fuente seleccionada.', '選択したソースの範囲外のパスをスキップしました。'],
  'A source file exceeded the size limit.': ['一个来源文件超过大小限制。', 'Un archivo de origen superó el límite de tamaño.', 'ソースファイルがサイズ制限を超えました。'],
  'Source changed during scanning; try again.': ['扫描时来源发生变化，请重试。', 'La fuente cambió durante el análisis; inténtalo de nuevo.', '読み取り中にソースが変更されました。再試行してください。'],
  'A source file grew beyond the size limit.': ['读取时来源文件增长并超过大小限制。', 'Un archivo creció y superó el límite durante la lectura.', '読み取り中にファイルがサイズ制限を超えました。'],
  'Records without event timestamps were excluded from the time filter.': ['时间筛选已排除缺少实际发生时间的记录。', 'El filtro temporal excluyó registros sin fecha del evento.', '発生日時のないレコードは期間指定の結果から除外しました。'],
  'Message text exceeded the import limit and was truncated.': ['消息正文超过导入限制，已截断。', 'El texto del mensaje superó el límite y se truncó.', 'メッセージが取り込み上限を超えたため、省略しました。'],
  'No supported Claude Code messages were found.': ['未找到可解析的 Claude Code 消息。', 'No se encontraron mensajes de Claude Code compatibles.', '対応する Claude Code メッセージが見つかりません。'],
  'No supported Codex messages were found.': ['未找到可解析的 Codex 消息。', 'No se encontraron mensajes de Codex compatibles.', '対応する Codex メッセージが見つかりません。'],
  'Unsupported Pi session version.': ['不支持该 Pi 会话版本。', 'Versión de sesión de Pi no compatible.', 'この Pi セッションのバージョンは未対応です。'],
  'No supported Pi messages were found.': ['未找到可解析的 Pi 消息。', 'No se encontraron mensajes de Pi compatibles.', '対応する Pi メッセージが見つかりません。'],
  'Unsupported Finch runtime snapshot.': ['不支持该 Finch 运行快照格式。', 'Instantánea de Finch no compatible.', 'この Finch 実行スナップショットは未対応です。'],
  'Finch runtime contains no supported message entries; native Pi logs are preferred.': ['Finch 快照中没有可解析的消息，优先使用原生 Pi 日志。', 'La instantánea de Finch no contiene mensajes compatibles; se prefieren los registros nativos de Pi.', 'Finch スナップショットに対応メッセージがありません。Pi のネイティブログを優先します。'],
  'Finch runtime is a snapshot; some event timestamps are unavailable.': ['Finch 运行记录为快照，部分实际消息时间不可用。', 'Finch contiene una instantánea; faltan algunas fechas de eventos.', 'Finch の実行記録はスナップショットのため、一部の発生日時は不明です。'],
  'No supported generic records were found.': ['未找到可解析的通用导入记录。', 'No se encontraron registros genéricos compatibles.', '対応する汎用インポートのレコードが見つかりません。'],
  'OpenCode records with missing session or message metadata were skipped.': ['已跳过缺少会话或消息元信息的 OpenCode 记录。', 'Se omitieron registros de OpenCode sin metadatos de sesión o mensaje.', 'セッションまたはメッセージ情報がない OpenCode レコードをスキップしました。'],
  'No supported OpenCode session metadata was found.': ['未找到可解析的 OpenCode 会话元信息。', 'No se encontraron metadatos de sesión de OpenCode compatibles.', '対応する OpenCode セッション情報が見つかりません。'],
  'Unsupported OpenCode database schema; use a supported session export.': ['不支持该 OpenCode 数据库结构，请使用支持的会话导出格式。', 'Esquema de OpenCode no compatible; utiliza una exportación de sesión compatible.', 'OpenCode データベース形式が未対応です。対応するセッションのエクスポートを使用してください。'],
  'OpenCode row limit reached; coverage is incomplete.': ['已达到 OpenCode 记录数量限制，覆盖不完整。', 'Se alcanzó el límite de filas de OpenCode; la cobertura es parcial.', 'OpenCode のレコード数上限に達したため、読み取り範囲は不完全です。'],
  'Invalid OpenCode message JSON was skipped.': ['已跳过无效的 OpenCode 消息 JSON。', 'Se omitió un mensaje JSON de OpenCode no válido.', '無効な OpenCode メッセージ JSON をスキップしました。'],
  'Invalid OpenCode part JSON was skipped.': ['已跳过无效的 OpenCode 内容块 JSON。', 'Se omitió un bloque JSON de OpenCode no válido.', '無効な OpenCode コンテンツ JSON をスキップしました。'],
  'Some OpenCode records could not be associated with their session or message.': ['部分 OpenCode 记录无法关联到会话或消息。', 'Algunos registros de OpenCode no se pudieron asociar a su sesión o mensaje.', '一部の OpenCode レコードをセッションまたはメッセージに関連付けられません。'],
  'Newer OpenCode session_message records are not supported; legacy records only.': ['尚不支持新版 OpenCode session_message 记录；本次仅读取旧格式记录。', 'Los registros nuevos session_message de OpenCode no son compatibles; solo se leyeron registros anteriores.', '新しい OpenCode の session_message は未対応です。旧形式のみを読み取りました。'],
  'Invalid scan time range.': ['扫描时间范围无效。', 'Intervalo de análisis no válido.', '読み取り期間が無効です。'],
  'Invalid scan limits.': ['扫描限制参数无效。', 'Límites de análisis no válidos.', '読み取り制限の設定が無効です。'],
}

export function translateDiagnostic(message: string, locale: Locale): string {
  const translations = SOURCE_DIAGNOSTICS[message]
  if (!translations || locale === 'en') return message
  return translations[locale === 'zh-CN' ? 0 : locale === 'es' ? 1 : 2]
}
