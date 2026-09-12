/**
 * Animated multi-layer star background.
 *
 * Renders the three star layers from the supplied "motino-graphics
 * background css.txt" (#stars, #stars2, #stars3) inside a fixed,
 * pointer-events-none, z-index 0 layer. The layers animate downward at
 * 50s / 100s / 150s via pure CSS — no React state, no JS animation loop.
 */
export function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      <div id="stars" />
      <div id="stars2" />
      <div id="stars3" />
    </div>
  );
}