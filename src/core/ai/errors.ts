import type { Locale } from '../contracts'

export type AIErrorCode = 'invalid_config' | 'authentication' | 'rate_limit' | 'timeout' | 'cancelled' | 'network' | 'http_error' | 'invalid_response' | 'invalid_output' | 'invalid_evidence' | 'unsupported_completion' | 'scope_too_large' | 'empty_selection'

const messages: Record<Locale, Record<AIErrorCode, string>> = {
  en: {
    invalid_config: 'Check the provider URL, model and timeout. HTTPS is required except on localhost.',
    authentication: 'The provider rejected authentication. Check the key and account permissions.',
    rate_limit: 'The provider rate limit was reached. Try again later.',
    timeout: 'The provider request timed out. No review changes were saved.',
    cancelled: 'The review was cancelled. No review changes were saved.',
    network: 'The provider could not be reached. Check the endpoint and network.',
    http_error: 'The provider rejected the request. Check its endpoint and model configuration.',
    invalid_response: 'The provider returned an incomplete or unsupported response.',
    invalid_output: 'The review did not match the required format. No review changes were saved.',
    invalid_evidence: 'The review referenced missing or mismatched evidence. No review changes were saved.',
    unsupported_completion: 'A completed outcome lacked confirmation. No review changes were saved.',
    scope_too_large: 'This selection is too large. Select fewer sessions or a shorter period.',
    empty_selection: 'No readable messages are available in this selection.',
  },
  'zh-CN': {
    invalid_config: '请检查服务地址、模型和超时时间。除本机地址外须使用 HTTPS。',
    authentication: '服务拒绝了身份验证，请检查密钥及账号权限。',
    rate_limit: '已达到服务的调用频率限制，请稍后重试。',
    timeout: '模型请求超时，本次回顾未保存任何变化。',
    cancelled: '回顾已取消，本次回顾未保存任何变化。',
    network: '无法连接模型服务，请检查地址和网络。',
    http_error: '模型服务拒绝请求，请检查接口地址和模型配置。',
    invalid_response: '模型服务返回了不完整或不支持的响应。',
    invalid_output: '回顾结果格式不符合要求，本次回顾未保存任何变化。',
    invalid_evidence: '回顾引用了不存在或不匹配的证据，本次回顾未保存任何变化。',
    unsupported_completion: '完成状态缺少确认依据，本次回顾未保存任何变化。',
    scope_too_large: '所选内容过多，请缩小对话或时间范围。',
    empty_selection: '所选范围内没有可读取的消息。',
  },
  es: {
    invalid_config: 'Comprueba la URL, el modelo y el tiempo de espera. Se requiere HTTPS salvo en localhost.',
    authentication: 'El proveedor rechazó la autenticación. Comprueba la clave y los permisos.',
    rate_limit: 'Se alcanzó el límite de solicitudes. Inténtalo más tarde.',
    timeout: 'La solicitud agotó el tiempo de espera. No se guardaron cambios.',
    cancelled: 'La revisión se canceló. No se guardaron cambios.',
    network: 'No se pudo conectar con el proveedor. Comprueba la URL y la red.',
    http_error: 'El proveedor rechazó la solicitud. Comprueba la URL y el modelo.',
    invalid_response: 'El proveedor devolvió una respuesta incompleta o incompatible.',
    invalid_output: 'La revisión tiene un formato incorrecto. No se guardaron cambios.',
    invalid_evidence: 'La revisión citó evidencia inexistente o incorrecta. No se guardaron cambios.',
    unsupported_completion: 'El resultado completado carece de confirmación. No se guardaron cambios.',
    scope_too_large: 'La selección es demasiado grande. Reduce las sesiones o el periodo.',
    empty_selection: 'No hay mensajes legibles en esta selección.',
  },
  ja: {
    invalid_config: '接続先、モデル、タイムアウトを確認してください。localhost 以外は HTTPS が必要です。',
    authentication: '認証が拒否されました。キーと権限を確認してください。',
    rate_limit: 'リクエスト上限に達しました。しばらくして再試行してください。',
    timeout: 'リクエストがタイムアウトしました。変更は保存されていません。',
    cancelled: '振り返りを中止しました。変更は保存されていません。',
    network: 'モデルに接続できません。接続先とネットワークを確認してください。',
    http_error: 'リクエストが拒否されました。接続先とモデルを確認してください。',
    invalid_response: '不完全または未対応の応答が返されました。',
    invalid_output: '振り返りの形式が正しくありません。変更は保存されていません。',
    invalid_evidence: '存在しない、または一致しない証拠が引用されました。変更は保存されていません。',
    unsupported_completion: '完了を裏付ける確認がありません。変更は保存されていません。',
    scope_too_large: '選択範囲が大きすぎます。会話または期間を絞ってください。',
    empty_selection: '選択範囲に読み取れるメッセージがありません。',
  },
}

/** Deliberately excludes upstream response bodies, URLs and request headers. */
export class AIError extends Error {
  constructor(public readonly code: AIErrorCode, locale: Locale = 'en', public readonly status?: number) {
    super(messages[locale]?.[code] ?? messages.en[code])
    this.name = 'AIError'
  }
}

export function aiErrorMessage(error: unknown, locale: Locale = 'en'): string {
  return new AIError(error instanceof AIError ? error.code : 'network', locale).message
}
