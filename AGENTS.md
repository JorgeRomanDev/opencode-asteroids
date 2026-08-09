# Guía del repositorio

## Ejecución y verificación

- Esta es una aplicación estática sin manifiesto de paquetes, dependencias, paso de compilación, linter ni pruebas automatizadas.
- Abre `index.html` directamente o ejecuta `npx serve .` y accede a `http://localhost:3000`.
- Usa `node --check game.js` para comprobar la sintaxis. Verifica manualmente en un navegador los cambios relevantes: movimiento, disparos, colisiones, cambios de nivel, muerte/reaparición y reinicio tras finalizar la partida.

## Arquitectura

- `index.html` contiene el elemento `canvas` y los estilos de la página; `game.js` contiene toda la lógica de entrada, simulación, colisiones, estado y renderizado.
- `game.js` se carga como script clásico, no como módulo ES. Sus declaraciones dependen del orden y comparten el ámbito global del archivo.
- El bucle de fotogramas es `loop -> update -> draw`; `initGame()` inicializa el estado, que cambia entre `playing`, `dead` y `gameover`.
- El tamaño del área de juego está duplicado en `index.html` (ancho y alto del `canvas`) y `game.js` (`W`/`H`). Mantén ambos sincronizados al cambiar las dimensiones; las constantes de JavaScript controlan el envolvimiento, la generación, la posición del HUD y las colisiones.

## Restricciones del juego

- El movimiento y las balas reaparecen en el borde opuesto del área de juego; las partículas no lo hacen intencionadamente.
- Los controles mantenidos se leen desde `keys`; las acciones de una sola pulsación usan `pressed()`, que consume `justPressed`. Conserva esta distinción al añadir controles.
- La eliminación de entidades se aplaza mediante indicadores `dead` y el filtrado de los arrays. Los fragmentos de asteroides se recopilan por separado durante las colisiones para no modificar el array activo mientras se recorre.
- `dt` se mide en segundos y está limitado a `0.05` en el bucle de animación. Mantén las velocidades, tiempos de recarga y temporizadores expresados en segundos.
