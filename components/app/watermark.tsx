/**
 * Watermark discreta aplicada no canto inferior esquerdo dos slides exportados.
 * Visível apenas em usuários do plano Free — planos pagos e admin exportam limpo.
 *
 * Posicionamento absoluto: funciona tanto no preview (scale < 1) quanto no
 * export canvas (scale = 1, 1080×1350). O font-size em px é relativo ao canvas
 * 1080×1350 — fica proporcional pois o TemplateRenderer faz scale via CSS transform.
 */
export function ExportWatermark() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: 18,
        left: 20,
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: 1,
        color: "rgba(0,0,0,0.45)",
        letterSpacing: "0.04em",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        // Mix-blend-mode garante legibilidade em fundos claros e escuros
        mixBlendMode: "multiply",
      }}
    >
      sequenciaviral.com
    </div>
  );
}
